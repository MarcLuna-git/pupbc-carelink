import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NURSE_PAGE_HEADERS, nurseHeaderFor } from './nurseGreeting.js';
import { NURSE_NAV_ITEMS } from '../layouts/NurseLayout/nurse-shell/nurseNavigation.js';

test('every nurse page in the sidebar has a title and purpose for the header bar', () => {
  for (const { path, label } of NURSE_NAV_ITEMS) {
    const header = nurseHeaderFor(path, { first_name: 'Jane' }, new Date(2026, 9, 28, 10));
    assert.ok(header, `${label} (${path}) has no header`);
    assert.ok(header.title && header.title.trim(), `${label} has no title`);
    assert.ok(header.note && header.note.trim().length > 20, `${label} has no purpose line`);
  }
});

test('the dashboard header is the greeting, other pages keep their fixed title', () => {
  assert.equal(nurseHeaderFor('/nurse/dashboard', { first_name: 'Jane' }, new Date(2026, 9, 28, 10)).title, 'Good Morning, Nurse Jane!');
  assert.equal(nurseHeaderFor('/nurse/dashboard', { first_name: 'Jane' }, new Date(2026, 9, 28, 19)).title, 'Good Evening, Nurse Jane!');
  assert.equal(nurseHeaderFor('/nurse/appointments', null).title, 'Appointments');
  assert.equal(NURSE_PAGE_HEADERS['/nurse/consultation'].title, 'Consultation');
  // Patient History no longer has its own page: it is part of Consultation → Individual Release.
  assert.equal(NURSE_PAGE_HEADERS['/nurse/records'], undefined);
});

test('a page that is not listed has no header', () => {
  assert.equal(nurseHeaderFor('/nurse/unknown', null), null);
});
