# Consultation Queue: Call, Arrived, Auto-Skip and Recall

A called student has **one minute** to show up. The nurse sees two buttons on the
called row, **Arrived** and **Recall**. There is no manual Skip.

## State rules

| Action | Required state | Result |
|---|---|---|
| Call Next | waiting, no other called/serving patient | called (1-minute timer starts) |
| Arrived | called | serving; the consultation form opens straight away |
| Timer runs out | called for 60 s or more, no consultation started | skipped (automatic) |
| Recall (called) | called | announced again, timer restarts |
| Recall (skipped) | skipped, nobody else called/serving, before the appointment deadline | called (timer restarts) |
| Server reconciliation | still skipped at/after original appointment + 30 minutes | no_show |

A skipped student stays in the queue for as long as their appointment schedule lasts.
Call Next ignores skipped rows; **Recall** brings the student back when they return.
Recall changes the existing row: appointment/check-in IDs, queue number, check-in time
and medical priority stay the same. A late Recall (after the deadline) is rejected with
a clear 409 message; a no-show needs a new booking.

Only **currently skipped** entries become no-shows at the appointment deadline.
Waiting, called, serving and completed visits are not changed by that reconciliation.

## Where the timer is enforced

`SkippedQueueExpiry::CALL_TIMEOUT_SECONDS = 60`. `SkippedQueueExpiry::run()` first skips
called rows older than the timeout (re-checked under the queue lock, claims released,
`skipped_at` set, `skipped_by` null because it was automatic), then marks no-shows.
It runs before every nurse queue/sync/consultation request and on kiosk queue reads.

The nurse screen only *displays* the countdown. It uses the server's clock
(`server_time` in the check-in list response) so a wrong device clock cannot make the
countdown run long, clamps the display to the 1-minute range, and re-reads the queue
while a called row is overdue so the row flips to skipped without a manual refresh.

The `php artisan queue:expire-skipped` command runs the same service. Render Free has
no scheduler runner, so rows are also reconciled on the next relevant request.

## Required consultation fields

`history_present_illness`, `nursing_assessment` and `nursing_interventions` (plus the
existing chief complaint) are required on create, and cannot be blanked on update. The
form shows the same messages before submitting; the API returns 422 with
"Enter the history / present illness.", "Enter the nursing assessment." and
"Enter the nursing interventions." Vital signs and treatment/plan stay optional.

## Database

No migration. The audit fields from `2026_10_12_000001_add_skipped_queue_audit_fields.php`
are reused. The manual `/skip` and `/returned` endpoints were removed: skipping is
automatic and returning is Recall.
