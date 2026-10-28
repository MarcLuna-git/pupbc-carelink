import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('clinic records: a plain list, and a sheet that shows only what was recorded', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

  try {
    const { default: ClinicRecordList, ClinicRecordSheet } = await server.ssrLoadModule('/src/components/ClinicRecordList.jsx');
    const consultation = {
      id: 'c1', record_type: 'consultation', occurred_at: '2026-10-24T06:14:19Z', status: 'completed',
      chief_complaint: 'Difficulty breathing',
      vital_signs: { bp: '120/80', hr: '75', rr: '20', temp: '36.5', o2_sat: '' },
      history_present_illness: 'Since this morning', nursing_assessment: 'Alert and oriented', nursing_interventions: 'Advised rest',
      treatment_plan: null, general_remarks: '', medical_certificate: false, follow_up_required: true, follow_up_date: '2026-10-29',
      nurse: { first_name: 'Jane', last_name: 'Doe' },
      appointment: { service: 'Consultation', appointment_date: '2026-10-24T00:00:00.000000Z', time_slot: '2:00 PM' },
      triage: { severity: 'mild', priority: 'LOW', red_flags: ['none'], notes: null },
    };
    const emergency = { id: 'e1', record_type: 'emergency', occurred_at: '2026-10-25T02:00:00Z', reason: 'Fainting', symptoms: 'Dizzy', assessment: null, intervention: 'Rested', disposition: '', notes: 'Told the adviser', nurse: { first_name: 'Jane', last_name: 'Doe' } };

    const sheet = renderToStaticMarkup(React.createElement(ClinicRecordSheet, { record: consultation }));
    for (const shown of ['Chief complaint', 'Difficulty breathing', 'Blood pressure', '120/80 mmHg', 'Heart rate', '75 bpm', 'Temperature', '36.5 °C',
      'History / present illness', 'Since this morning', 'Nursing assessment', 'Alert and oriented', 'Nursing interventions', 'Advised rest',
      'Follow-up', 'Needed on Oct 29, 2026', 'Appointment', '2:00 PM', 'Kiosk triage', 'Severity: mild', 'Recorded by', 'Nurse Jane Doe']) {
      assert.ok(sheet.includes(shown), `sheet should show "${shown}"`);
    }
    // What was not recorded is left out rather than shown as an empty field.
    for (const hidden of ['Treatment / plan', 'General remarks', 'Medical certificate', 'Oxygen saturation', 'Not recorded', 'Not provided', 'Red flags']) {
      assert.ok(!sheet.includes(hidden), `sheet should not show "${hidden}"`);
    }

    const emergencySheet = renderToStaticMarkup(React.createElement(ClinicRecordSheet, { record: emergency }));
    for (const shown of ['Reason', 'Fainting', 'Symptoms', 'Dizzy', 'Intervention', 'Rested', 'Notes', 'Told the adviser']) assert.ok(emergencySheet.includes(shown), shown);
    for (const hidden of ['Assessment', 'Disposition']) assert.ok(!emergencySheet.includes(hidden), `emergency sheet should not show "${hidden}"`);

    const list = renderToStaticMarkup(React.createElement(ClinicRecordList, { records: [emergency, consultation] }));
    assert.doesNotMatch(list, /<details/);
    assert.equal((list.match(/<button/g) || []).length, 2); // one row per record, each opens its sheet
    assert.match(list, /Emergency encounter/);
    assert.match(list, /Consultation/);
    assert.match(list, /Difficulty breathing/);
    assert.doesNotMatch(list, /Nursing assessment/); // the list is a summary; the sheet has the detail

    assert.match(renderToStaticMarkup(React.createElement(ClinicRecordList, { records: [], emptyText: 'Nothing yet.' })), /Nothing yet\./);
  } finally {
    await server.close();
  }
});
