import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Stethoscope,
  Shield,
  ChevronRight,
  FileText,
  Edit3,
  Info,
  Users,
} from 'lucide-react';
import api from '../../../services/api';
import { clinicDate as getLocalDateString, appointmentDate as normalizeDateValue, appointmentTime as parseAppointmentDateTime, isClinicSunday as isSunday, formatAppointmentDate as formatDate } from '../../../utils/appointmentDate';

const Skeleton = ({ className = '' }) => (
  <div
    className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl ${className}`}
  />
);

const Appointments = () => {
  const user = JSON.parse(
    localStorage.getItem('user') || '{}'
  );

  const healthProfileDone =
    Boolean(user?.profile?.health_profile_completed || user?.health_profile_completed);

  const [showForm, setShowForm] = useState(true);
  const [bookingStep, setBookingStep] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const [pageLoading, setPageLoading] = useState(() => {
    try {
      return (
        JSON.parse(
          localStorage.getItem(
            'carelink.student.appointments'
          ) || '[]'
        ).length === 0
      );
    } catch {
      return true;
    }
  });

  const [confirmCancel, setConfirmCancel] =
    useState(null);

  const [
    selectedAppointment,
    setSelectedAppointment,
  ] = useState(null);

  const [message, setMessage] = useState('');

  const [messageType, setMessageType] =
    useState('success');

  const [appointments, setAppointments] =
    useState(() => {
      try {
        const cached = JSON.parse(
          localStorage.getItem(
            'carelink.student.appointments'
          ) || '[]'
        );

        return Array.isArray(cached)
          ? cached
          : [];
      } catch {
        return [];
      }
    });

  const [form, setForm] = useState({
    service: '',
    date: '',
    time: '',
    concern: '',
  });

  const [
    availableSlots,
    setAvailableSlots,
  ] = useState([]);

  const [
    slotsLoading,
    setSlotsLoading,
  ] = useState(false);

  const services = [
    'Consultation',
    'Medical Certificate',
    'Medical Clearance',
    'Follow-up Checkup',
    'Vaccination',
    'Other',
  ];

  const timeSlots = [
    '8:00 AM',
    '8:30 AM',
    '9:00 AM',
    '9:30 AM',
    '10:00 AM',
    '10:30 AM',
    '11:00 AM',
    '11:30 AM',
    '1:00 PM',
    '1:30 PM',
    '2:00 PM',
    '2:30 PM',
    '3:00 PM',
    '3:30 PM',
    '4:00 PM',
    '4:30 PM',
  ];

  const fetchAppointments =
    useCallback(async () => {
      try {
        const token =
          localStorage.getItem('token');

        const response = await api.get(
          '/student/appointments',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          const data =
            response.data.data;

          const normalized =
            Array.isArray(data)
              ? data
              : data?.data || [];

          setAppointments(
            normalized
          );

          localStorage.setItem(
            'carelink.student.appointments',
            JSON.stringify(
              normalized
            )
          );
        }
      } catch (err) {
        console.log(
          'Fetch appointments error:',
          err
        );
      } finally {
        setPageLoading(false);
      }
    }, []);

  const fetchAvailableSlots =
    useCallback(
      async (date) => {
        if (!date || isSunday(date)) {
          setAvailableSlots([]);
          return;
        }

        setSlotsLoading(true);

        try {
          const token =
            localStorage.getItem(
              'token'
            );

          const response =
            await api.get(
              `/student/available-slots?date=${date}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

          if (
            response.data.success
          ) {
            setAvailableSlots(
              response.data.data
                .slots || []
            );
          }
        } catch (err) {
          console.log(
            'Fetch slots error:',
            err
          );
        } finally {
          setSlotsLoading(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    if (
      showForm &&
      form.date &&
      !isSunday(form.date)
    ) {
      fetchAvailableSlots(
        form.date
      );

      const interval =
        setInterval(
          () =>
            fetchAvailableSlots(
              form.date
            ),
          30000
        );

      return () =>
        clearInterval(
          interval
        );
    }

    return undefined;
  }, [
    showForm,
    form.date,
    fetchAvailableSlots,
  ]);

  const statusRank = {
    pending: 0,
    approved: 1,
    completed: 2,
    cancelled: 3,
    rejected: 4,
    expired: 5,
  };

  const orderedAppointments = [...appointments].sort((a, b) => {
    const rankDifference =
      (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    const aDate =
      parseAppointmentDateTime(
        a.appointment_date,
        a.time_slot
      )?.getTime() || 0;

    const bDate =
      parseAppointmentDateTime(
        b.appointment_date,
        b.time_slot
      )?.getTime() || 0;

    if (['pending', 'approved'].includes(a.status)) {
      return aDate - bDate;
    }

    return bDate - aDate;
  });

  const pendingAppointments = orderedAppointments.filter(
    (appointment) => appointment.status === 'pending'
  );

  const primaryPending = pendingAppointments[0] || null;

  const filteredAppointments =
    filter === 'all'
      ? orderedAppointments
      : filter === 'past'
        ? orderedAppointments.filter((appointment) =>
            ['completed', 'cancelled', 'rejected', 'expired'].includes(
              appointment.status
            )
          )
        : orderedAppointments.filter(
            (appointment) => appointment.status === filter
          );

  const statusConfig = {
    approved: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-400',
      icon: CheckCircle,
    },

    pending: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-700 dark:text-yellow-400',
      icon: Clock,
    },

    completed: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-400',
      icon: CheckCircle,
    },

    cancelled: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-400',
      icon: XCircle,
    },

    rejected: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-400',
      icon: XCircle,
    },

    expired: {
      bg: 'bg-gray-100 dark:bg-gray-700/40',
      text: 'text-gray-600 dark:text-gray-300',
      icon: XCircle,
    },
  };

  const handleChange = (e) => {
    const {
      name,
      value,
    } = e.target;

    if (
      name === 'date' &&
      value &&
      isSunday(value)
    ) {
      setForm((current) => ({
        ...current,
        date: '',
        time: '',
      }));

      setAvailableSlots([]);
      setMessageType('error');
      setMessage(
        'The clinic is closed on Sundays. Please choose Monday to Saturday.'
      );

      setTimeout(
        () => setMessage(''),
        3000
      );

      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'date'
        ? { time: '' }
        : {}),
    }));

    if (
      name === 'date' &&
      value
    ) {
      fetchAvailableSlots(
        value
      );
    }
  };

  const getSlotInfo = (time) => {
    const slot =
      availableSlots.find(
        (item) =>
          item.time === time
      );

    if (!slot) {
      return {
        available: 10,
        booked: 0,
        isFull: false,
      };
    }

    return slot;
  };

  const getSlotColor = (time) => {
    const slot =
      getSlotInfo(time);

    if (slot.isFull) {
      return 'text-red-500';
    }

    if (
      slot.available <= 3
    ) {
      return 'text-yellow-500';
    }

    return 'text-green-500';
  };

  const getSlotBg = (time) => {
    const slot =
      getSlotInfo(time);

    if (slot.isFull) {
      return 'bg-red-50 dark:bg-red-900/10';
    }

    if (
      slot.available <= 3
    ) {
      return 'bg-yellow-50 dark:bg-yellow-900/10';
    }

    return '';
  };

  const handleEditClick = (
    appointment
  ) => {
    setSelectedAppointment(
      null
    );

    setForm({
      service:
        appointment.service ||
        '',
      date:
        normalizeDateValue(appointment.appointment_date) ||
        '',
      time:
        appointment.time_slot ||
        '',
      concern:
        appointment.concern ||
        '',
    });

    setEditingId(
      appointment.id
    );

    setBookingStep(1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      if (
        !form.service ||
        !form.date ||
        !form.time
      ) {
        setMessageType(
          'error'
        );

        setMessage(
          'Please fill all required fields.'
        );

        setTimeout(
          () =>
            setMessage(''),
          3000
        );

        return;
      }

      if (isSunday(form.date)) {
        setMessageType('error');
        setMessage(
          'The clinic is closed on Sundays. Please choose Monday to Saturday.'
        );

        setTimeout(
          () => setMessage(''),
          3000
        );

        return;
      }

      const slotInfo =
        getSlotInfo(
          form.time
        );

      if (
        slotInfo.isFull
      ) {
        setMessageType(
          'error'
        );

        setMessage(
          'This time slot is already full. Please select a different time.'
        );

        setTimeout(
          () =>
            setMessage(''),
          3000
        );

        return;
      }

      const selectedSlot =
        parseAppointmentDateTime(
          form.date,
          form.time
        );

      if (
        !selectedSlot ||
        Number.isNaN(
          selectedSlot.getTime()
        ) ||
        selectedSlot <
          new Date()
      ) {
        setMessageType(
          'error'
        );

        setMessage(
          'Please choose a present or future appointment time.'
        );

        setTimeout(
          () =>
            setMessage(''),
          3000
        );

        return;
      }

      setLoading(true);
      setMessage('');

      try {
        const token =
          localStorage.getItem(
            'token'
          );

        const payload = {
          service:
            form.service,

          appointment_date:
            form.date,

          time_slot:
            form.time,

          concern:
            form.concern ||
            '',
        };

        let response;

        if (editingId) {
          response =
            await api.put(
              `/student/appointments/${editingId}`,
              payload,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

          setMessageType(
            'success'
          );

          setMessage(
            'Appointment updated!'
          );
        } else {
          response =
            await api.post(
              '/student/appointments',
              payload,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

          setMessageType(
            'success'
          );

          setMessage(
            `Appointment booked! Ref: ${
              response.data.data
                ?.reference_number ||
              'APT-NEW'
            }`
          );
        }

        if (
          response.data.success
        ) {
          setShowForm(true);
          setBookingStep(1);
          setEditingId(null);

          setForm({
            service: '',
            date: '',
            time: '',
            concern: '',
          });

          setAvailableSlots(
            []
          );

          fetchAppointments();
        }
      } catch (err) {
        setMessageType(
          'error'
        );

        const validationErrors =
          err.response?.data
            ?.errors;

        const validationMessage =
          validationErrors
            ? Object.values(
                validationErrors
              )
                .flat()
                .join(' ')
            : '';

        setMessage(
          validationMessage ||
            err.response?.data
              ?.message ||
            (err.response
              ? `Failed to save appointment (HTTP ${err.response.status}).`
              : 'Cannot connect to the appointment service.')
        );
      } finally {
        setLoading(false);

        setTimeout(
          () =>
            setMessage(''),
          4000
        );
      }
    };

  const handleCancel =
    async () => {
      if (!confirmCancel) {
        return;
      }

      try {
        const token =
          localStorage.getItem(
            'token'
          );

        await api.patch(
          `/student/appointments/${confirmCancel}/cancel`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setMessageType(
          'success'
        );

        setMessage(
          'Appointment cancelled.'
        );

        setConfirmCancel(
          null
        );

        setSelectedAppointment(
          null
        );

        fetchAppointments();
      } catch (err) {
        setMessageType(
          'error'
        );

        setMessage(
          err.response?.data
            ?.message ||
            'Failed to cancel appointment.'
        );
      }

      setTimeout(
        () =>
          setMessage(''),
        3000
      );
    };

  if (!healthProfileDone) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="text-center max-w-md bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-100 dark:border-gray-700"
        >
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Health Profile Required
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            You must complete your Health Profile before booking appointments.
          </p>

          <Link
            to="/student/health-profile"
            className="inline-flex items-center space-x-2 mt-5 px-6 py-3 bg-maroon-800 text-white font-semibold rounded-2xl hover:bg-maroon-900 transition"
          >
            <span>
              Complete Health Profile
            </span>

            <AlertCircle className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="space-y-5 max-w-3xl mx-auto px-4 sm:px-0">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-40 mb-1" />
            <Skeleton className="h-4 w-28" />
          </div>

          <Skeleton className="h-10 w-24 rounded-2xl" />
        </div>

        <div className="flex gap-2">
          {[...Array(5)].map(
            (_, i) => (
              <Skeleton
                key={i}
                className="h-9 w-20 rounded-xl"
              />
            )
          )}
        </div>

        <div className="space-y-3">
          {[...Array(3)].map(
            (_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700"
              >
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>

                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-4 sm:px-0 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Appointments
          </h1>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {appointments.length}{' '}
            appointment
            {appointments.length !==
            1
              ? 's'
              : ''}
          </p>
        </div>


      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{
              opacity: 0,
              y: -10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -10,
            }}
            className={`p-4 rounded-2xl text-sm font-medium text-center ${
              messageType ===
              'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking is open by default. Keep My Appointments below at all times. */}
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 px-4 py-5 dark:border-gray-700 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingId ? 'Edit Appointment' : 'Book New Appointment'}
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {editingId
                  ? 'Update the details of your pending appointment.'
                  : 'Choose a service, pick your schedule, then review your request.'}
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setBookingStep(1);
                  setForm({ service: '', date: '', time: '', concern: '' });
                  setAvailableSlots([]);
                }}
                className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-white"
              >
                Cancel editing
              </button>
            )}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Booking progress">
            {[
              ['1', 'Service'],
              ['2', 'Schedule'],
              ['3', 'Review'],
            ].map(([number, label], index) => (
              <div key={number} className="min-w-0">
                <div className={`h-1.5 rounded-full ${bookingStep >= index + 1 ? 'bg-maroon-800' : 'bg-gray-200 dark:bg-gray-700'}`} />
                <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${bookingStep === index + 1 ? 'text-maroon-800 dark:text-maroon-300' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${bookingStep >= index + 1 ? 'bg-maroon-800 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    {bookingStep > index + 1 ? <CheckCircle className="h-3 w-3" /> : number}
                  </span>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} noValidate>
            {bookingStep === 1 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">What brings you to the clinic?</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select the service you need.</p>
                </div>
                <div className="max-w-xl">
                  <label htmlFor="appointment-service" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Service *</label>
                  <div className="relative">
                    <Stethoscope className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <select
                      id="appointment-service"
                      name="service"
                      value={form.service}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-maroon-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select Service</option>
                      {services.map((service) => <option key={service} value={service}>{service}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end border-t border-gray-100 pt-4 dark:border-gray-700">
                  <button
                    type="button"
                    disabled={!form.service}
                    onClick={() => setBookingStep(2)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-maroon-800 px-6 text-sm font-semibold text-white hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next: Choose Schedule <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {bookingStep === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Choose your appointment schedule</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select a date and an available time slot.</p>
                </div>
                <div className="flex items-start gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Clinic Hours</p>
                    <p className="mt-1">Morning: 8:00 AM – 12:00 PM | Lunch: 12:00 PM – 1:00 PM | Afternoon: 1:00 PM – 5:00 PM</p>
                    <p className="mt-1 font-semibold text-amber-700 dark:text-amber-300">Closed every Sunday.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="appointment-date" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Date *</label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        id="appointment-date"
                        type="date"
                        name="date"
                        value={form.date}
                        onChange={handleChange}
                        min={getLocalDateString()}
                        className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="appointment-time" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Time * {slotsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    </label>
                    <div className="relative">
                      <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <select
                        id="appointment-time"
                        name="time"
                        value={form.time}
                        onChange={handleChange}
                        disabled={!form.date || slotsLoading}
                        className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">{!form.date ? 'Choose date first' : 'Select Time'}</option>
                        {timeSlots.map((time) => {
                          const slot = getSlotInfo(time);
                          const slotDateTime = form.date ? parseAppointmentDateTime(form.date, time) : null;
                          const past = Boolean(slotDateTime) && slotDateTime < new Date();
                          const unavailable = past || slot.isFull;
                          return (
                            <option key={time} value={time} disabled={unavailable}>
                              {time}{form.date ? past ? ' (Past)' : slot.isFull ? ' (Full)' : ` (${slot.available}/10 slots)` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>
                {form.date && form.time && (
                  <div className="max-w-sm rounded-xl bg-gray-50 p-3 text-xs dark:bg-gray-700">
                    {(() => {
                      const slot = getSlotInfo(form.time);
                      return <span className={getSlotColor(form.time)}>{slot.available} of 10 slots currently available</span>;
                    })()}
                  </div>
                )}
                <div className="flex flex-wrap justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
                  <button type="button" onClick={() => setBookingStep(1)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">Back</button>
                  <button
                    type="button"
                    disabled={!form.date || !form.time || slotsLoading || getSlotInfo(form.time).isFull || !parseAppointmentDateTime(form.date, form.time) || parseAppointmentDateTime(form.date, form.time) < new Date()}
                    onClick={() => setBookingStep(3)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-maroon-800 px-6 text-sm font-semibold text-white hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next: Review <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {bookingStep === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Review your appointment</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Double-check your details before submitting to the clinic.</p>
                </div>
                <div className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-900 sm:grid-cols-2">
                  <div><p className="text-xs text-gray-500">Service</p><p className="mt-1 font-semibold text-gray-900 dark:text-white">{form.service}</p></div>
                  <div><p className="text-xs text-gray-500">Date</p><p className="mt-1 font-semibold text-gray-900 dark:text-white">{formatDate(form.date)}</p></div>
                  <div><p className="text-xs text-gray-500">Time</p><p className="mt-1 font-semibold text-gray-900 dark:text-white">{form.time}</p></div>
                  <div><p className="text-xs text-gray-500">Status after submission</p><p className="mt-1 font-semibold text-amber-700 dark:text-amber-300">Pending clinic approval</p></div>
                </div>
                <div>
                  <label htmlFor="appointment-reason" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Reason (optional)</label>
                  <textarea
                    id="appointment-reason"
                    name="concern"
                    value={form.concern}
                    onChange={handleChange}
                    rows={3}
                    maxLength={1000}
                    placeholder="Describe your concern..."
                    className="w-full resize-y rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex flex-wrap justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
                  <button type="button" onClick={() => setBookingStep(2)} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">Back</button>
                  <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-maroon-800 px-6 text-sm font-semibold text-white hover:bg-maroon-900 disabled:opacity-50">
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><CheckCircle className="h-4 w-4" /> {editingId ? 'Update Appointment' : 'Confirm Booking'}</>}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </section>

      {primaryPending && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10">
          <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-3 md:items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <Clock className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Pending Approval
                  </p>

                  {pendingAppointments.length > 1 && (
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      +{pendingAppointments.length - 1} more
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {primaryPending.service || 'Appointment'}
                  </span>

                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {formatDate(primaryPending.appointment_date, {
                      weekday: 'short',
                    })}
                  </span>

                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {primaryPending.time_slot || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedAppointment(primaryPending)}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-gray-800 dark:text-amber-200 dark:hover:bg-gray-700"
            >
              View Details
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              My Appointments
            </h2>

            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Pending requests are shown first.
            </p>
          </div>

          <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
            {[
              ['all', 'All'],
              [
                'pending',
                `Pending${pendingAppointments.length ? ` (${pendingAppointments.length})` : ''}`,
              ],
              ['approved', 'Upcoming'],
              ['past', 'Past'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === value
                    ? 'bg-maroon-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredAppointments.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />

            <p className="mt-3 font-medium text-gray-500 dark:text-gray-400">
              No appointments found
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/60">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Service</th>
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Queue</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredAppointments.map((appointment) => {
                    const config =
                      statusConfig[appointment.status] || statusConfig.pending;
                    const StatusIcon = config.icon;

                    return (
                      <tr
                        key={appointment.id}
                        className="transition hover:bg-gray-50 dark:hover:bg-gray-700/40"
                      >
                        <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                          {formatDate(appointment.appointment_date)}
                        </td>

                        <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {appointment.service || 'Appointment'}
                        </td>

                        <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {appointment.time_slot || 'N/A'}
                        </td>

                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            <span className="capitalize">
                              {appointment.status === 'pending'
                                ? 'Pending Approval'
                                : appointment.status}
                            </span>
                          </span>
                        </td>

                        <td className="px-5 py-3">
                          {appointment.queue?.queue_number ? (
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {appointment.queue.queue_number}
                              </p>

                              <p className="text-[10px] font-semibold uppercase text-gray-400">
                                {appointment.queue.queue_type || 'Queue'}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>

                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedAppointment(appointment)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-maroon-700 transition hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-900/20"
                          >
                            View
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-700 md:hidden">
              {filteredAppointments.map((appointment) => {
                const config =
                  statusConfig[appointment.status] || statusConfig.pending;
                const StatusIcon = config.icon;

                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => setSelectedAppointment(appointment)}
                    className="w-full p-4 text-left transition hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {appointment.service || 'Appointment'}
                        </p>

                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                          {formatDate(appointment.appointment_date)} ·{' '}
                          {appointment.time_slot || 'N/A'}
                        </p>

                        <span
                          className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          <span className="capitalize">
                            {appointment.status === 'pending'
                              ? 'Pending Approval'
                              : appointment.status}
                          </span>
                        </span>

                        <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                          {appointment.queue?.queue_number
                            ? `Queue ${appointment.queue.queue_number}`
                            : 'Queue assigned after clinic check-in'}
                        </p>
                      </div>

                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" />

          <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">
            Queue numbers are assigned after successful kiosk check-in and clinic triage. Use your CareLink QR only on the date of an approved appointment.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {selectedAppointment && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() =>
              setSelectedAppointment(
                null
              )
            }
          >
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.95,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                scale: 0.95,
              }}
              transition={{
                duration: 0.2,
              }}
              className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
              style={{
                maxHeight: '90vh',
              }}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span
                  className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    (
                      statusConfig[
                        selectedAppointment.status
                      ] ||
                      statusConfig.pending
                    ).bg
                  } ${
                    (
                      statusConfig[
                        selectedAppointment.status
                      ] ||
                      statusConfig.pending
                    ).text
                  }`}
                >
                  {(() => {
                    const Icon =
                      (
                        statusConfig[
                          selectedAppointment.status
                        ] ||
                        statusConfig.pending
                      ).icon;

                    return (
                      <Icon className="w-3.5 h-3.5" />
                    );
                  })()}

                  <span className="capitalize">
                    {
                      selectedAppointment.status
                    }
                  </span>
                </span>

                <button
                  onClick={() =>
                    setSelectedAppointment(
                      null
                    )
                  }
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div
                className="overflow-y-auto px-5 pb-5"
                style={{
                  WebkitOverflowScrolling:
                    'touch',
                }}
              >
                {selectedAppointment.status ===
                  'pending' && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/20 rounded-2xl p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <Clock className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />

                      <div>
                        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">
                          ⏳ Waiting for Approval
                        </p>

                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                          Your appointment is pending review by the clinic staff. You can still edit or cancel while it's pending.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAppointment.status ===
                  'approved' && (
                  <>
                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/20 rounded-2xl p-4 mb-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />

                        <div>
                          <p className="text-sm font-semibold text-green-800 dark:text-green-400">
                            ✅ Appointment Approved
                          </p>

                          <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                            Your appointment has been confirmed! Here's what to do on the day of your visit:
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex gap-3">
                        <div className="w-6 h-6 bg-maroon-100 dark:bg-maroon-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-maroon-800 dark:text-maroon-400">
                            1
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Arrive Early
                          </p>

                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Come to the clinic <strong>10-15 minutes before</strong> your scheduled time ({selectedAppointment.time_slot}).
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-6 h-6 bg-maroon-100 dark:bg-maroon-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-maroon-800 dark:text-maroon-400">
                            2
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Scan QR Code at Kiosk
                          </p>

                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Look for the clinic kiosk and <strong>scan your appointment QR code</strong> to check in. This notifies the nurse that you've arrived.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-6 h-6 bg-maroon-100 dark:bg-maroon-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-maroon-800 dark:text-maroon-400">
                            3
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Wait for Your Turn
                          </p>

                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            The kiosk system will automatically determine if you're <strong>priority or regular</strong>. Wait for your name to be called.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {selectedAppointment.status ===
                  'completed' && (
                  <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/20 rounded-2xl p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />

                      <div>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-400">
                          🎉 Appointment Completed
                        </p>

                        <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                          Your visit is done! Check your medical records for any follow-up instructions or prescriptions.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAppointment.status ===
                  'cancelled' && (
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 rounded-2xl p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />

                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-400">
                          ❌ Appointment Cancelled
                        </p>

                        <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                          This appointment has been cancelled. You can book a new appointment anytime.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAppointment.status ===
                  'rejected' && (
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 rounded-2xl p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />

                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-400">
                          ⚠️ Appointment Rejected
                        </p>

                        <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                          Unfortunately, your appointment was rejected. Please contact the clinic or try booking a different time.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-maroon-50 dark:bg-maroon-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {selectedAppointment.service ||
                        'Appointment'}
                    </h3>

                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                      Ref:{' '}
                      {selectedAppointment.reference_number ||
                        'N/A'}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-4 space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />

                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Date
                      </p>

                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDate(
                          selectedAppointment.appointment_date
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />

                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Time
                      </p>

                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedAppointment.time_slot ||
                          'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />

                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Concern
                      </p>

                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {selectedAppointment.concern ||
                          'No concern specified'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedAppointment.status ===
                    'pending' && (
                    <>
                      <button
                        onClick={() =>
                          handleEditClick(
                            selectedAppointment
                          )
                        }
                        className="w-full py-3 bg-maroon-800 text-white font-semibold rounded-2xl hover:bg-maroon-900 transition flex items-center justify-center gap-1.5 text-sm"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit Appointment
                      </button>

                      <button
                        onClick={() => {
                          setConfirmCancel(
                            selectedAppointment.id
                          );

                          setSelectedAppointment(
                            null
                          );
                        }}
                        className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm border border-red-200 dark:border-red-800/20"
                      >
                        Cancel Appointment
                      </button>
                    </>
                  )}

                  <button
                    onClick={() =>
                      setSelectedAppointment(
                        null
                      )
                    }
                    className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmCancel && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() =>
              setConfirmCancel(
                null
              )
            }
          >
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.95,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                scale: 0.95,
              }}
              transition={{
                duration: 0.2,
              }}
              className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>

              <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                Cancel Appointment?
              </h3>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This action cannot be undone. The time slot will be released for others.
              </p>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() =>
                    setConfirmCancel(
                      null
                    )
                  }
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm"
                >
                  Keep
                </button>

                <button
                  onClick={
                    handleCancel
                  }
                  className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-2xl hover:bg-red-600 transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Appointments;