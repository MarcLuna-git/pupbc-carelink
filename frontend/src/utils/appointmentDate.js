export const CLINIC_TIMEZONE = 'Asia/Manila';

export const clinicDate = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

export const appointmentDate = (value) => {
  if (typeof value !== 'string') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : '';
  }
  // Older API responses encoded Manila midnight as a UTC instant. Convert the
  // instant back to the clinic day; slicing its UTC prefix loses a calendar day.
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : clinicDate(date);
  }
  return '';
};

export const formatAppointmentDate = (value, options = {}) => {
  const day = appointmentDate(value);
  if (!day) return 'N/A';
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', ...options, timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
};

export const appointmentTime = (value, time) => {
  const day = appointmentDate(value);
  const match = typeof time === 'string' && time.match(/^(\d{1,2}):(\d{2})\s(AM|PM)$/i);
  if (!day || !match || +match[1] < 1 || +match[1] > 12 || +match[2] > 59) return null;
  const hour = (+match[1] % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return new Date(`${day}T${String(hour).padStart(2, '0')}:${match[2]}:00+08:00`);
};

export const isClinicSunday = (value) => {
  const day = appointmentDate(value);
  return Boolean(day) && new Date(`${day}T00:00:00Z`).getUTCDay() === 0;
};

export const groupAppointments = (appointments, now = new Date()) => {
  const today = clinicDate(now);
  const approved = appointments.filter((item) => item.status === 'approved')
    .sort((a, b) => (appointmentTime(a.appointment_date, a.time_slot)?.getTime() || 0)
      - (appointmentTime(b.appointment_date, b.time_slot)?.getTime() || 0));
  return {
    today: approved.filter((item) => appointmentDate(item.appointment_date) === today),
    upcoming: approved.filter((item) => appointmentDate(item.appointment_date) > today),
  };
};
