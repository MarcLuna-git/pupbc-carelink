# Printable clinic templates

These files are the printouts made by **Print / Preview** in the nurse Consultation page and the student Health Records page. Edit them like normal HTML and CSS; no build step is needed. Reload the page and print again to see a change.

| File | What it is |
|---|---|
| `layout.html` | The page around every document: the `<style>` block, the header (logo text, clinic name, issue date, reference) and the page box. The document goes where `{{{content}}}` is. |
| `consultation-form.html` | The Consultation Form (also used for emergency encounter records). |
| `medical-certificate.html` | The Medical Certificate. |

To use your own design, replace the HTML and keep the placeholders you need. Images can go in this folder and be linked as `/templates/print/your-logo.png`.

## Placeholders

- `{{name}}` puts in a value as plain text.
- `{{#name}} ... {{/name}}` shows the part in between only when `name` has a value.
- `{{^name}} ... {{/name}}` shows the part in between only when `name` is empty.
- `{{{content}}}` (three braces) is only for `layout.html`, where the document is inserted.

A placeholder with no value prints `Not recorded` (vital signs print `—`).

### Every document

`clinic_name`, `issued_date`, `reference`, `file_title` (the default file name in "Save as PDF"), `student_name`, `student_id`, `student_program`, `staff_name`, `staff_role`

### `medical-certificate.html`

`visit_date`, `complaint`, `findings`, `recommendation` (follow-up advice, empty when none), `certificate_ref`

### `consultation-form.html`

| Placeholder | Value |
|---|---|
| `document_title` | "Consultation Record" or "Emergency Encounter Record" |
| `is_emergency` | Set for emergency encounters |
| `visit_datetime` | Date and time of the visit |
| `complaint` | Chief complaint (or the emergency reason) |
| `history` | History / present illness |
| `symptoms` | Symptoms (emergency records) |
| `service` | Appointment service |
| `has_vitals` | Set when any vital sign was taken |
| `vital_bp`, `vital_hr`, `vital_temp`, `vital_rr`, `vital_o2` | Vital signs |
| `diagnosis` | Diagnosis / findings |
| `assessment` | Nursing assessment |
| `interventions` | Nursing interventions |
| `treatment` | Treatment / plan |
| `medicines` | Medicines dispensed (one per line) |
| `intervention` | Emergency intervention |
| `disposition` | Emergency disposition |
| `follow_up` | "Required — date" or "Not required" |
| `medical_certificate` | Certificate reference when one was issued |
