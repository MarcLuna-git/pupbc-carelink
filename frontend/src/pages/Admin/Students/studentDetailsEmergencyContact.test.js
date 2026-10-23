import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('nurse Overview shows one emergency-contact source without changing stored phones', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

  try {
    const { StudentDetailsModal } = await server.ssrLoadModule('/src/pages/Admin/Students/StudentDetailsModal.jsx');
    const legacy = { guardian_name: 'Legacy Name', guardian_relationship: 'Aunt', guardian_contact: '+639111111111' };
    const base = { id: 'student-1', first_name: 'Student', last_name: 'Test', student_profile: legacy };
    const contact = student => {
      const html = renderToStaticMarkup(React.createElement(StudentDetailsModal, {
        student, loading: false, error: '', appointments: [], history: [], tab: 'Overview',
        onTab: () => {}, onClose: () => {}, onEmergency: () => {}, onArchive: () => {}, onRestore: () => {},
        emergencyOpen: false, archiveOpen: false, statusSaving: false,
      }));
      const section = html.match(/<h3[^>]*>Emergency contact<\/h3>(.*?)<\/section>/s)?.[1];
      assert.ok(section, 'Overview emergency contact section renders');
      assert.match(section, /<dt[^>]*>full name<\/dt>/);
      assert.match(section, /<dt[^>]*>relationship<\/dt>/);
      assert.match(section, /<dt[^>]*>phone number<\/dt>/);
      return section;
    };

    const health = contact({ ...base, health_profile: {
      emergency_name: 'Health Name', emergency_relationship: 'Mother', emergency_phone: '09123456789',
    } });
    for (const value of ['Health Name', 'Mother', '09123456789']) assert.ok(health.includes(value), value);
    for (const value of Object.values(legacy)) assert.ok(!health.includes(value), value);

    for (const student of [base, { ...base, health_profile: null }]) {
      const fallback = contact(student);
      for (const value of Object.values(legacy)) assert.ok(fallback.includes(value), value);
    }

    const blankHealth = contact({ ...base, health_profile: {
      emergency_name: '  ', emergency_relationship: '', emergency_phone: null,
    } });
    for (const value of Object.values(legacy)) assert.ok(blankHealth.includes(value), value);

    const partialHealth = contact({ ...base, health_profile: {
      emergency_name: 'Health Name', emergency_relationship: '  ', emergency_phone: null,
    } });
    assert.match(partialHealth, /Health Name/);
    assert.equal(partialHealth.match(/Not provided/g)?.length, 2);
    for (const value of Object.values(legacy)) assert.ok(!partialHealth.includes(value), value);

    const noContact = contact({ ...base, student_profile: {}, health_profile: null });
    assert.equal(noContact.match(/Not provided/g)?.length, 3);

    const international = contact({ ...base, health_profile: { emergency_phone: '+639123456789' } });
    assert.match(international, /\+639123456789/);
    assert.doesNotMatch(international, /Legacy Name|\+639111111111/);
  } finally {
    await server.close();
  }
});
