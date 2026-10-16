import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STUDENT_PRIMARY_LINKS, isStudentNavActive, studentPageTitle } from './studentPortalNavigation.js';

test('student primary navigation contains exactly the five approved destinations', () => {
  assert.deepEqual(STUDENT_PRIMARY_LINKS.map(item => item.label), ['Appointments', 'QR Code', 'Records', 'Profile', 'Settings']);
  assert.equal(new Set(STUDENT_PRIMARY_LINKS.map(item => item.path)).size, 5);
  assert.equal(STUDENT_PRIMARY_LINKS.some(item => /dashboard|alerts|assistant/.test(item.path)), false);
});
test('profile owns health profile without adding primary destinations', () => {
  for (const path of ['/student/profile', '/student/profile/edit', '/student/health-profile']) {
    assert.equal(isStudentNavActive(path, '/student/profile'), true);
  }
  /* Settings is its own tab now, not part of the Profile group. */
  assert.equal(isStudentNavActive('/student/settings', '/student/profile'), false);
  assert.equal(isStudentNavActive('/student/settings', '/student/settings'), true);
  assert.equal(isStudentNavActive('/student/qr-extra', '/student/qr'), false);
  assert.equal(isStudentNavActive('/student/appointments', '/student/profile'), false);
});
test('shared header titles match existing routes', () => {
  assert.equal(studentPageTitle('/student/qr'), 'QR Code');
  assert.equal(studentPageTitle('/student/alerts'), 'Notifications');
  assert.equal(studentPageTitle('/student/health-profile'), 'Health Profile');
});
