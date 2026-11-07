/*
 * One row of today's clinic queue (GET /nurse/queue/checkins), shared by the Queue page and the
 * Consultation page so both read the same fields.
 */
export const toQueueRow = (c, demoUserIds = []) => ({
  id: c.user?.student_id || c.student_id || 'N/A',
  user_id: c.user_id,
  name: (c.user?.first_name || '') + ' ' + (c.user?.last_name || ''),
  appointment: c.appointment?.service || 'Scheduled visit',
  status: c.status,
  triage: c.triage,
  complaint: c.triage?.chief_complaint || c.chief_complaint || c.appointment?.concern || '',
  checkin_id: c.id,
  appointment_id: c.appointment_id,
  priority: c.triage?.priority || 'LOW',
  queue_number: c.queue_number || 'N/A',
  called_at: c.called_at || null,
  check_in_time: c.check_in_time || c.checked_in_at || c.created_at || null,
  time_slot: c.appointment?.time_slot || '—',
  appointment_details: c.appointment || {},
  sync_version: c.sync_version,
  // Queue list → Options → Developer tools demo patient.
  demo: demoUserIds.includes(c.user_id),
});

export const queueRowsFrom = (response) => {
  const data = response.data.data;
  const checkins = Array.isArray(data) ? data : (data?.data || []);
  return checkins.map(c => toQueueRow(c, response.data.demo_user_ids || []));
};

// The Consultation page for one visit; the queue sends the nurse here once the patient arrived.
export const consultationPath = (checkinId) => `/nurse/consultation?visit=${encodeURIComponent(checkinId)}`;
