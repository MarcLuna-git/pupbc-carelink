<?php

/*
 * Documents the nurse can issue for a group of students (Consultation → Batch Release).
 * Each key must match an entry in frontend/src/pages/Admin/Consultation/batchDocuments.js.
 *
 *   label        Shown in messages and the audit log.
 *   title_field  The field shown as the document's title in the issued list.
 *   date_field   The field saved as the issue date (for sorting).
 *   rules        Validation for each field (sent as fields.<name>).
 *   messages     Optional custom messages, keyed by field and rule (e.g. 'activity.required').
 */
return [
    'clearance' => [
        'label' => 'Medical Clearance',
        'title_field' => 'activity',
        'date_field' => 'certified_date',
        'rules' => [
            'activity' => 'required|string|max:191',
            'venue' => 'required|string|max:191',
            'group_label' => 'nullable|string|max:100',
            'activity_date' => 'required|date',
            'certified_date' => 'required|date',
        ],
        'messages' => [
            'activity.required' => 'Enter the activity.',
            'venue.required' => 'Enter the venue.',
            'activity_date.required' => 'Enter the date of the activity.',
            'certified_date.required' => 'Enter the date of the certification.',
        ],
    ],
];
