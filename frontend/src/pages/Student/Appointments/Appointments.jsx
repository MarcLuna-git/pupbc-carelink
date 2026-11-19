import ApprovedAppointmentsView, { AppointmentHero } from './ApprovedAppointmentsView';
import './appointments.css';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  AlertCircle,
  Stethoscope,
  FileText,
  Edit3,
  Loader2,
  Info,
  Hash,
} from 'lucide-react';
import api from '../../../services/api';
import { sessionId } from '../../../services/session';
import { clinicDate, appointmentDate as normalizeDateValue, appointmentTime as parseAppointmentDateTime, isClinicSunday, formatAppointmentDate as formatDate } from '../../../utils/appointmentDate';
import { isTimeGuardBypassed, useTimeGuardBypass } from '../../../services/devTools';
import useVisiblePolling from '../../../hooks/useVisiblePolling';
import HealthProfileVerifyError from '../../../components/HealthProfileVerifyError';
import { useStudentHealthProfileStatus } from '../../../hooks/useStudentHealthProfileStatus';

/*
 * The appointment list is kept in memory for quick page switches, never in
 * localStorage: it holds health details (concerns) and must not stay on a
 * shared device. Tied to the signed-in session, so a new sign-in starts empty.
 */
let appointmentsCache = { session: null, list: [] };
const cachedAppointments = () =>
  appointmentsCache.session && appointmentsCache.session === sessionId('student') ? appointmentsCache.list : [];
const cacheAppointments = (list) => {
  appointmentsCache = { session: sessionId('student'), list };
};
// Older versions stored the list in localStorage; remove it from this device.
try { localStorage.removeItem('carelink.student.appointments'); } catch { /* storage blocked */ }

/*
 * ROUTE LOADING — same restored effect as the Settings / Profile / Records /
 * QR pages, scoped to this page. TEMP DEMO TIMER: holds the loading phase so
 * the animation is visible even when the API answers quickly on localhost.
 */
const ROUTE_LOADING_DELAY = 1600;

// Sunday closure, unless Settings → Developer Tools → Remove time Guard is on.
const isSunday = (value) => !isTimeGuardBypassed() && isClinicSunday(value);

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-[10px] bg-gray-200 dark:bg-gray-700 ${className}`} />
);

/* Ghost of the Upcoming Appointment card — reuses the real 5-column grid so
   the ghost blocks land exactly where the loaded content will. */
const SkeletonUpcoming = () => (
  <section className="ap-card ap-upcoming">
    <div className="ap-section-heading ap-upcoming-heading">
      <Skeleton className="h-5 w-5 shrink-0 rounded-[10px]" />
      <Skeleton className="h-4 w-44" />
      <Skeleton className="h-5 w-20 rounded-[10px]" />
    </div>
    <div className="ap-upcoming-content">
      <Skeleton className="h-16 w-full rounded-[10px]" />
      <Skeleton className="h-12 w-full rounded-[10px]" />
      <Skeleton className="h-12 w-full rounded-[10px]" />
      <Skeleton className="h-14 w-full rounded-[10px]" />
      <Skeleton className="h-9 w-full rounded-[10px]" />
    </div>
  </section>
);

/* Ghost of the 3-step booking form — same timeline markup (markers, spine
   and columns ride the real CSS). */
const SkeletonBooking = () => (
  <section className="ap-card ap-booking">
    <div className="ap-section-heading">
      <Skeleton className="h-5 w-5 shrink-0 rounded-[10px]" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
    </div>
    <div className="ap-booking-steps">
      <ol className="ap-booking-progress">
        <li className="ap-booking-step is-active">
          <header className="ap-step-heading"><span className="ap-step-marker">1</span><Skeleton className="h-3.5 w-20" /></header>
          <section className="ap-booking-column"><div className="ap-step-body grid grid-cols-7 gap-1.5">
            {[...Array(28)].map((_, i) => <Skeleton key={i} className="h-7 w-full rounded-[10px]" />)}
          </div></section>
        </li>
        <li className="ap-booking-step">
          <header className="ap-step-heading"><span className="ap-step-marker">2</span><Skeleton className="h-3.5 w-32" /></header>
          <section className="ap-booking-column"><div className="ap-step-body">
            <div className="ap-time-grid">
              {[...Array(16)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[10px]" />)}
            </div>
          </div></section>
        </li>
        <li className="ap-booking-step">
          <header className="ap-step-heading"><span className="ap-step-marker">3</span><Skeleton className="h-3.5 w-24" /></header>
          <section className="ap-booking-column"><div className="ap-service-list">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-[10px]" />)}
          </div></section>
        </li>
      </ol>
    </div>
  </section>
);

/* Ghost of the Appointment History card. */
const SkeletonHistory = () => (
  <section className="ap-card ap-history">
    <div className="ap-section-heading">
      <Skeleton className="h-5 w-5 shrink-0 rounded-[10px]" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
      <Skeleton className="h-9 w-40 shrink-0 rounded-[10px]" />
    </div>
    <div className="ap-history-list">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="ap-history-item">
          <Skeleton className="h-14 w-14 shrink-0 rounded-[10px]" />
          <div className="ap-history-info space-y-1.5">
            <Skeleton className="h-3.5 w-36 max-w-full" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <div className="ap-history-side">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  </section>
);

const Appointments = () => {
  /*
   * Health Profile gate — backend-authoritative (moved from the App.jsx
   * route guard so this page's own skeleton covers the verification:
   * ONE loading phase, same flow as the unguarded pages).
   */
  const {
    loading: verifyingProfile,
    completed: profileVerified,
    error: verifyError,
    retry: retryVerification,
  } = useStudentHealthProfileStatus();

  // Re-render when Developer Tools turns the time guard on or off.
  useTimeGuardBypass();

  /* Fresh-reload default: no date picked, so every booking step starts
     unchecked until the student picks one. */
  const defaultDate = '';

  const [showForm, setShowForm] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const [pageLoading, setPageLoading] = useState(() => cachedAppointments().length === 0);

  const [confirmCancel, setConfirmCancel] =
    useState(null);
  const [cancelling, setCancelling] = useState(false);

  const [
    selectedAppointment,
    setSelectedAppointment,
  ] = useState(null);

  /* Cosmetic hold for the route-loading animation — see ROUTE LOADING note. */
  const [routeReady, setRouteReady] = useState(false);

  const [message, setMessage] = useState('');

  const [messageType, setMessageType] =
    useState('success');

  const [appointments, setAppointments] =
    useState(cachedAppointments);

  const [form, setForm] = useState({
    service: '',
    date: defaultDate,
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
    useCallback(async (signal) => {
      try {
        const response = await api.get('/student/appointments', { signal });

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

          cacheAppointments(normalized);
        }
      } catch (err) {
        if (err.name === 'CanceledError') return;
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
      // `silent` is for the background re-check: update the slots without the loading placeholder
      async (date, signal, silent = false) => {
        if (!date || isSunday(date)) {
          setAvailableSlots([]);
          return;
        }

        if (!silent) setSlotsLoading(true);

        try {
          const response =
            await api.get(
              `/student/available-slots?date=${date}`,
              { signal }
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
          if (err.name === 'CanceledError') return;
          console.log(
            'Fetch slots error:',
            err
          );
        } finally {
          if (!silent) setSlotsLoading(false);
        }
      },
      []
    );

  useVisiblePolling(fetchAppointments, 30000);

  /* Demo timer: keeps the loading phase on screen long enough to see it. */
  useEffect(() => {
    const timer = setTimeout(() => setRouteReady(true), ROUTE_LOADING_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const slotPollingRef = useRef(null);
  useEffect(() => {
    if (
      showForm &&
      form.date &&
      !isSunday(form.date)
    ) {
      fetchAvailableSlots(form.date);

      slotPollingRef.current = setInterval(
        () =>
          fetchAvailableSlots(form.date, undefined, true),
        30000
      );
    }

    return () => {
      if (slotPollingRef.current) {
        clearInterval(slotPollingRef.current);
      }
    };
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

  const handleChange = (e) => {
    const {
      name,
      value,
    } = e.target;

    if (name === 'date' && value && isSunday(value)) {
      // UI-only: Sunday dates stay selectable (no toast, no rejection), but the
      // clinic returns no slot data for them — clear stale availability so the
      // placeholder slots show instead of the previous day's real numbers.
      setAvailableSlots([]);
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
        is_past: false,
        isFull: false,
      };
    }

    return slot;
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

    setShowForm(true);
    document.getElementById('appointment-booking')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
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

      if (
        slotInfo.is_past &&
        !isTimeGuardBypassed()
      ) {
        setMessageType(
          'error'
        );

        setMessage(
          'This time slot has already passed. Please select a different time.'
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
        (!isTimeGuardBypassed() &&
          selectedSlot <
            new Date())
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
              payload
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
              payload
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
          setEditingId(null);

          setForm({
            service: '',
            date: defaultDate,
            time: '',
            concern: '',
          });

          fetchAppointments();
          if (form.time) {
            setAvailableSlots((current) =>
              current.map((slot) =>
                slot.time === form.time
                  ? {
                      ...slot,
                      available: Math.max(0, (slot.available ?? 10) - 1),
                      booked: (slot.booked ?? 0) + 1,
                      isFull: ((slot.available ?? 10) - 1) <= 0,
                    }
                  : slot
              )
            );
          }
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
      if (!confirmCancel || cancelling) {
        return;
      }

      const appointmentId = confirmCancel;
      const succeed = () => {
        setMessageType('success');
        setMessage('Appointment cancelled.');
        setConfirmCancel(null);
        setSelectedAppointment(null);
        fetchAppointments();
      };

      setCancelling(true);

      try {
        await api.patch(
          `/student/appointments/${appointmentId}/cancel`
        );

        succeed();
      } catch (err) {
        /* A timeout / dropped connection does not mean the cancel failed —
           the server may have committed it. Re-read the appointment before
           reporting an error. */
        let alreadyCancelled = false;

        if (!err.response) {
          try {
            const check = await api.get(`/student/appointments/${appointmentId}`);
            alreadyCancelled = check.data?.data?.status === 'cancelled';
          } catch {
            alreadyCancelled = false;
          }
        }

        if (alreadyCancelled) {
          succeed();
        } else {
          setMessageType('error');
          setMessage(
            err.response?.data?.message ||
              (err.response
                ? 'Failed to cancel appointment.'
                : 'The clinic server is slow to respond. Please check your connection and try again.')
          );
        }
      } finally {
        setCancelling(false);
      }

      setTimeout(
        () =>
          setMessage(''),
        3000
      );
    };

  /*
   * LOADING PHASE — ONE phase for everything: the backend Health Profile
   * verification AND this page's first data + demo timer. The hero is real,
   * with the looping progress bar on its bottom edge ONLY (same as
   * Settings / Records / QR — never on the forms). The upcoming card,
   * booking steps and history render as 1:1 ghosts. Incomplete students
   * never reach this skeleton.
   */
  if (verifyingProfile || pageLoading || !routeReady) {
    return (
      <div className="student-appointments approved-appointments-page">
        <AppointmentHero loading />
        <SkeletonUpcoming />
        <SkeletonBooking />
        <SkeletonHistory />
        <p className="ap-policy-note"><AlertCircle />Loading your clinic schedule…</p>
      </div>
    );
  }

  if (verifyError) {
    return <HealthProfileVerifyError retry={retryVerification} />;
  }

  if (!profileVerified) {
    return <Navigate to="/student/health-profile" replace />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="student-appointments approved-appointments-page"
    >
      <ApprovedAppointmentsView appointments={orderedAppointments} filteredAppointments={filteredAppointments}
        form={form} onChange={handleChange} onSubmit={handleSubmit} onView={setSelectedAppointment} onEdit={handleEditClick}
        filter={filter} onFilter={setFilter} editingId={editingId} services={services} timeSlots={timeSlots}
        availableSlots={availableSlots} slotsLoading={slotsLoading} loading={loading} message={message} messageType={messageType}
        onDismissMessage={() => setMessage('')}
        retrySlots={() => fetchAvailableSlots(form.date)} onCancelEdit={() => {
          setEditingId(null);
          setForm({ service: '', date: defaultDate, time: '', concern: '' });
        }} />


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
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            role="dialog" aria-modal="true" aria-label="Appointment details"
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
              className="flex w-full max-w-md flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl dark:bg-gray-800"
              style={{
                maxHeight: '90vh',
              }}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div
                className="min-h-0 flex-1 overflow-y-auto p-5"
                style={{
                  WebkitOverflowScrolling:
                    'touch',
                }}
              >
                {selectedAppointment.status ===
                  'pending' && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/20 rounded-[10px] p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <div>
                        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">
                          Waiting for Approval
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
                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/20 rounded-[10px] p-4 mb-3">
                      <div className="flex items-start gap-2">
                        <div>
                          <p className="text-sm font-semibold text-green-800 dark:text-green-400">
                            Appointment Approved
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
                  <div className="px-5 pt-2 pb-5 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                      <Info className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>

                    <p className="text-base font-semibold text-gray-900 dark:text-white">
                      Appointment Completed
                    </p>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Your visit is done! Check your medical records for any follow-up instructions or prescriptions.
                    </p>
                  </div>
                )}

                {selectedAppointment.status ===
                  'cancelled' && (
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 rounded-[10px] p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-400">
                          Appointment Cancelled
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
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 rounded-[10px] p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-400">
                          Appointment Rejected
                        </p>

                        <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                          Unfortunately, your appointment was rejected. Please contact the clinic or try booking a different time.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-[10px] p-4 space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-4 h-4 text-gray-400 flex-shrink-0" />

                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Service
                      </p>

                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedAppointment.service ||
                          'Appointment'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />

                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Reference
                      </p>

                      <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                        {selectedAppointment.reference_number ||
                          'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />

                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
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
                      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
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
                      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Concern
                      </p>

                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {selectedAppointment.concern ||
                          'No concern specified'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {selectedAppointment.status ===
                    'pending' && (
                    <>
                      <button
                        onClick={() =>
                          handleEditClick(
                            selectedAppointment
                          )
                        }
                        className="px-5 py-2.5 bg-maroon-800 text-white font-semibold rounded-[10px] hover:bg-maroon-900 transition flex items-center justify-center gap-1.5 text-sm"
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
                        className="px-5 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold rounded-[10px] hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm border border-red-200 dark:border-red-800/20"
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
                    className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-[10px] hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm"
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
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            role="dialog" aria-modal="true" aria-label="Confirm appointment cancellation"
            aria-busy={cancelling}
            onClick={() => {
              if (!cancelling) setConfirmCancel(null);
            }}
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
              className="bg-white dark:bg-gray-800 rounded-[10px] w-full max-w-sm shadow-2xl p-6 text-center"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/20 rounded-[10px] flex items-center justify-center mx-auto mb-4">
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
                  type="button"
                  onClick={() =>
                    setConfirmCancel(
                      null
                    )
                  }
                  disabled={cancelling}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-[10px] hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Keep
                </button>

                <button
                  type="button"
                  onClick={
                    handleCancel
                  }
                  disabled={cancelling}
                  className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-[10px] hover:bg-red-600 transition text-sm flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-80"
                >
                  {cancelling ? <><Loader2 className="w-4 h-4 animate-spin" />Cancelling…</> : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Appointments;
