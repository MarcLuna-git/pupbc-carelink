# Clinic feature updates (IT Elective feedback)

What changed, what it touches on the server, and what to check after deploying.

## Summary

| Request | What it does now |
| --- | --- |
| Email notifications for nurses | Every nurse gets an email copy of: a new booking, a student cancelling, medicine low stock / out of stock, medicine expiring soon. Switch off with `NURSE_EMAIL_NOTIFICATIONS=false`. |
| Student profile is confidential | The profile page states that the information is confidential (Data Privacy Act, RA 10173) and marks "My Health Information" as Confidential. |
| Choose which nurse | The consultation form has an "Attending nurse" selector (nurse accounts only, default: the signed-in nurse). That nurse is saved on the consultation and printed on the consultation form and medical certificate. No name is hard-coded. |
| Records tab / Students tab | Nurse sidebar: Records moved under Management, Students moved under Records. |
| Medicine inventory as a list | Table-style list with Medicine, Stock, Next expiry, Status and actions. |
| One "Add stock" with by-batch option | One dialog. Tick "Track this stock by batch" to enter lot number and expiry date; leave it off to add a plain quantity. |
| Expiry tracking, first-expiry first-out | Stock going out (consultation dispensing or a manual movement) is taken from the batch that expires first. Expired batches are never dispensed (they can be written off). "Next expiry" in the list, the Expiring Soon / Expired filters and the expiry notifications all use the earliest batch that still has stock. |
| "Rate your pain" at the kiosk | 0 to 10 scale on the check-in form; shown to the nurse in the queue and in the visit. Display only: it does not change the queue priority. |

## Server changes

- **One migration**, additive and nullable: `2026_10_28_000001_add_pain_level_to_triage_assessments_table` adds `triage_assessments.pain_level` (tinyint, null). Render runs `php artisan migrate --force` on boot, so it applies on deploy. Older kiosk screens that do not send `pain_level` keep working, and old rows stay null.
- **New API**: `GET /api/nurse/nurses` (list of nurse accounts). `POST /api/nurse/consultations` accepts an optional `attending_nurse_id`; the consultation's `nurse_id` is that nurse (the signed-in nurse is still recorded in the audit log). `POST /api/kiosk/checkin` accepts an optional `pain_level` (0 to 10). `POST /api/nurse/medicines/{id}/movements` now also returns `allocations` (which batches were used).
- **Stock without a chosen batch is released first-expiry-first.** One movement row is written per batch used, so batch balances and history add up. Stock that was never entered as a batch is used last.
- **Emails** go through the existing mail setup (`MAIL_*`, `EMAIL_TEST_MODE`), are sent after the response like the student emails, and a mail failure is logged, never raised to the user.

## Check after deploying

1. Book an appointment as a student: every nurse account receives "New appointment booked". With `EMAIL_TEST_MODE=true` the email goes to `EMAIL_TEST_RECIPIENT` instead.
2. Kiosk check-in shows the 0 to 10 scale; the nurse queue shows "Pain n/10".
3. Medicines: add stock by batch (two lots with different expiry dates), dispense, and confirm the earlier lot went first.
4. Open a consultation: the "Attending nurse" list shows the clinic's nurse accounts.

## Not included

- Nurses cannot opt out of individual emails (only the global switch).
- No new kiosk check-in alert for nurses; the queue page already shows new patients.
