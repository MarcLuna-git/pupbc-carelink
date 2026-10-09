# Shared-account Nurse Portal synchronization

## Architecture and timing

The existing application is Laravel 8 / JWT, React 19 / Vite, and a shared SQL database. The Render blueprint runs a PHP Docker web service with four PHP workers, file cache, synchronous jobs, and a static frontend. It does not configure a broadcaster, Redis, or a WebSocket worker. Render can support WebSockets, but adding and operating a broadcasting service would require infrastructure beyond this deployment. This implementation uses **authenticated polling**, not instantaneous realtime.

Each visible Nurse Portal tab has one coordinator. It checks `GET /api/nurse/sync` **five seconds after the preceding check and its resource refreshes finish**. The response contains only eight topic counters and the Manila calendar date, never patient data. Typical update delay is about 0–5 seconds plus network, server, and resource-fetch time. Slow requests, cold starts, or errors increase this delay.

- Laravel model events update counters in the shared database, including student-side saves, kiosk check-ins, and scheduled model changes. Counters written inside a transaction roll back with that transaction.
- Mounted screens subscribe to topics and refetch only their relevant resources when those topics change. Closed screens make no synchronization resource requests.
- Once every 60 seconds, mounted resources are reconciled even without a revision change. This recovers missed reads and time-dependent expiry alerts. Direct SQL updates that bypass model events are visible through this fallback.
- Hidden/offline tabs stop scheduling checks. Returning to the tab, focusing the window, or reconnecting triggers a check and reconciliation. A currently running request can finish.
- Checks do not overlap. Failures back off to 10, 20, 40, then 60 seconds; HTTP 429 also honors `Retry-After`. Rate-limit cooldown cannot be bypassed by repeated focus events.
- Local successful mutations trigger an early change check. No full-browser reload is used.
- Existing notification requests are coalesced when layout and page request the same parameters.

### Rate limits

Both the outer API limiter and authenticated-group limiter recognize an authenticated nurse JWT. Each **login token**, rather than the shared account ID, has separate budgets: **30 sync checks/minute** and **180 other API requests/minute**. Idle visible tabs normally use about 12 sync checks/minute, plus initial loads and the minute reconciliation. Separate computer logins have independent budgets. Tabs sharing the same JWT share a budget and back off if limited. Other accounts and unauthenticated traffic retain the existing 60/minute API budget; login throttles remain in place.

## Automatically updated screens

| Screen | Updated display data |
|---|---|
| Dashboard | Statistics, today's appointments, recent activity, notification summary |
| Appointments | Filtered lists, statuses, visible appointment details |
| Consultation / Clinic Queue | Check-ins, waiting/serving/completed transitions, triage summaries |
| Medicines | Inventory and open dispensing/stock movement history |
| Students | Filtered directory, selected profile/health data, appointments, clinic history |
| Clinic History / Records | Records, directory counts, selected record details |
| Notifications and navigation | Notification list and unread count |
| Course Management | Academic periods, courses, sections |
| Announcements | Published/admin announcement lists |
| Settings and account display | Saved nurse profile; profile draft is preserved while dirty |

The current frontend has no standalone reports page. Existing dashboard/record summaries refresh, and the existing report APIs continue querying shared data on request. No new report UI was added.

The dashboard cache key includes database revisions and the Manila date, so a new revision cannot continue serving the old five-minute cached result.

## Concurrency and retry protection

### Writes and versions

Nurse mutations run in a database transaction and acquire the existing `clinic_queue_locks` mutex first. This serializes clinic operations at the low-volume shared clinic boundary and preserves the existing queue-lock order. Stock operations retain their medicine/batch `FOR UPDATE` locks and quantity validation. Error responses roll back the outer operation as well as exceptions.

Editable models expose an opaque HMAC `sync_version` based on persisted attributes. Existing edit forms retain the version from when the draft was opened. Background list updates never replace that draft or its version.

`If-Match: <sync_version>` is required for medicine edits/deletion/deductions, consultation edits, announcement edits/deletion, academic edits, nurse profile edits, appointment rescheduling, and nurse medical-record edits. Medical-record edits use the health profile version (`new` if no profile exists). Missing versions return **428**; stale versions return **409** with a review/reopen message. A fresh version must come from reading the record, not from silently updating an open draft.

Concurrent deductions from the same stock snapshot are conservatively rejected after the first succeeds, even if enough stock remains. Reopen the current stock record to make a genuinely separate dispense. Additive receipts can both succeed because they commute. Negative-stock validation still applies independently of the version check. Separate legitimate dispensing actions cannot be identified as the same clinical prescription: this repository has no prescription/order identifier.

Appointment decisions retain their current-state validation. Completed consultations remain read-only. Creating a second consultation for a visit is rejected even when the two devices use the same nurse account.

### Retry identity

The frontend supplies a random `Idempotency-Key` for Nurse mutations (excluding password changes and renewable visit claims). In-flight requests and ambiguous network/5xx retries of the same payload reuse the same key in that tab. The database stores an account-scoped key, request digest, status, and **encrypted** successful response in the same transaction as the write.

A repeated key and payload replays the saved result before checking versions. Reusing the key for another payload returns 409. This protects receipts, deductions, Call Next, consultation saves, and other supported mutations from request retries. Existing API consumers should also supply a stable operation key on retries; requests without one do not receive ledger replay protection.

Retry keys are held in tab memory, not persisted with patient data. A closed/reloaded tab loses that local retry identity: verify the saved result before re-entering an uncertain additive receipt. Version checks still protect stale deductions. The ledger is deliberately not automatically deleted, because deleting a key would permit an old request to execute again. Plan a retention/archival policy that preserves deduplication tombstones before pruning it. `APP_KEY` must remain stable so saved encrypted responses can be replayed.

### Serving patients and consultation drafts

The existing clinic mutex permits only one serving patient. Duplicate Call Next requests either replay their original result or receive a conflict while a patient is serving.

Opening a visit acquires an editing claim tied to the **login token**, not a new nurse role. Another computer sees the same serving patient but cannot open its consultation while claimed. The active form renews the claim during synchronization reconciliation, normally at least once a minute. Closing/navigating away releases it on a best-effort basis. A disconnected/closed browser's unrenewed claim expires after **15 minutes**. Tabs sharing one JWT also share claim ownership.

Saving checks/acquires the claim again, validates the visit, creates the consultation, completes appointment/check-in, and releases the claim transactionally. An expired claim acquired by another session causes a conflict. Draft inputs are never replaced by queue refreshes or failed saves. Drafts remain in React memory; closing/reloading the page does not persist them.

## Authentication and privacy

Login still calls `JWTAuth::fromUser()` and does not invalidate other login tokens. Logout retains its existing single-token behavior. There are no new accounts, roles, permissions, login controls, public event channels, or patient-bearing broadcasts.

The sync route uses existing JWT authentication and nurse authorization, with `Cache-Control: private, no-store`. Normal data reads retain their existing authorization. CORS permits `If-Match` and `Idempotency-Key` for the existing permitted origins. Visit claims store only a check-in ID, a token hash, and an expiry time.

## Deployment steps (not executed against production)

1. After approval, deploy the backend and matching frontend together; old edit clients lack required version headers and will receive 428 until they load the updated frontend.
2. Run `php artisan migrate --force` on the shared database. The one new migration adds `nurse_sync_revisions`, `nurse_operations`, and `nurse_visit_claims`; it does not alter or remove clinical rows. Render's existing Docker startup already runs migrations before serving traffic.
3. Preserve the existing valid `APP_KEY`, `JWT_SECRET`, database configuration, and frontend API URL. All backend instances must use the same keys and shared database. No new environment variables, Redis, WebSocket service, scheduler, or paid Render plan are required for synchronization.
4. Rebuild the frontend with `npm ci` and `npm run build`. CORS/config changes require the usual configuration-cache refresh; Render startup already runs `config:cache`.
5. Validate the two-device scenarios below on staging with PostgreSQL/MySQL before production rollout. Do not use `migrate:fresh`, reset, truncate, or reseed production.

## Executed checks and test coverage

Development environment: PHP 7.4.33 and Node 24.18.0. The production Dockerfile uses PHP 8.1.

- `php -d xdebug.mode=off vendor/bin/phpunit --testsuite Unit`: **18 tests / 414 assertions passed**.
- `php -d xdebug.mode=off vendor/bin/phpunit tests/Feature/NurseSyncTest.php`: **8 tests / 116 assertions passed**. Isolated SQLite HTTP tests cover nurse-only metadata, two same-account JWT logins, per-token rate limits, revision rollback, receipt replay, conflicting keys, stock deductions/retries, negative-stock validation, stale edits/deletion, Call Next, visit claims, and consultation completion/replay. These are sequential interleaving tests, not parallel production-engine contention tests.
- `node --experimental-test-module-mocks --test src/services/nurseSync.test.js src/utils/appointmentDate.test.js`: **5 tests passed**, covering coordinator filtering, shared polling, hidden-tab pause, focus/reconnection, failure backoff, teardown, and existing appointment-date tests.
- `npm run lint`: **0 errors, 33 warnings** (unused variables/imports and hook dependency warnings).
- `npm run build`: **passed**, production bundle generated.
- PHP syntax checks: **all 27 created/modified PHP files passed**.
- Full existing backend Feature suite was attempted but cannot complete here: a pre-existing test uses PHP 8 named arguments, which PHP 7.4 cannot parse; the configured MySQL test database on `127.0.0.1:3307` also refuses connections. The isolated SQLite tests do not replace MySQL/PostgreSQL lock testing.

### Remaining staging/browser scenarios

These are **not reported as executed browser tests**:

1. Open two independent browser profiles, log into the same nurse account, and confirm both remain authenticated while operating.
2. Receive stock in A; observe B update. Dispense in B; observe A update, including open movement history.
3. Modify appointments; perform a kiosk QR check-in; observe appointment, queue, notification, and dashboard updates.
4. Send genuinely overlapping Call Next and dispensing requests against PostgreSQL/MySQL. Verify one serving patient, no negative stock, and one movement per retried key.
5. Open a serving visit in A. Verify B sees the serving patient and receives an editing-claim conflict. Type vitals in A while B changes other records; verify A's inputs remain intact. Save in A and verify both record views update.
6. Load the same editable medicine/academic/announcement record in both sessions; save A, then save B. Verify a 409 and preservation of B's draft.
7. Disconnect/reconnect, hide/show a tab, simulate 429, and verify automatic recovery and preserved drafts. Test claim release and 15-minute expiry.
8. Smoke-test the existing Student Portal and Kiosk end to end. Their UI was not changed; shared backend model event integration still needs this regression check.

## File manifest

Created:
- `backend/app/Http/Middleware/NurseOperation.php`
- `backend/app/Models/Concerns/HasSyncVersion.php`
- `backend/app/Services/NurseSync.php`
- `backend/app/Services/NurseVisitClaim.php`
- `backend/database/migrations/2026_10_09_000001_create_nurse_sync_tables.php`
- `backend/tests/Feature/NurseSyncTest.php`
- `frontend/src/hooks/useNurseSync.js`
- `frontend/src/services/nurseSync.js`
- `frontend/src/services/nurseSync.test.js`
- `docs/NURSE_SYNCHRONIZATION.md`

Modified:
- `backend/app/Http/Controllers/Api/Kiosk/KioskController.php`
- `backend/app/Http/Controllers/Api/Nurse/{Announcement,Consultation,CourseManagement,Dashboard,Medicine}Controller.php`
- `backend/app/Models/{AcademicPeriod,Announcement,Appointment,Consultation,Course,CourseSection,HealthProfile,Medicine,User}.php`
- `backend/app/Providers/{AppServiceProvider,RouteServiceProvider}.php`
- `backend/config/cors.php`
- `backend/routes/api.php`
- `backend/tests/Feature/{AppointmentIntegrationTest,CareLinkWorkflowTest}.php` (send versions for existing valid-write scenarios)
- `frontend/src/layouts/AdminLayout.jsx`
- `frontend/src/services/api.js`
- All ten active Nurse page components under `frontend/src/pages/Admin/`: Academic, Announcements, Appointments, Consultation, Dashboard, Medicine, Notifications, Records, Settings, Students.
