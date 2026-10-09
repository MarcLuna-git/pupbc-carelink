# Consultation Queue: Skip and Mark Returned

The five-minute called-patient countdown has been removed. Calling, confirming
arrival, recalling, skipping, and marking returned are nurse-controlled actions.

## State rules

| Action | Required state | Result |
|---|---|---|
| Call Next | waiting, no other called/serving patient | called |
| Patient Arrived | called | serving |
| Skip | called, no completed consultation/other-device editing claim | skipped |
| Mark Returned | skipped, before the original appointment deadline | waiting |
| Server reconciliation | still skipped at/after original appointment + 30 minutes | no_show |

There is no minimum wait before Skip. A skipped patient remains in the queue and
Call Next ignores them until Mark Returned. Return changes the existing row:
appointment/check-in IDs, queue number, check-in time, and medical priority remain
unchanged. Original priority ordering applies when the patient becomes eligible.

Only **currently skipped** entries become no-shows at the appointment deadline.
Waiting (including returned), called, serving, and completed visits are not changed
by this reconciliation. A patient first called near the deadline stays called
until the nurse confirms arrival or explicitly skips. Explicit Skip after the
deadline can immediately produce no_show; the deadline alone never does so for
a called patient. A late Mark Returned is rejected; a no-show requires a separate
new clinical decision/booking rather than silently resurrecting the old visit.

The old `/queue/{id}/no-show` action now returns 409 with a refresh instruction,
so a stale five-minute frontend timer cannot mark a called patient no-show.

## Server state and multi-device safety

- Added nullable `skipped_at`, `skipped_by`, `returned_at`, and `returned_by`
  audit fields via `2026_10_12_000001_add_skipped_queue_audit_fields.php`.
  Its forward migration reuses existing fields and its rollback retains audit data.
  Existing queue status is a string; no enum or appointment constraint is changed.
- Timestamps and actor IDs come from the server/authenticated nurse, never client
  fields. Automatic no-show stores server `no_show_at` and a null `no_show_by`;
  `skipped_by` records the nurse's explicit action.
- Skip and Mark Returned require `If-Match` from the check-in's `sync_version`.
  Missing versions return 428; stale versions return 409. Updated arrival/recall
  requests also submit versions; earlier clients keep their existing state checks.
- The existing clinic mutex serializes writes. Idempotency-key replay remains
  before version validation, and other-device editing claims are respected.
- Reconciliation rechecks state under the same mutex. It commits before a nurse
  action transaction, so a rejected stale action cannot undo a due no-show.
- Check-in/appointment saves update the existing shared NurseSync revisions.
  Relevant screens refresh via the existing coordinator; no new event system.
- This workflow creates no notifications and does not delete visit history.

## Render Free and processing

`SkippedQueueExpiry::run()` executes before authenticated nurse queue, sync, and
consultation requests, and on kiosk queue reads. It catches up older skipped rows
as well as today's entries. No frontend countdown is needed for enforcement.

The focused command `php artisan queue:expire-skipped` runs the same service.
Laravel schedules it every minute with overlap prevention, but the current Render
Free Docker service has **no scheduler runner** and may sleep. With no traffic and
no external runner, rows are reconciled on the next relevant request; deadline
validation still blocks a late return. A trusted approved runner or paid Render
Cron Job can execute this command each minute independently of any browser.
No external scheduler has been configured by this change.

Before deploying, apply the additive audit migration to an isolated staging
database and deploy the matching backend/frontend together. Test real parallel
Skip/Arrived/Returned/Call Next requests on PostgreSQL and two browser sessions.
Local SQLite tests cover deterministic two-device interleavings, not actual
PostgreSQL lock contention. No production or staging migrations ran in this task.
