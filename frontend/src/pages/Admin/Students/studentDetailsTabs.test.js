import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('student record popup: five tabs, no separate Consultations tab, history split by type', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

  try {
    const { StudentDetailsModal } = await server.ssrLoadModule('/src/pages/Admin/Students/StudentDetailsModal.jsx');
    const student = { id: 'student-1', student_id: '2026-00001-BN-0', first_name: 'Student', last_name: 'Test', student_profile: {}, health_profile: null };
    const history = [
      { id: 'c1', record_type: 'consultation', occurred_at: '2026-10-20T08:00:00Z', chief_complaint: 'Headache complaint' },
      { id: 'e1', record_type: 'emergency', occurred_at: '2026-10-21T08:00:00Z', reason: 'Fainting reason' },
    ];
    const render = tab => renderToStaticMarkup(React.createElement(StudentDetailsModal, {
      student, loading: false, error: '', appointments: [], history, tab,
      onTab: () => {}, onClose: () => {}, onEmergency: () => {}, onArchive: () => {}, onRestore: () => {},
      emergencyOpen: false, archiveOpen: false, statusSaving: false,
    }));

    const html = render('Overview');
    const tabs = [...html.matchAll(/role="tab"[^>]*>([^<]+)</g)].map(match => match[1]);
    assert.deepEqual(tabs, ['Overview', 'Health', 'Appointments', 'Clinic History', 'Emergencies', 'Documents']);
    assert.doesNotMatch(html, /Consultations/);
    // The student's profile can be printed from the popup.
    assert.match(html, /Print profile/);

    // Documents (x-rays, lab results, prescriptions) live in the record now, not in a separate Files popup.
    const documents = render('Documents');
    assert.match(documents, /Add a document/);
    assert.match(documents, /reduced to 200 KB automatically/);

    // A fixed-height popup: header, tabs and footer do not scroll, only the body does.
    assert.match(html, /h-\[min\(46rem,calc\(100dvh-2rem\)\)\]/);
    assert.match(html, /id="student-tabpanel"[^>]*class="[^"]*overflow-y-auto/);

    const all = render('Clinic History');
    assert.match(all, /Headache complaint/);
    assert.match(all, /Fainting reason/);
    const emergencies = render('Emergencies');
    assert.match(emergencies, /Fainting reason/);
    assert.doesNotMatch(emergencies, /Headache complaint/);
  } finally {
    await server.close();
  }
});
