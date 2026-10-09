# Appointment expiration and Render Free

## Server policy

All appointment windows use **Asia/Manila** and `config/checkin.php`:

- Opening is inclusive: appointment time minus 15 minutes.
- Deadline is exclusive: appointment time plus 30 minutes.
- An 8:00 AM appointment accepts a new check-in at 7:45:00 AM through
  8:29:59.999999 AM; at 8:30:00 AM it is ineligible.
- Slot parsing resets seconds/microseconds rather than inheriting the current time.
- Kiosk identity and admission checks are server-side. A valid student QR cannot
  bypass an expired appointment or a closed appointment window. A QR with its own
  `expires_at` equal to or earlier than now is also rejected.

Admission acquires the existing clinic mutex, locks/reloads the approved
appointment, and validates the clock **after waiting for the mutex**. Expiration
uses the same mutex and appointment-row lock order and rechecks for a committed
check-in before changing status. Retries cannot create another queue entry.

An existing non-walk-in check-in protects an approved appointment from expiration,
including when the queue later changes to called, serving, completed, or no-show.
Expired appointments are retained as history; this service does not delete rows.
The existing notification/mail behavior of the expiration service is unchanged.

## Actual processing mechanisms

1. **Request-triggered catch-up:** qualifying clinic API requests run
   `AppointmentExpiry::run()`. There is no once-per-day cache. The service processes
   overdue pending appointments and overdue approved appointments dated today or
   earlier in batches. Repeated/concurrent runs recheck status under database locks.
   Public/authentication/health requests remain excluded by the middleware.
2. **Existing command:** `php artisan appointments:expire` runs the same service
   without a browser. The Laravel schedule now declares it every minute with
   overlapping scheduled runs disabled. **Declaring a schedule does not start a
   scheduler process.** A runner must execute `php artisan schedule:run` every minute
   (or execute the expiration command directly).

Admission is invalid at the deadline even when stored status has not yet been
updated. Stored status changes on the next successful catch-up or scheduled run.
The service also catches up missed appointments from earlier days after an outage.

## Render Free limitation and recommendation

The current `render.yaml` uses a free web service. Its Docker entrypoint serves PHP
but starts no scheduler. Render can spin down an idle free web service after
15 minutes and restart it at any time. An in-container timer is therefore not a
reliable background expiration mechanism, and a request-only fallback cannot
update rows while there is no traffic. Health checks do not execute expiration.

For browser-independent status updates, approve a dedicated scheduler, preferably
a Render Cron Job (paid) or another trusted scheduled runner executing the same
application release and `php artisan appointments:expire` every minute against
the shared PostgreSQL database. Supply deployment secrets privately, use the
existing stable application key and configuration, monitor failed runs, and
verify against an isolated staging database before enabling production execution.
Do not expose an unauthenticated maintenance endpoint or place credentials in URLs.

This recommendation has **not** been configured or deployed. A one-minute job
provides eventual status persistence, not an exact-to-the-second execution SLA;
server admission checks still enforce the exact deadline regardless of runner delay.

Reference: https://render.com/docs/free (idle sleep and free-service limitations).

## Verification scope

The focused SQLite HTTP tests cover opening/deadline boundaries, QR expiry,
same-day repeated middleware runs, past-day catch-up, successful-check-in
preservation across queue states, duplicate admission retries, admission delayed
to the deadline while waiting for the mutex, and an interleaved admission between
expiry candidate selection and the locked recheck.

These interleavings do **not** prove parallel PostgreSQL row-lock contention.
Before release, run two competing admission/expiry requests on an isolated
PostgreSQL staging fixture and verify one check-in, preserved history, and no
deadlocks. No tests in this task run against production or staging data.
