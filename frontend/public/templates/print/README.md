# Printable clinic templates

These files are the printouts made by **Print / Preview** in the nurse Consultation page and the student Health Records page. Edit them like normal HTML and CSS; no build step is needed. Reload the page and print again to see a change.

| File | What it is |
|---|---|
| `print.css` | The styles for `layout.html` and every document template. Put new styles here, scoped to the document's wrapper class (for example `.ojt`): the site's Content-Security-Policy blocks `<style>` blocks and `style=""` attributes in the templates. |
| `paper-a4.css` | A4 portrait paper. Linked after `print.css` for the documents marked `paper: 'a4'` in `DOCUMENTS` (`recordDocuments.js`), which is the Consultation Form; the others print on short bond paper (Letter). |
| `layout.html` | The page around every document: the link to `print.css`, the PUP letterhead (logo, university and campus names, clinic name), the issue date and reference, and the page box. The document goes where `{{{content}}}` is. |
| `pup-logo.png` | The logo in the letterhead. Replace it with an image of the same name to change it. |
| `cho-logo.jpeg` | The City Health Office (Lungsod ng Biñan) logo, shown on the right of the letterhead of the OJT certificate. |
| `bagong-pilipinas-logo.png` | The Bagong Pilipinas logo, shown on the right of the letterhead of the Medical Liability Form. |
| `signature-prieto.jpeg` | The physician's signature, printed above the name on the Consultation Form and the OJT certificate. |
| `consultation-form.html` | The Consultation Form (also used for emergency encounter records). |
| `medical-certificate.html` | The Medical Certificate. |
| `medical-certificate-sick.html` | The Medical Certificate (Sick), the optional illness certificate with the days of medical attendance, released from a consultation. |
| `medical-clearance.html` | The Medical Clearance, one certification for a batch of students (nurse portal → Consultation → Batch Release). |
| `medical-certificate-ojt.html` | The Medical Certificate (OJT), the optional OJT fitness certificate released from a consultation. |
| `medical-liability-form.html` | The Medical Liability Form (optional, released from a consultation). |
| `student-profile.html` | The Student Health Profile, printed from the nurse Students page (a student's record > Print profile). |

## The in-app viewer

**View** on a consultation record (nurse Patient History and student Health Records) shows the Consultation Form in a document viewer (`src/components/DocumentViewerModal.jsx`): the same filled-in template, split into paper-sized sheets. Its **Print** prints this template as is, and **Download PDF** redraws the sheets as a PDF (`src/utils/documentPdf.js`). The PDF writer draws text, borders, the ruled lines of `.block .value` and images; a new kind of decoration (a background picture, list numbers) would need to be added there to show in the PDF.

## Adding a batch document

Batch Release (nurse portal → Consultation → Batch Release) lists every document issued for a group of students. To add one:

1. Add the template here (for example `sports-clearance.html`) and an entry in `DOCUMENTS` in `src/pages/Student/HealthRecords/recordDocuments.js` that turns a record into its placeholders.
2. Add an entry to `src/pages/Admin/Consultation/batchDocuments.js`: its key, category, label, fields, and `toRecord`. The wizard's document cards and the details form are drawn from it.
3. Add the same key with its validation rules to `backend/config/batch_documents.php`.

No database change is needed: the details are saved as JSON in `batch_documents.fields`.

To use your own design, replace the HTML and keep the placeholders you need. Images can go in this folder and be linked as `{{template_dir}}your-image.png` (the print window needs the full address, which `template_dir` gives).

## Placeholders

- `{{name}}` puts in a value as plain text.
- `{{#name}} ... {{/name}}` shows the part in between only when `name` has a value.
- `{{^name}} ... {{/name}}` shows the part in between only when `name` is empty.
- `{{{content}}}` (three braces) is only for `layout.html`, where the document is inserted.

Both documents always print every row and leave a field with no value blank. In a sentence, wrap a placeholder in an element with `class="fill"` (for example `<strong class="fill">{{complaint}}</strong>`) so a blank prints as a line to write on.

### Every document

`clinic_name`, `template_dir` (full address of this folder, for images), `issued_date`, `reference`, `file_title` (the default file name in "Save as PDF"), `student_name`, `student_id`, `student_program`, `student_age`, `student_address`, `student_contact`, `emergency_name` (contact person in case of emergency, with relationship), `emergency_person` (the contact person's name only), `emergency_relationship`, `emergency_contact`, `staff_name`, `staff_role`

### `medical-certificate.html`

`visit_date`, `complaint`, `findings` (the impression), `recommendation` (other remarks: follow-up advice, empty when none), `certificate_ref` (Control No.), `rest_days` (always empty for now; written by hand), `clinic_address`, `clinic_email`

### `medical-certificate-sick.html`

`certificate_ref` (Control No.), `visit_date`, `findings` (the impression), `rest_days` (days of medical attendance, empty when not entered), `recommendation` (other remarks: follow-up advice), `student_age`; `issued_date` is the visit date here

### `medical-clearance.html`

A batch document (see "Adding a batch document"). `issued_date` (date of the certification), `activity`, `venue`, `activity_date`, `group` (for example BSCPE, may be empty), `student_count`, and `{{{student_list}}}` (three braces: a ready-made numbered list of the students' names, escaped). No student placeholders apply, since the names are typed in.

### `medical-certificate-ojt.html`

`certificate_ref` (Control No.), `ojt_company` (where the student will do On the Job Training), `student_sex` (M or F), `visit_date`; `issued_date` is the visit date here

### `medical-liability-form.html`

`activity` (the activity the student declares they are fit to join), `visit_date`; `issued_date` is the visit date here

### `student-profile.html`

`document_title`, `student_birthday`, `student_sex`, `student_email`, and `{{{health_sections}}}` (three braces: ready-made HTML for the health profile, one heading per group, listing only the answers that were filled in).

### `consultation-form.html`

| Placeholder | Value |
|---|---|
| `document_title` | "Consultation Form" or "Emergency Encounter Form" |
| `is_emergency` | Set for emergency encounters |
| `visit_datetime` | Date and time of the visit |
| `complaint` | Chief complaint (or the emergency reason) |
| `history` | History / present illness |
| `symptoms` | Symptoms (emergency records) |
| `service` | Appointment service |
| `vital_bp`, `vital_hr`, `vital_temp`, `vital_rr`, `vital_o2` | Vital signs |
| `diagnosis` | Diagnosis / findings |
| `assessment` | Nursing assessment |
| `interventions` | Nursing interventions |
| `treatment` | Treatment / plan |
| `medicines` | Medicines dispensed (one per line) |
| `intervention` | Emergency intervention |
| `disposition` | Emergency disposition |
| `follow_up` | "Required — date" or "Not required" |
| `medical_certificate` | Certificate reference when one was issued, otherwise "Not issued" |
