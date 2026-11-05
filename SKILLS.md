# SKILLS.md - PUPBC CareLink

## How to Run (Local) - READ THIS FIRST

Order matters: database first, then backend, then frontend.

### 1. Start MySQL (XAMPP)
- Open the **XAMPP Control Panel** and click **Start** on **MySQL**. Apache is not needed.
- Database: `pupbc_carelink` (user `root`, no password), as set in `backend/.env`.

### 2. Terminal 1 - Backend (Laravel API)
```bash
cd backend
php artisan serve
```
- Plain `php artisan serve` is enough. It runs on `http://127.0.0.1:8000`, which is exactly where the frontend's Vite proxy sends `/api` and `/storage` (see `frontend/vite.config.js`).
- The longer form `php artisan serve --host=0.0.0.0 --port=8000` is only needed if another device (phone, kiosk tablet) must call the backend **directly**. Normally it does not: other devices open the frontend, and the frontend proxies to the backend.
- First time only, or after pulling new changes: `composer install`, then `php artisan migrate`.

### 3. Terminal 2 - Frontend (React/Vite)
```bash
cd frontend
npm run dev
```
- Open **https://localhost:5173** (HTTPS, via mkcert, so the kiosk QR camera works).
- On another device on the same Wi-Fi: `https://<your-PC-IP>:5173`.
- First time only: `npm install`.

### 4. Optional - Terminal 3 - Scheduler
```bash
cd backend
php artisan schedule:work
```
- Runs `appointments:expire` and `queue:expire-skipped` every minute, and `medicines:notify-expiring` daily at 8:00 AM.
- The queue still expires skipped patients whenever the nurse queue is opened, so this is only needed to match production exactly.

### Database switch (backend/.env)
- `DB_CONNECTION` picks the database: `mysql` = local XAMPP, `pgsql` = Supabase.
- Local MySQL uses `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`.
- Supabase uses its own names: `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_DATABASE`, `SUPABASE_DB_USERNAME`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_SSLMODE`, `SUPABASE_DB_PERSISTENT`. Both blocks stay filled in and uncommented.
- Supabase project: **Southeast Asia (Singapore)**, `ap-southeast-1`. Host `aws-0-ap-southeast-1.pooler.supabase.com`, session pooler port 5432.
- Online, the server's `.env` sets `DB_CONNECTION=pgsql` plus the `SUPABASE_DB_*` values. `render.yaml` uses the same names.
- `config/database.php` still falls back to the old `DB_*` names for the pgsql connection if the `SUPABASE_DB_*` ones are not set.

### Moving Supabase to another project / region
- `backend/scripts/copy_supabase.php` copies a database into the Supabase project in `SUPABASE_DB_*`: it runs the migrations, copies every table, resets id sequences and compares row counts. It only reads the source and is safe to run again (each run replaces the Supabase copy).
- From the local MySQL: `cd backend && php scripts/copy_supabase.php --from=mysql`
- From another Supabase project (fill `OLD_SUPABASE_DB_*` in `.env` first): `php scripts/copy_supabase.php --from=old`

### Quick checks
- Build check: `cd frontend && npx vite build --logLevel error` (no output = OK).
- Frontend tests: `cd frontend && node --test src/pages/Admin/Students/*.test.js`.

---

## Session Summary (2026-11-02 to 2026-11-03) - Queue, Consultation and Dev Tools

The new tables already exist in the Singapore Supabase.

### 1. "On hold" queue status
- New status `on_hold` for a skipped patient: the nurse picks **Put on hold** in the patient popup.
- On hold patients can be **Recalled** (no deadline) or **Closed as No show**.
- Backend: `KioskController::holdPatient`, `recallPatient` and `markNoShow` accept skipped and on_hold; route `POST /queue/{id}/hold`. `ClinicQueue`, `AppointmentExpiry` and `StudentController` include on_hold.
- Frontend: `QueuePatientModal.jsx` (new) has the Recall / Put on hold / No show buttons, with fixed button widths. `NurseConsultation.jsx` shows the on_hold badge (sky blue). The student view (`ApprovedAppointmentsView.jsx`) shows the On hold label.

### 2. Save progress as draft (server + local, works on any device)
- Was "Save Draft" stored only in the browser. Now the draft is stored in the **database** (`consultation_drafts` table), so it works locally and online, and another nurse device can continue the form.
- API: `GET / PUT / DELETE /nurse/consultation-drafts/{checkinId}` (`ConsultationDraftController`). The draft is deleted when the consultation is confirmed (`ConsultationController::store`).
- **Auto-save:** every change is kept on the device at once and sent to the server about 1.5 s later. When the nurse leaves the page, anything still waiting is sent right away. The button still saves immediately with a notification.
- Footer shows "Draft saved {date} by {nurse}".
- Fix: Laravel turns empty strings into null, so `applyDraft` drops null values before filling the form.

### 3. Consultation page wording
- "Save Draft" renamed to **Save progress as draft**.
- "Review" renamed to **Preview** (it previews the printed consultation form / certificate before confirming).

### 4. Queue Options (arrival time)
- New **Options** button on the queue list opens `QueueOptionsModal.jsx`. It sets how long a called student has to arrive before being skipped.
- Range **10 seconds to 15 minutes** (presets 10s, 30s, 1m, 2m, 3m, 5m). Default 60 s.
- Stored on the server: `clinic_settings` table, `ClinicSettings` support class, `GET / PUT /queue-settings` (`QueueSettingsController`). Used by `SkippedQueueExpiry` and returned to the kiosk by `CheckinController`.

### 5. Remove time Guard is always OFF by default
- Turned OFF on login, nurse login and logout (`TimeGuard::resetFor`), and expires after 8 hours on the server.
- Turned OFF the first time a portal loads after the browser was closed and opened again (session cookie `carelink_devtools_<portal>` in `devTools.js`).
- Checked on the kiosk, the nurse portal and the student portal.

### 6. No-show no longer blocks rebooking
- A no-show appointment leaves the queue list and shows as **Expired** to the student.
- The student can book a new appointment: the duplicate checks in `Student/AppointmentController` and `KioskIdentity` ignore no-show appointments.

### 7. Removed
- **Reset (dev tools)** button and route on the consultation page.
- **Present mode** developer tool and all **database seed** sample rows and tags (`PresentMode.php`, `NursePresentModeNotice.jsx`, the `dev_seed_records` migration and table).
- **Details column** and its Patient/Profile buttons on the queue list (`QueuePatientDetails.jsx`, `StudentRecordPopup.jsx` deleted).

### 8. Restored
- **Patient Details** and **Appointment Details** cards are back at the top of the consultation (visit) page: name, student ID, program, year, section, age/sex, mobile, email, date & time, reason, appointment type / queue number and kiosk triage.

### New files (untracked until committed)
- `backend/app/Http/Controllers/Api/Nurse/ConsultationDraftController.php`
- `backend/app/Http/Controllers/Api/Nurse/QueueSettingsController.php`
- `backend/app/Support/ClinicSettings.php`
- `backend/database/migrations/2026_11_02_000002_create_consultation_drafts_table.php`
- `backend/database/migrations/2026_11_02_000003_create_clinic_settings_table.php`
- `frontend/src/pages/Admin/Consultation/QueueOptionsModal.jsx`
- `frontend/src/pages/Admin/Consultation/QueuePatientModal.jsx`

### Next steps
1. Deploy the new frontend and backend code.
2. After deploy, test on pupbccarelink.org: on hold, queue options, auto-saved draft (leave the page and come back), no-show rebooking.

---

## Earlier Summary (2026-10-30) - AI Chatbot Deployment

### Current State
- **Backend**: Laravel with Ollama provider (gemma4:31b) for AI chatbot
- **Frontend**: React/Vite static site
- **Database**: Supabase PostgreSQL (session pooler port 5432)
- **Deployment**: Render (Docker backend + static frontend).
- **Domain**: `pupbccarelink.org` (custom domain configured)

### Key Changes Made
1. **Switched from Gemini to Ollama provider** - Using OpenAI-compatible endpoint
2. **Updated render.yaml** - Custom domain `pupbccarelink.org`, Ollama env vars
3. **Pushed to git** - Commit `9687095` (working tree clean)

### Files Modified
- `render.yaml` - Domain + Ollama config
- `backend/.env.example` - Ollama template
- `backend/app/Services/Chatbot/OllamaClient.php` - New Ollama client
- `backend/app/Services/Chatbot/ClinicAssistant.php` - Uses OllamaClient
- `backend/config/services.php` - Ollama configuration

### Pending Actions (User Must Do)
1. **Update test files** to mock `ollama.com/v1/*` instead of `generativelanguage.googleapis.com/*`

### Why "Not Set Up Yet" Error
The chatbot returns "The clinic assistant is not set up yet" when `OLLAMA_API_KEY` is not set on the server.

### Ollama Config
- Base URL: `https://ollama.com/v1`
- Model: `gemma4:31b`
- Fallback: `gemma4:31b`
- Timeout: 30s
- Max tokens: 1024

---

## November 5, 2026 - Student Portal UI Refresh

Lahat ng nasa ibaba ay **hindi pa naka-commit**. Ang huling naka-commit at naka-push ay `ba94978` (breadcrumbs at refresh ng student pages).

### Header at breadcrumbs
- Breadcrumb sa header bar ("Dashboard / Page"), nasa ibabang gilid ng header.
- Inner tabs nagdadagdag ng pangatlong crumb: Records / Consultation Records, Settings / Privacy, Profile / Health Profile, Profile / Edit Profile.
- Itim ang text ng breadcrumb; bold ang kasalukuyang page.
- Files: `frontend/src/utils/studentBreadcrumb.js` (bago), `StudentLayout-for-Tablet-View.jsx`, `StudentLayout-for-Tablet-View.css`.

### Hero sections
- Itim na ang title ng lahat ng student hero (`StudentPageHero.jsx`, pati Appointments sa `appointments.css`).

### Records (Health Records)
- Search and Filter: sariling card sa ilalim ng stat cards, may title at paragraph, at nasa nested na abong container ang mga field.
- Hiwalay at may label ang mga filter: Search, Record Type, Year, Sort By. May custom chevron ang dropdowns, may layo sa kanan.
- Tinanggal ang sobrang search icon sa title.
- Itim na text: "Search and Filter", "My Records" (maroon pa rin ang icon), at ang mga numero sa apat na stat card.
- May bagong paragraph sa ilalim ng "My Records".
- Column header ng table: `bg-gray-100`.
- Hindi na pink ang hover: View Details, Print, at ang hindi pa napiling tab (`gray-50`).

### Profile (Overview)
- Edit mode: editable ang lahat maliban sa Personal Information. Read-only ang email (dumadaan sa Settings na may OTP).
- Dropdown ang single-choice fields; multi-select dropdown (walang checkbox, check icon lang) ang Known Conditions at Family History.
- Validation kapareho ng Health Profile form; `PUT /student/health-profile` ang nagse-save.
- Abo na ang "Confidential" pill.
- Itim ang mga title at pangalan; maroon pa rin ang mga icon.
- Summary card icons: tinanggal tapos ibinalik (walang pagbabago).

### QR Code
- Skeleton in-update para tumugma sa layout sa desktop at mobile.
- Itim na text: card titles (maroon icon), tip titles, at link na "Book an appointment".
- Check-in Information boxes: kapareho ng abo ng "Keep Your QR Private" (`bg-gray-50`).
- "View Appointment Details" button: kapareho na ng hitsura ng "Medical Certificates" tab, at ↗ (`ArrowUpRight`) na ang arrow.

### Appointments
- Booking form: walang naka-select na petsa sa simula at walang check ang steps; lalabas lang ang check kapag may na-click na petsa.
- Itim na section titles: Your Upcoming Appointment, Book a New Appointment, Appointment History.
- Appointment History: 3 row bawat page (`HISTORY_PAGE_SIZE` sa `ApprovedAppointmentsView.jsx`).
- Skeleton: tinanggal ang ekstrang block sa kanan ng Upcoming Appointment header.
- Tatlong booking column: kapareho ng abo ng Records column header (`gray-100`; `gray-700` sa dark mode).
- Hindi na pink ang hover ng mga petsa sa kalendaryo at ng mga time slot.
- Araw ngayon sa kalendaryo: abo na ang border.

### Mga natitirang tanong
- Email: link papunta sa Settings, o inline editor na may OTP?
- Pink pa rin ang hover: border ng Select Service options, at pagination arrows sa Records.
- Hindi pa nasusubukan: dark mode ng lahat, at aktwal na pag-save ng Profile edit.
- Mas luma: ang hindi malinaw na "medicine" item, at ang forgot-password fix para hindi malaman kung naka-register ang isang email.

---

## November 5, 2026 (Part 2) - Appointments at Records: Filter, Table at Sorting

Pangalawang summary ngayong araw, kasunod ng "November 5, 2026 - Student Portal UI Refresh" sa itaas. Lahat ng nasa ibaba ay **hindi pa rin naka-commit**.

### Appointments: kulay at hover
- Select Service options: abo (`gray-50`) na ang hover at selected state, maroon na border kapag selected. Hindi na pink.
- "Not booked" pill: `gray-50` na background at `gray-200` na border, parang hover ng button sa Records.
- Empty DATE tile sa Upcoming Appointment: `gray-100` na may dashed border.
- Date tiles sa Appointment History: `gray-100` na rin, at itim ang text.
- Itim na text: Queue label, View Details, at ang "Booking Summary" title.
- Step progress fields (tatlong booking column): `gray-50` na background, kapareho ng Search and Filter box ng Records.
- Header (avatar, theme toggle, notification bell): abo (`gray-100`/`gray-200`) na ang hover, hindi pink.

### Appointments: Details modal
- Completed info message: naka-center ang icon sa itaas, sunod ang itim na title, tapos abo na paragraph. Walang background box.
- Service, Reference, Date, Time at Concern ay iisang listahan na sa loob ng iisang gray box, pare-pareho ang itsura ng bawat row.
- Edit, Cancel at Close buttons: hindi na full width, naka-center.

### Appointments: Appointment History
- Search and Filter: sariling card sa itaas ng history section (Search, Status, Service, Reset filters). Kapareho ng UI ng Records, pero appointment ang logic.
- Layout switch: slide toggle na (grid / list), walang dropdown icon.
- **Table view na ang default** tuwing bubuksan o ire-reload ang page; hindi na tinatandaan ang huling napiling layout.
- List view: table na may header row (Date, Service, Staff · Room, Status, Actions).
- Pagination: naka-center.

### Column sorting (Appointments at Records)
- Pindutin ang column header: 1st click pababa, 2nd click pataas, 3rd click balik sa default na ayos.
- Icon: patong na ▲/▼. Outline at abo kapag hindi naka-sort; puno at maroon ang active na direksyon.
- Appointments: Date, Service, Staff · Room, Status (`HISTORY_SORTS` at `SortCaret` sa `ApprovedAppointmentsView.jsx`).
- Records: lahat ng column maliban sa Actions, sa dalawang tab (`COLUMN_SORTS` at `SortCaret` sa `HealthRecords.jsx`). Nawawala ang sort kapag lumipat ng tab.
- Pinalitan ng **Reset filters** button ang Sort By dropdown sa parehong page. Nililinis nito ang search, filters at column sort; disabled kapag walang naka-set. Newest first ang default sa Records.

### Sidebar
- Section labels (MANAGEMENT, RECORD, ACCOUNT): 10px, bold, puti na 50% opacity (`.student-nav-section` sa `StudentLayout-for-Desktop-View.css`).

### Files
- `frontend/src/pages/Student/Appointments/ApprovedAppointmentsView.jsx`, `Appointments.jsx`, `appointments.css`
- `frontend/src/pages/Student/HealthRecords/HealthRecords.jsx`
- `frontend/src/layouts/StudentLayout/StudentLayout-for-Desktop-View.css`

### Mga natitirang tanong
- Ilapat din ba ang naka-center na message style sa Approved, Cancelled at Rejected na modal? Maroon ba dapat ang info icon?
- Pink pa rin ang pagination arrows sa Records.
- Hindi pa nasusubukan: dark mode, mobile/tablet layout ng bagong table at filters, at modal ng pending appointment na may tatlong button.
