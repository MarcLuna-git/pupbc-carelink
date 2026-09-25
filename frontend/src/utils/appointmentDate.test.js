import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentDate, appointmentTime, clinicDate, formatAppointmentDate, groupAppointments, isClinicSunday } from './appointmentDate.js';

for (const timezone of ['Asia/Manila', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
  test(`calendar dates and clinic categories are stable in ${timezone}`, () => {
    const previous = process.env.TZ;
    process.env.TZ = timezone;
    try {
      for (const day of ['2026-09-24', '2026-09-29']) {
        assert.equal(appointmentDate(day), day); // date input -> payload
        let edited = day;
        for (let i = 0; i < 4; i++) {
          const legacyResponse = new Date(`${edited}T00:00:00+08:00`).toISOString();
          edited = appointmentDate(legacyResponse); // response -> edit -> submit
          assert.equal(edited, day);
        }
        assert.equal(formatAppointmentDate(day), `Sep ${Number(day.slice(-2))}, 2026`);
        assert.equal(appointmentTime(day, '8:00 AM').toISOString(), `${day}T00:00:00.000Z`);
      }
      const items = [
        { id: 'tomorrow', status: 'approved', appointment_date: '2026-09-24', time_slot: '8:00 AM' },
        { id: 'later', status: 'approved', appointment_date: '2026-09-29', time_slot: '8:00 AM' },
        { id: 'today', status: 'approved', appointment_date: '2026-09-23', time_slot: '8:00 AM' },
        { id: 'pending', status: 'pending', appointment_date: '2026-09-24', time_slot: '8:00 AM' },
      ];
      let groups = groupAppointments(items, new Date('2026-09-23T15:59:59Z'));
      assert.deepEqual(groups.today.map((a) => a.id), ['today']);
      assert.deepEqual(groups.upcoming.map((a) => a.id), ['tomorrow', 'later']);
      groups = groupAppointments(items, new Date('2026-09-23T16:00:00Z'));
      assert.deepEqual(groups.today.map((a) => a.id), ['tomorrow']);
      assert.deepEqual(groups.upcoming.map((a) => a.id), ['later']);
      assert.equal(clinicDate(new Date('2026-09-23T16:00:00Z')), '2026-09-24');
      assert.equal(isClinicSunday('2026-09-27'), true);
      assert.equal(isClinicSunday('2026-09-28'), false);
      assert.equal(appointmentDate('2026-02-30'), '');
      assert.equal(appointmentTime('2026-09-24', '13:00 PM'), null);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
}
