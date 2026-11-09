# SKILLS.md - PUPBC CareLink

## 🤖 Maintenance Protocol
- **MY RULE::** update SKILLS.md if compact summary made.
- **MY RULE::** make a summary for all of this conversation then add the summary to SKILLS.md with new date sort labels, if already have date, make a session something like session 1 or session 2 or session 3.

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

---

## November 6, 2026 - Login Modals, Sign Out, Settings at Health Records

Kasunod ng "November 5, 2026 (Part 2)" sa itaas. Naka-commit na ang karamihan sa `75d12ed`. Ang **hindi pa naka-commit** ay ang Medical/Health Records rename at ang running count sa dalawang pager (tingnan ang "Files").

### Appointments: Appointment History
- Bakit parang nawawala ang rejected: nasa data sila, pero itinutulak ng status-rank sort sa huling page. Bagong default na ayos (kapag walang column sort): pending/approved sa itaas, tapos lahat ng tapos na ay newest first.
- Status filter: may Completed, Cancelled at **Rejected** na. Walang `declined` status sa database (approved, rejected, completed, cancelled lang).
- Tinanggal ang text na "Showing 1–3 of 24 appointments".
- Running count sa kanan ng pager: "3 of 24", "6 of 24"... (`<small>` sa `.ap-history-pagination`). *(uncommitted)*
- View Details hover: `maroon-900` na background at puting text, kapareho ng Book a Visit.

### Login at Forgot Password
- Lahat ng error at info message ng Login ay **modal popup** na (`StudentNoticeModal`), para hindi na lumalaki o "nag-zoom" ang card. Pareho na ang taas ng card kahit may error.
  - Validation: "Check your details", isang linya bawat error.
  - Maling password: "Sign-in failed", at sa ilalim ng title ang bold na "N attempts remaining" (bagong `highlight` prop).
  - Lockout (429): "Login temporarily locked" na may bilang ng segundo.
- Field na may error: pulang border lang, walang pink na background. Wala na ring inline error text.
- Forgot Password: simpleng bilog na badge na may mail icon na lang ang icon sa itaas.

### Sign Out
- Bagong `StudentConfirmModal` sa `StudentFeedback.jsx`: kapareho ng itsura ng mga login popup, may gray na Cancel at maroon na confirm. Esc o click sa labas para mag-cancel, maliban kung nagsa-sign out na.
- Sign Out item sa account menu: maroon na, hindi na light red na mukhang warning.

### Settings
- New Email: may mail icon sa kaliwa.
- Eye toggle sa Confirm New Password (Password tab) at sa Confirm Password (Email tab).

### Health Records
- Running count sa tabi ng pager: "7 of 16", "14 of 16" (7 bawat page). *(uncommitted)*
- Tinanggal ang count badge sa mga tab button.
- View Details, Print at Preview: maroon-900 hover na may puting text.
- Sidebar section label: **MEDICAL** na (dating RECORD). Menu item, page title at breadcrumb: **Health Records**. Sa mobile bottom bar, "Records" pa rin para hindi maputol sa 300px (`shortLabel`). *(uncommitted)*

### Files
- Naka-commit (`75d12ed`): `StudentFeedback.jsx`, `Login.jsx`, `ForgotPassword.jsx`, `Settings.jsx`, `StudentAccountMenu.jsx`, `StudentLayout-for-Desktop-View.jsx`, at mga naunang bahagi ng `ApprovedAppointmentsView.jsx`, `appointments.css`, `HealthRecords.jsx`.
- Hindi pa naka-commit: `ApprovedAppointmentsView.jsx`, `appointments.css`, `HealthRecords.jsx`, `studentPortalNavigation.js`, `studentPortalNavigation.test.js`, `StudentLayout-for-Mobile-View-Min-300px.jsx`.

### Mga natitirang tanong
- Hindi pa nasusubukan sa dark mode ang mga bagong modal at ang running count.
- Ang pagsubok sa maling password ay ginawa gamit ang pekeng Student ID, para hindi maubos ang attempts ng totoong account.

---

## November 7–8, 2026 - Session 1: Homepage, Demo Queue, Queue/Consultation Split, Medical Liability Form at Sidebar

Kasunod ng "November 6, 2026" sa itaas. Nagsimula noong gabi ng Nov 7 at natapos noong madaling-araw ng Nov 8. **Wala pang naka-commit** sa session na ito.

### Homepage at Login images
- Homepage hero: tinanggal ang PUP statue slide. Dalawa na lang ang slide: PUP Biñan Campus at ang Campus Clinic (`clinic-waiting-area.jpg`).
- "A healthier you" section: ang bagong larawan ng nurse na nagba-bakuna (`clinic-vaccination.jpg`, `object-[center_35%]`).
- Nurse Login: ang bagong larawan ng finger-prick test (`clinic-lab-test.jpg`, `object-[center_30%]`) sa right-side photo. Hindi ginalaw ang Student Login.
- Hindi binura ang mga napalitang larawan (`pupstatue.webp`, `pup-binan-hero.jpg`, `clinic-waiting-area.jpg`).

### Student ID (Register)
- Ang taon sa Student ID ay 2000 hanggang sa kasalukuyang taon na lang, habang nagta-type at pag-submit ("The year must be from 2000 to 2026.").
- Binago ang `formatStudentId` sa `inputFilters.js` (gamit din ng Medicine dispensing) at sa `Register.jsx`.
- Hindi ginalaw ang Login, Kiosk at backend regex (`\d{4}` pa rin).

### Nurse Dashboard at Appointments
- Upcoming Schedule: wala nang skeleton rows. May empty state na "No upcoming visits."
- Appointment requests: **Table** na ang default view, at nasa kaliwa na ito ng List. Hindi na tinatandaan ng browser ang List.
- Queue list: tinanggal ang **Start** (auto-queue) button at ang arrow icon sa action button. "Options" na lang sa header.

### XAMPP MySQL
- Port 3306 conflict: ang Windows service na **MySQL80** ang sumasakop. Ni-stop ito at ginawang **Manual**.
- Pangalawang sira: crashed ang `mysql.db` (Aria). Ni-repair gamit ang `aria_chk -r`.
- May backup sa `C:\xampp\mysql\backups\2026-11-07` at `...\2026-11-07-datadir-before-aria-repair`.
- Paalala: sa XAMPP Control Panel lang i-Start at i-Stop ang MySQL, at i-Stop muna bago i-shutdown ang PC.

### Demo patients (Queue → Options → Developer tools)
- Toggle na may developer password (`admin` ang default, pareho ng Settings → Developer Tools).
- Tatlong demo patient para makita ang priority: **Demo Priority** (HIGH, P-), **Demo Medium** (MEDIUM, R-) at **Demo Patient** (LOW, R-). Laging nauuna ang Priority, sunod ang Medium, tapos Regular.
- Totoong queue counter ang gamit nila, kaya may "Demo" badge para makilala.
- Pagka-save ng consultation, bumabalik sila sa Waiting, kaya paulit-ulit na loop. May **Reset demo patients**. Pag-off ng toggle, buburahin sila at lahat ng record nila.
- Hindi sila lumalabas sa kiosk/TV display, at hindi nababawasan ang totoong stock ng gamot.
- Backend: `DemoQueue.php` at `DemoQueueController.php` (bago), at mga route sa `api.php`.
- Ang priority ay galing sa triage ng kiosk. HIGH: warning sign o pain 7–10. MEDIUM: pain 4–6 o may tugmang sakit sa health profile. LOW: pain 1–3, o hindi Consultation na serbisyo.

### Queue popup (arrival lang)
- **Call next** sa row: tinatawag agad ang pasyente at bubukas ang popup na may **arrival timer**, pangalan at **Patient arrived** lang. Wala nang step indicator.
- **Kapag hindi dumating sa oras:** isinasara ng server ang visit bilang **No show**. Wala nang Recall at Put on hold, para sa lahat ng pasyente, hindi lang sa demo.
- Ang popup ay "Did not arrive", may paliwanag na mag-**book a new appointment**, at OK button. May notification din ang estudyante.
- Kapag naka-on ang Remove time Guard, hindi isinasara ang visit ("Time is up" lang).

### Queue at Consultation (hiwalay na page na)
- Ang dating "Queue & Consultation" ay dalawang page na:
  - **Queue** (`/nurse/queue`, `NurseQueue.jsx`): pagtawag at pag-validate ng pagdating.
  - **Consultation** (`/nurse/consultation`, `NurseConsultation.jsx`): ang consultation form.
- Bagong helper na `queueRows.js` (`toQueueRow`, `queueRowsFrom`, `consultationPath`).
- **Patient arrived**: validation lang, wala nang auto-redirect. May toast na "{name} arrived. Their consultation form is on the Consultation page."
- Ang popup ng pasyenteng nasa consultation ay may paliwanag at OK button na lang.
- Queue list: nawawala na ang totoong student na "In consultation" (lumipat na sa Consultation page). Ang **demo** patients ay nananatili pa rin sa listahan.
- Consultation page na walang `?visit`:
  - Sa itaas, card na **"Clinic Queue"** na may maikling paliwanag at button na "Go to Queue".
  - Sa ilalim, table na "In consultation" na may button na **Consult** (dating "Open visit").
- Sa form: "Back to Consultation" na ang link sa itaas. Ang huling button ay **"View in Patient History"**.
- Mas maliit na ang agwat ng student ID at paragraph sa popup na "Did not arrive".
- Queue Options: hindi na nag-fold/unfold ang demo box. May cache at prefetch na sa `QueueOptionsModal.jsx`.

### Medical Liability Form (bagong optional na dokumento)
- Ang step 3 ng consultation ay **"Additional Documents"** na (saglit itong naging "Release Documents"). May sarili na itong header at maikling paliwanag.
- Dalawang optional na checkbox sa step 3:
  - Medical certificate.
  - **Medical liability form**. Kapag naka-check, required ang **Activity** (hal. "Sports Fest 2026").
- Review (step 4): may toggle sa itaas ng preview, `1 Consultation Form · 2 Medical Certificate · 3 Medical Liability Form`. May "Page X of Y" at mga arrow na ‹ ›. Lalabas lang ang mga dokumentong naka-check.
- Pagka-save, may button na "Print Medical Liability Form".
- Backend:
  - Migration `2026_11_08_000001_add_liability_form_to_consultations_table.php` (`liability_form` boolean, `liability_activity` string). **Na-run na sa local MySQL.** Hindi pa na-run sa Supabase.
  - `Consultation` model, ang validation ng `ConsultationController` store/update, at ang `ClinicHistory::forStudent`.
- Print template: `frontend/public/templates/print/medical-liability-form.html`, batay sa papel na form ng clinic. Gitnang bahagi lang ito ng dokumento, kaya kapag direktang binuksan ay walang style, walang logo, at `{{...}}` ang lumalabas. Normal iyon, kasi isinisingit ito sa `layout.html`. Naka-dokumento ang mga placeholder sa `README.md`.
- `recordDocuments.js`: may bagong document kind na `liability`.
- Student Health Records: may bagong tab na **"Medical Liability"** (may Activity column, Preview at Print). Sa View Details, may "Print liability form".
- Nurse Patient History (`ClinicRecordList.jsx`): may row na "Medical liability form: Issued · [activity]".

### Student QR page
- Kapag tapos na ang visit, bumabalik sa default ang lahat:
  - Step tracker, sa "Not yet checked in".
  - Check-in Information, sa default note.
  - Appointment Summary, sa "No approved appointment scheduled for today."
- Nananatili ang View Records card.

### Nurse sidebar
- "Records" page ay **"Patient History"** na, at nasa **Management** na, sa ilalim ng Consultation.
- Ayos ngayon: Dashboard / MANAGEMENT: Appointments, Queue, Consultation, Patient History / RECORDS: Students, Faculty, Medicines, Courses / ADMIN: Announcements, Settings.
- Queue icon: **QR code** na (`QrCode`), dating `ListOrdered`.
- Section labels: maliit na, kapareho ng student portal (10px, bold, 50% na puti). Mas malaki ang agwat ng bawat grupo (18px).
- Mga button na hindi naka-select: **85% na puti** na (dating 60%), para hindi kamukha ng mga label. Sa dark mode, `#d1d5db`.
- Page titles sa `nurseGreeting.js`: may Queue at Consultation na. "Patient History" na rin ang title ng records.

### Files
- Binago: `QueuePatientModal.jsx`, `NurseConsultation.jsx`, `ConsultationVisit.jsx`, `QueueOptionsModal.jsx`, `NurseRecords.jsx`, `ClinicRecordList.jsx`, `nurseNavigation.js`, `NurseLayout-for-Desktop-View.css`, `nurseGreeting.js` (at test), `App.jsx`, `QR.jsx`, `HealthRecords.jsx`, `recordDocuments.js`, `print/README.md`, `Consultation.php`, `ConsultationController.php`, `ClinicHistory.php`, `Landing.jsx`, `NurseLogin.jsx`, `Register.jsx`, `inputFilters.js`, `NurseDashboard.jsx`, `NurseAppointments.jsx`, `KioskController.php`, `CheckinController.php`, `MedicineController.php`, `SkippedQueueExpiry.php`, `api.php`.
- Bago (untracked): `NurseQueue.jsx`, `queueRows.js`, `medical-liability-form.html`, ang migration ng liability form, `DemoQueue.php`, `DemoQueueController.php`, `clinic-vaccination.jpg`, `clinic-lab-test.jpg`.

### Mga natitirang tanong
- Hindi pa nasusubukan nang buo ang pag-save ng consultation na may liability form, pati ang pag-print nito mula sa Health Records ng student.
- Hindi pa nasusubukan ang "Patient arrived" na walang redirect gamit ang totoong pasyente.
- Lumang list icon pa rin ang Queue sa title card ng Queue page at sa "Clinic Queue" card.
- Hindi pa na-run ang liability migration sa Supabase.


---

## November 8, 2026 - Session 2: Consultation Step 1/3 at Review, Mga Bagong Certificate, Batch Release at Patient History sa loob ng Consultation

Kasunod ng "Session 1" sa itaas, sa parehong araw (Nov 8). Walang naka-commit sa session na ito. Hindi nasubukan sa browser ang karamihan (nag-build at syntax check lang). Hindi na-run ang `php artisan test` (nag-hang sa test database sa port 3307).

### 1. Queue modal
- Ang "Now calling" modal ay mas makitid na: `max-w-md` → `max-w-sm` (`QueuePatientModal.jsx`).
- Sa "Patient arrived" na modal, ang **OK** ay naging **Go to Consultation**. Dinadala nito ang nurse sa **listahan** ng Consultation page (`/nurse/consultation`), hindi diretso sa form; ang nurse mismo ang pipindot sa consult action. Bagong prop: `onGoToConsultation` (`NurseQueue.jsx`).

### 2. Consultation Step 1: Patient Details
- Ang **Patient Details** card ay may read-only na mga field (Name, Student ID, Sex, Program, Year Level, Section, Email) at editable na seksyong **Additional Information**: Age, Contact #, Address, Contact person in case of emergency, Relationship, Emergency contact #.
- Naka-prefill ang mga ito mula sa student profile (`studentDetails`). Ang mga edit ay nasa form state at draft, at ginagamit sa print. **Hindi** nagsa-save sa student profile (kailangan ng backend para doon).
- Layout: 65/35 (`lg:grid-cols-[13fr_7fr]`) ng Patient Details at Appointment Details. Additional Information sa 12-column grid: Age (2), Contact # (3), Address (7); pangalawang row: Contact person, Relationship, Emergency contact # (tig-4).
- Ang demo patients (`DemoQueue.php`) ay may birthday, address, mobile at guardian na, para may laman ang prefill. Na-apply na rin sa tatlong umiiral na demo student.

### 3. Step 3: Additional Documents
- Inalis ang icon sa heading. Ang header at paragraph ay nasa kaliwang gilid ng panel; ang mga choice ay naka-center.
- Mga option (ayos): **Issue a Consultation Form Only (default)** (naka-check kapag walang ibang naka-tick; ang pag-tick nito ay nag-uuncheck sa iba), **Medical Certificate**, **Medical Certificate (Sick)**, **Medical Certificate (OJT)**, **Medical Liability Form**. Naka-Title Case ang mga label.
- **Certificate Reference** ay auto-generated pagka-tick: `MED-YYYY-MMDD` (hal. `MED-2026-1108`), editable (`certificateRef()`). Hindi ito nag-a-auto update kapag may laman na.
- Sick: may **Days of Medical Attendance** (optional). OJT: may Certificate Reference at **OJT Company** (required).
- Inalis ang maliit na step progress sa Review Documents (at ang hindi na ginagamit na `stepDone` at `Check` icon).

### 4. Mga printable template (`frontend/public/templates/print/`)
- `consultation-form.html` ay tumutugma sa `CONSULTATION-FORM.docx`: Date, Name, Age, Address, Course & Year, Contact #, Contact person + Relationship (hiwalay), Emergency Contact #, Chief Complaint, Diagnosis, Vital Signs, Assessment, Nursing Interventions, pirma ni Dr. Prieto (may larawan ng pirma).
- Bago: `medical-certificate-ojt.html` (galing sa `MEDCERT-OJT.xlsx`), `medical-certificate-sick.html` (galing sa `MEDCERT-SICK.xlsx`), `medical-clearance.html` (batch, galing sa BSCPE docx).
- `layout.html`: may opsyonal na logo sa kanan (`right_logo`) at CSS ng pirma (`.signed`, `.esign`). Mga logo: `cho-logo.jpeg` (OJT at Sick), `bagong-pilipinas-logo.png` (Medical Liability Form), `signature-prieto.jpeg`. Ang kaliwang PUP Biñan logo ay hindi nagbago.
- `recordDocuments.js`: mga bagong entry sa `DOCUMENTS` (`sick`, `ojt`, `clearance`); `studentDetails` ay may `sexInitial`, `emergencyPerson`, `emergencyRelationship`; may `rightLogo` bawat dokumento. Naka-document ang mga placeholder sa `print/README.md`.

### 5. Backend
- Migrations: `2026_11_08_000002_add_ojt_certificate_to_consultations_table` (`ojt_certificate`, `ojt_certificate_ref`, `ojt_company`), `..._000003_add_sick_certificate_...` (`sick_certificate`, `sick_certificate_ref`, `sick_rest_days`), `..._000004_create_medical_clearances_table`. Na-migrate sa lokal na MySQL.
- `ConsultationController` (validation, `ojt_company` required kapag naka-tick ang OJT), `Consultation` model, `ClinicHistory` (may bagong fields).
- Batch Medical Clearance: `MedicalClearance` model, `MedicalClearanceController` (`index`, `store`, `destroy`, may audit log, nililinis ang mga pangalan: trim, walang duplicate, A-Z), mga ruta `GET/POST /nurse/medical-clearances` at `DELETE /nurse/medical-clearances/{id}`.

### 6. Student Health Records
- Mga bagong inner tab: **Medical Cert (Sick)** (may Days of Attendance) at **Medical Cert (OJT)** (may OJT Company); may print. Lumalabas din sa detalye ng record at sa `ClinicRecordList`.

### 7. Consultation page: inner tabs
- Sa `NurseConsultation.jsx`: Clinic Queue card, tapos ang tab bar (sariling container) na **Individual Release** | **Batch Release** (`?tab=batch`).
- **Individual Release**: ang dating laman ng Consultation page (In consultation na listahan), at sa pinakababa ang **Past visits** (ang dating Patient History, `NurseRecords` na may prop na `embedded`). Walang search at filter; 4 na row bawat page; sortable na column headers (Student, Student ID, Course, Year, Section, Record type, Date; desc → asc → default); pagination na naka-center na may running count (`4 of 22`) gamit ang bagong `centered` na prop ng shared na `Pagination`; walang bilang sa pamagat.
- **Batch Release** (`BatchRelease.jsx`): form para sa Medical Clearance (Activity, Group/Section, Venue, petsa ng activity at certification, mga pangalan ng student na isa bawat linya o paste), live na numbered list, **Document Preview** na container (empty state hanggang i-click ang Preview; nasa loob ng page, hindi pop-up), at **Issued Medical Clearances** (View, Print, Delete na may kumpirmasyon). Ang mga pangalan ay mano-mano dahil wala pang master list.
- Ang hiwalay na **Documents** page ay ginawa muna at pagkatapos ay inalis (pinagsama dito). Inalis ang **Patient History** sa sidebar; ang `/nurse/records` ay nire-redirect na sa `/nurse/consultation`. Pagkatapos mag-save ng consultation, ang "View in Patient History" ay papunta sa Consultation page.

### 7b. Mga source file (inilipat sa `docs/templates/`)
- `CONSULTATION-FORM.docx`, `MEDCERT-OJT.xlsx`, `MEDCERT-SICK.xlsx`, `MEDICAL-LIABILITY-FORM.docx`, `BSCPE-Activity-at-Trimex-and-Lyceum-2026.docx`. Ang `MEDCERT-SICK.xlsx` ay may ikaapat na sheet na RX/prescription form na hindi pa nagagawa.

### 8. Files
- Binago: `QueuePatientModal.jsx`, `NurseQueue.jsx`, `ConsultationVisit.jsx`, `NurseConsultation.jsx`, `NurseRecords.jsx`, `RecordDirectory.jsx`, `StudentDirectory.jsx` (`Pagination` `centered`), `ClinicRecordList.jsx`, `HealthRecords.jsx`, `recordDocuments.js`, `App.jsx`, `nurseNavigation.js`, `nurseGreeting.js` (at test), `consultation-form.html`, `layout.html`, `print/README.md`, `DemoQueue.php`, `ConsultationController.php`, `Consultation.php`, `ClinicHistory.php`, `api.php`.
- Bago (untracked): `BatchRelease.jsx`, `medical-certificate-ojt.html`, `medical-certificate-sick.html`, `medical-clearance.html`, `cho-logo.jpeg`, `bagong-pilipinas-logo.png`, `signature-prieto.jpeg`, `MedicalClearance.php`, `MedicalClearanceController.php`, ang tatlong migration sa itaas, at `docs/templates/`.

### 9. Mga natitirang tanong
- Hindi pa nasusubukan sa browser: Step 1 Additional Information, ang bagong mga certificate (save, review, print), Batch Release, ang bagong tab sa Health Records, at ang sort at pagination ng Past visits.
- Hindi pa na-run ang tatlong bagong migration sa Supabase.
- Ang mga edit sa Additional Information ay hindi nagsa-save sa student profile.
- Ang Medical Clearance ay gumagamit ng pirma ng nurse na naka-login at ng system letterhead, hindi ng header ng BSCPE docx.
- Ang RX/prescription na sheet ng `MEDCERT-SICK.xlsx` at ang filter ng course/section (kapag nagkaroon na ng master list) ay hindi pa nagagawa.

## November 9, 2026 - Session 1: Batch Release para sa Maraming Document (Registry, Wizard at Issued History)

Kasunod ng "November 8 - Session 2". Ang tanong: paano kung dumami ang batch documents (hindi lang Medical Clearance)? Walang naka-commit sa session na ito. Nag-build (`npx vite build`) at sinubukan ang backend gamit ang tinker; **hindi pa nasusubukan sa browser**.

### 1. Mga desisyon ng user
- Layout: listahan/pagpili ng document + form (hindi modal). Pagkatapos ay ginawang **wizard** ang paggawa, at ang **Issued** ay hiwalay na history tab (hindi kasama sa wizard).
- Students: **type/paste + search** ng registered student (naka-link sa account kapag pinili).
- Mga document: **flexible muna** (config-driven registry); Medical Clearance lang ang laman sa ngayon.

### 2. Backend
- Bagong table `batch_documents` (migration `2026_11_09_000001_create_batch_documents_table`, na-migrate sa lokal na MySQL): `id` uuid, `type` (index), `title`, `fields` json, `students` json (`[{name, student_id|null}]`), `issued_date` (index), `issued_by`, timestamps, softDeletes. Kinokopya ng migration ang mga lumang `medical_clearances` row (`type='clearance'`); wala pang laman ang luma kaya walang nakopya. Hindi tinanggal ang lumang table at routes (`/nurse/medical-clearances`), pero hindi na ginagamit ng frontend.
- `App\Models\BatchDocument`, `Nurse\BatchDocumentController` (`index` na may `?type` at `?q`, `store`, `destroy`, may audit log `batch_document_created/deleted`).
- `config/batch_documents.php`: bawat type ay may `label`, `title_field`, `date_field`, `rules`, `messages`. Ang `store` ay tumatanggi sa hindi kilalang type ("Choose a document."), nagva-validate ng `fields.*` ayon sa config, tinatapon ang hindi kilalang field, nililinis ang mga pangalan (trim, walang duplicate kahit iba ang case, A-Z), at tinatanggal ang `student_id` na hindi totoong student.
- Mga ruta: `GET/POST /nurse/batch-documents`, `DELETE /nurse/batch-documents/{id}`.

### 3. Frontend (`frontend/src/pages/Admin/Consultation/`)
- `batchDocuments.js`: ang **registry** (`BATCH_DOCUMENTS`: key, category, label, description, template, titleField, fields, `toRecord`, `summary`) at mga helper (`emptyFields`, `validateFields`, `trimFields`, `nurseLabel`, `formatDay`, `savedStudents`, `savedRecord`).
- `BatchRelease.jsx`: container na may dalawang **inner tab** (underline style): **New Document** | **Issued (n)**. Parehong naka-mount (`hidden`), kaya hindi nawawala ang laman ng wizard kapag tiningnan ang history. URL: `?tab=batch&view=issued`, `&doc=<key>`.
- `BatchWizard.jsx`: 4 na step na may stepper: **① Document → ② Details → ③ Students → ④ Preview**. Chine-check ang step bago mag-Next; puwedeng i-click ang stepper pabalik sa mga napuntahang step. Kapag nagpalit ng document, nare-reset ang fields pero naiiwan ang students. Sa Preview: buod (document, para saan, bilang ng students) + preview + **Save and Print**; pagka-save: **Print again**, **View issued**, **New document**.
- `BatchDocumentPicker.jsx`: mga card na naka-group by category; lalabas ang search kapag 6+ na ang documents; pag-click ay diretso sa Details.
- `BatchFieldsForm.jsx`: generic na form mula sa `fields` (text, date, textarea, select; required/optional, `span`).
- `BatchStudentList.jsx`: search (`GET /nurse/students/search`, debounced, "Last, First M.") + textarea; pinagsasama (`mergeStudents`), may "Linked" na badge.
- `BatchPreview.jsx`: iframe ng document (auto-fit ng height, `autoPrint`, `ref.print()`).
- `BatchHistory.jsx`: Issued table (Issued, Document, Details, Students; View, Print, Delete na may kumpirmasyon), search at type filter (lumalabas kapag 2+ type); preview sa ilalim ng table.
- `print/README.md`: bagong seksyong **"Adding a batch document"**.

### 4. Paano magdagdag ng batch document (walang DB change)
1. Template HTML sa `public/templates/print/` + entry sa `DOCUMENTS` (`recordDocuments.js`).
2. Entry sa `batchDocuments.js` (key, category, label, fields, `toRecord`, `titleField`).
3. Parehong key at rules sa `backend/config/batch_documents.php` (`title_field` = `titleField`).

### 5. Files
- Binago: `BatchRelease.jsx`, `backend/routes/api.php`, `frontend/public/templates/print/README.md`.
- Bago (untracked): `BatchWizard.jsx`, `BatchHistory.jsx`, `BatchPreview.jsx`, `BatchDocumentPicker.jsx`, `BatchFieldsForm.jsx`, `BatchStudentList.jsx`, `batchDocuments.js`, `BatchDocument.php`, `BatchDocumentController.php`, `config/batch_documents.php`, ang migration sa itaas.

### 6. Mga natitirang tanong
- Subukan sa browser: wizard (lahat ng step, mobile stepper), student search at Linked badge, Save and Print, Issued tab (filter, View/Print, Delete).
- Hindi pa na-run ang bagong migration sa Supabase.
- Kailan tatanggalin ang lumang `medical_clearances` table, model, controller at routes.
- Wala pang ESLint config ang frontend (`eslint.config.*`), kaya hindi ma-lint.
- Ang ibang batch documents (wala pang listahan); subukan ang grouping at search kapag may pangalawa na.
