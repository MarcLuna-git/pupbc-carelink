# Printable clinic templates

These files are the printouts made by **Print / Preview** in the nurse Consultation page and the student Health Records page. Edit them like normal HTML and CSS; no build step is needed. Reload the page and print again to see a change.

| File | What it is |
|---|---|
| `layout.html` | The page around every document: the `<style>` block, the PUP letterhead (logo, university and campus names, clinic name), the issue date and reference, and the page box. The document goes where `{{{content}}}` is. |
| `pup-logo.png` | The logo in the letterhead. Replace it with an image of the same name to change it. |
| `consultation-form.html` | The Consultation Form (also used for emergency encounter records). |
| `medical-certificate.html` | The Medical Certificate. |
| `student-profile.html` | The Student Health Profile, printed from the nurse Students page (a student's record > Print profile). |

To use your own design, replace the HTML and keep the placeholders you need. Images can go in this folder and be linked as `{{template_dir}}your-image.png` (the print window needs the full address, which `template_dir` gives).

## Placeholders

- `{{name}}` puts in a value as plain text.
- `{{#name}} ... {{/name}}` shows the part in between only when `name` has a value.
- `{{^name}} ... {{/name}}` shows the part in between only when `name` is empty.
- `{{{content}}}` (three braces) is only for `layout.html`, where the document is inserted.

Both documents always print every row and leave a field with no value blank. In a sentence, wrap a placeholder in an element with `class="fill"` (for example `<strong class="fill">{{complaint}}</strong>`) so a blank prints as a line to write on.

### Every document

`clinic_name`, `template_dir` (full address of this folder, for images), `issued_date`, `reference`, `file_title` (the default file name in "Save as PDF"), `student_name`, `student_id`, `student_program`, `student_age`, `student_address`, `student_contact`, `emergency_name` (contact person in case of emergency, with relationship), `emergency_contact`, `staff_name`, `staff_role`

### `medical-certificate.html`

`visit_date`, `complaint`, `findings` (the impression), `recommendation` (other remarks: follow-up advice, empty when none), `certificate_ref` (Control No.), `rest_days` (always empty for now; written by hand), `clinic_address`, `clinic_email`

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
