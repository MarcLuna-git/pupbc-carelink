import api from '../../../services/api';
import { getUser } from '../../../services/session';
import {
  clinicDate as getManilaDateString,
  appointmentDate,
  formatAppointmentDate,
  appointmentTime,
} from '../../../utils/appointmentDate';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  QrCode,
  Download,
  Printer,
  Loader2,
  AlertTriangle,
  CalendarDays,
  Clock,
  LogIn,
  CircleCheck,
  Users,
  Info,
  Stethoscope,
  FileText,
  Hash,
  History,
  ArrowUpRight,
  ChevronRight,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import useVisiblePolling from '../../../hooks/useVisiblePolling';
import StudentPageHero from '../../../components/StudentPageHero';
import HealthProfileVerifyError from '../../../components/HealthProfileVerifyError';
import { useStudentHealthProfileStatus } from '../../../hooks/useStudentHealthProfileStatus';
import { formatPersonName } from '../../../utils/studentUser';
import { escapeHtml } from '../../../utils/escapeHtml';
import { whenPrintReady } from '../../../utils/printReady';
import { StudentToast } from '../../../components/StudentFeedback';
import { QUEUE_STATUS_NOTES, checkinStepIndex } from './checkinTracker';
import LiveQueue from './LiveQueue';

const formatDate = (value) => formatAppointmentDate(value, { month: 'long' });
const formatDateWithWeekday = (value) =>
  formatAppointmentDate(value, { month: 'long', weekday: 'long' });

// Check-in window times come back as ISO instants; show them in clinic time.
const formatTime = (isoString) => {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const queueTypeLabel = (type) =>
  type
    ? `${type.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())} Queue`
    : 'Regular Queue';

/* Check-in tracker: one step per queue state, in visit order. */
const CHECKIN_STEPS = [
  { title: 'Not yet checked in', desc: 'Scan your QR code at the clinic kiosk.' },
  { title: 'Checked in', desc: 'Your slot is reserved in the queue.' },
  { title: 'Now Serving', desc: 'Proceed to the consultation room.' },
  { title: 'Completed', desc: 'Your clinic visit is finished.' },
];


/*
 * ROUTE LOADING — same restored effect as the Settings / Profile / Records
 * pages, scoped to this page. TEMP DEMO TIMER: holds the loading phase so
 * the animation is visible even when the API answers quickly on localhost.
 */
const ROUTE_LOADING_DELAY = 1600;

const LOAD_ERROR = 'Unable to load your QR information. Please try again.';

const CARD =
  'rounded-[10px] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-5 lg:p-6';

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-[10px] bg-gray-200 dark:bg-gray-700 ${className}`} />
);

/* Ghost of CardTitle: icon + title, with an optional action that wraps below on narrow screens. */
const SkeletonTitle = ({ width, action }) => (
  <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
    <div className="flex items-center gap-2.5">
      <Skeleton className="h-6 w-6 shrink-0" />
      <Skeleton className={`h-6 ${width}`} />
    </div>
    {action}
  </div>
);

const QR_HERO = {
  id: 'qr-title',
  title: 'QR Code',
  description: 'Use your QR code for a faster and easier clinic check-in at the PUP Student Clinic.',
};

const CardTitle = ({ icon: Icon, children, action }) => (
  <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
    <h2 className="flex items-center gap-2.5 whitespace-nowrap text-lg font-bold text-gray-900 dark:text-white">
      <Icon className="h-6 w-6 shrink-0 text-maroon-800 dark:text-maroon-300" />
      {children}
    </h2>
    {action}
  </div>
);

/* Icon tile + label/value row used in the QR card and summary. */
const DetailRow = ({ icon: Icon, label, value, hint }) => (
  <div className="flex items-start gap-3.5">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300">
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  </div>
);

const CHECKIN_TIPS = [
  { icon: QrCode, title: 'Bring your QR code', desc: 'Have your QR code ready on your phone or printed.' },
  { icon: Clock, title: 'Arrive early', desc: 'Check in within the valid time window.' },
  { icon: Info, title: 'Use the clinic kiosk', desc: 'Scan your QR code at the Student Clinic kiosk.' },
];

const QR_STATE_BADGES = {
  active: { label: 'Active Today', tone: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
  checked_in: { label: 'Checked In', tone: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800' },
  completed: { label: 'Completed', tone: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600' },
  no_show: { label: 'No-Show', tone: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
  expired: { label: 'Expired', tone: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
  upcoming: { label: 'Upcoming', tone: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600' },
  pending: { label: 'Pending', tone: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
  cancelled: { label: 'Cancelled', tone: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600' },
  rejected: { label: 'Declined', tone: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
};

const QR = () => {
  const user = useMemo(
    () => getUser('student'),
    []
  );

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

  const [pageLoading, setPageLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [qrCodeHash, setQrCodeHash] = useState('');
  const [qrUsable, setQrUsable] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [liveQueue, setLiveQueue] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const hasLoadedRef = useRef(false);

  // Check-in window state
  const [checkinOpensAt, setCheckinOpensAt] = useState(null);
  const [checkinDeadlineAt, setCheckinDeadlineAt] = useState(null);

  const today = getManilaDateString();
  // Today's visit stays on this page all day — including after it is completed.
  // A visit still waiting to be served wins over one that is already finished.
  const todayAppointment = useMemo(
    () => {
      const todays = appointments.filter((item) =>
        ['approved', 'completed'].includes(item.status) &&
        appointmentDate(item.appointment_date) === today);
      return todays.find((item) => item.status === 'approved' && item.queue?.status !== 'completed') ||
        todays[0] || null;
    },
    // `today` re-evaluates the selection when the clinic day rolls over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, today]
  );

  const queue = todayAppointment?.queue || null;
  const visitCompleted = todayAppointment?.status === 'completed' || queue?.status === 'completed';
  // Kiosk → Developer Tools → Remove time Guard opens check-in for the whole day.
  const allDayWindow = Boolean(checkinOpensAt && checkinDeadlineAt) &&
    formatTime(checkinOpensAt) === '12:00 AM' && formatTime(checkinDeadlineAt) === '11:59 PM';

  // The QR is only for checking in, so it is hidden once today's visit is completed.
  const canUseQr =
    Boolean(qrUsable) &&
    Boolean(qrCodeHash) &&
    Boolean(todayAppointment) &&
    !visitCompleted;

  /* Minutes between check-in opening and the appointment's start time. */
  const minutesBeforeStart = useMemo(() => {
    if (!todayAppointment || !checkinOpensAt) return null;
    const start = appointmentTime(
      todayAppointment.appointment_date,
      todayAppointment.time_slot
    );
    const opens = new Date(checkinOpensAt);
    if (!start || Number.isNaN(opens.getTime())) return null;
    const minutes = Math.round((start - opens) / 60000);
    return minutes > 0 ? minutes : null;
  }, [todayAppointment, checkinOpensAt]);

  /* Cosmetic hold for the route-loading animation — see ROUTE LOADING note. */
  const [routeReady, setRouteReady] = useState(false);

  useEffect(() => {
    if (!selectedActivity) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') setSelectedActivity(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedActivity]);

  /* Demo timer: keeps the loading phase on screen long enough to see it. */
  useEffect(() => {
    const timer = setTimeout(() => setRouteReady(true), ROUTE_LOADING_DELAY);
    return () => clearTimeout(timer);
  }, []);

  // Background polls pass the poller's signal.
  const fetchQrData = async (signal) => {
    const background = Boolean(signal);
    try {
      const response = await api.get('/student/qr', { signal });
      if (signal?.aborted) return;
      hasLoadedRef.current = true;
      const qrData = response?.data?.data || null;

      setQrCodeHash(qrData?.qr_code_hash || '');
      setQrUsable(Boolean(qrData?.available && qrData?.qr_code_hash));

      // Store check-in window times
      setCheckinOpensAt(qrData?.appointment?.checkin_opens_at || null);
      setCheckinDeadlineAt(qrData?.appointment?.checkin_deadline_at || null);

      const appointmentPayload = qrData?.appointment;
      setAppointments(appointmentPayload ? [appointmentPayload] : []);
      setRecentActivity(Array.isArray(qrData?.recent_activity) ? qrData.recent_activity : []);
      setLiveQueue(qrData?.live_queue || null);
      // Clear only a previous load failure; keep e.g. the download notice.
      setMessage((current) => (current === LOAD_ERROR ? '' : current));
    } catch (error) {
      if (error.name === 'CanceledError') return;
      console.error('QR data load error:', error);
      /* A slow or busy server can drop one background poll. Keep showing the
         QR that is already loaded and let the poller back off and retry;
         only report the failure when nothing is loaded or on manual Refresh. */
      if (!background || !hasLoadedRef.current) {
        setMessageType('error');
        setMessage(LOAD_ERROR);
      }
      if (background) throw error;
    } finally {
      setPageLoading(false);
    }
  };

  useVisiblePolling(fetchQrData, 10000, profileVerified);

  useEffect(() => {
    let cancelled = false;

    const generateQR = async () => {
      if (!canUseQr) {
        setQrDataUrl('');
        return;
      }

      const qrValue = JSON.stringify({
        student_id: user.student_id,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        hash: qrCodeHash,
      });

      try {
        const dataUrl = await QRCode.toDataURL(qrValue, {
          width: 400,
          margin: 2,
          color: {
            dark: '#111111',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'H',
        });

        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch (error) {
        console.error('QR generation error:', error);

        if (!cancelled) {
          setQrDataUrl('');
          setMessageType('error');
          setMessage('Unable to generate your QR code.');
        }
      }
    };

    generateQR();

    return () => {
      cancelled = true;
    };
  }, [canUseQr, qrCodeHash, user.student_id, user.first_name, user.last_name]);

  const handleDownload = () => {
    if (!qrDataUrl || !canUseQr) {
      return;
    }

    setDownloading(true);

    try {
      const link = document.createElement('a');

      link.href = qrDataUrl;
      link.download = `PUPBC-QR-${user.student_id}.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessageType('success');
      setMessage('QR code downloaded successfully.');

      setTimeout(() => setMessage(''), 2500);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (!qrDataUrl || !canUseQr || !todayAppointment) {
      return;
    }

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      setMessageType('error');
      setMessage('Pop-up was blocked. Please allow pop-ups to print your QR code.');

      return;
    }

    const safeName = escapeHtml(
      formatPersonName(`${user.first_name || ''} ${user.last_name || ''}`.trim())
    );
    const opens = formatTime(checkinOpensAt);
    const deadline = formatTime(checkinDeadlineAt);

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>PUPBC CareLink QR Code</title>
          <link rel="stylesheet" href="/templates/print/qr-card.css" />
        </head>

        <body>
          <div class="card">
            <p class="title">PUPBC CareLink</p>
            <p class="subtitle">Clinic Check-in QR</p>

            <img class="qr" src="${qrDataUrl}" alt="QR Code" />

            <p class="name">${safeName}</p>
            <p class="meta">${escapeHtml(user.student_id)}</p>

            <div class="appointment">
              <strong>Today's Approved Appointment</strong>
              <br />
              ${escapeHtml(todayAppointment.service || 'Appointment')}
              <br />
              ${escapeHtml(formatDate(todayAppointment.appointment_date))}
              &bull;
              ${escapeHtml(todayAppointment.time_slot || 'N/A')}
              ${opens && deadline ? `<br /><br />
              <strong>Check-in Window:</strong><br />
              Opens: ${escapeHtml(opens)}<br />
              Deadline: ${escapeHtml(deadline)}` : ''}
            </div>

            <p class="notice">
              Valid for clinic identification and today's approved appointment only.
            </p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    // Printed from here, not from a <script> in the written page: the site's
    // Content-Security-Policy blocks inline scripts, and the new window
    // inherits it. Waits for qr-card.css and the QR image first.
    whenPrintReady(printWindow.document).then(() => printWindow.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 200));
  };

  /*
   * LOADING PHASE — ONE phase for everything: the backend Health Profile
   * verification AND this page's first data + demo timer. The hero is real,
   * with the looping progress bar on its bottom edge ONLY (same as
   * Settings / Records — never on the cards). The cards render as 1:1
   * ghosts. Incomplete students never reach this skeleton.
   */
  if (verifyingProfile || pageLoading || !routeReady) {
    return (
      <div className="w-full min-w-0 space-y-3">
        <StudentPageHero {...QR_HERO} loading />

        {/* Ghost of Check-in Status: vertical tracker below lg, horizontal on lg (like the real one) */}
        <div className={CARD}>
          <SkeletonTitle width="w-40" />
          <ol className="flex flex-col lg:flex-row lg:gap-3">
            {[0, 1, 2, 3].map((key) => {
              const isLast = key === 3;
              return (
                <li key={key} className={`relative flex items-start gap-3 ${isLast ? 'lg:flex-none' : 'pb-6 lg:flex-1 lg:pb-0'}`}>
                  {!isLast && <span aria-hidden="true" className="absolute bottom-0 left-5 top-10 w-0.5 -translate-x-1/2 bg-gray-200 dark:bg-gray-700 lg:hidden" />}
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5 pt-1 lg:max-w-[10.5rem]">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-40 max-w-full" />
                  </div>
                  {!isLast && <span aria-hidden="true" className="mt-5 hidden h-0.5 min-w-6 flex-1 rounded-full bg-gray-200 dark:bg-gray-700 lg:block" />}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* Ghost of the QR card */}
          <div className={`${CARD} flex flex-col`}>
            <SkeletonTitle width="w-32" action={<Skeleton className="h-12 w-36 rounded-[10px]" />} />
            <div className="flex flex-col items-center">
              <div className="rounded-[10px] border border-gray-200 p-3 dark:border-gray-600">
                <Skeleton className="h-48 w-48 rounded-[10px] sm:h-56 sm:w-56" />
              </div>
              <Skeleton className="mt-4 h-6 w-44" />
              <Skeleton className="mt-2 h-3.5 w-40" />
              <Skeleton className="mt-1.5 h-3.5 w-28" />
              {/* Download / Print */}
              <div className="mt-4 grid w-full grid-cols-2 gap-3">
                <Skeleton className="h-10 rounded-[10px]" />
                <Skeleton className="h-10 rounded-[10px]" />
              </div>
            </div>
            <div className="mt-6 space-y-5 border-t border-gray-100 pt-5 dark:border-gray-700">
              {[0, 1, 2].map((key) => (
                <div key={key} className="flex gap-3.5">
                  <Skeleton className="h-10 w-10 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-4 w-48 max-w-full" />
                  </div>
                </div>
              ))}
            </div>
            {/* Keep Your QR Private ghost */}
            <div className="mt-6 flex items-start gap-3 rounded-[10px] bg-gray-50 p-3 dark:bg-gray-900/30">
              <Skeleton className="h-4 w-4 shrink-0 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Ghost of Check-in Information */}
            <div className={CARD}>
              <SkeletonTitle width="w-48" />
              <div className="grid gap-4 rounded-[10px] bg-gray-50 p-5 dark:bg-gray-900/30 sm:grid-cols-2">
                {[0, 1].map((key) => (
                  <div key={key} className={`flex items-start gap-3.5 ${key ? 'sm:pl-5' : ''}`}>
                    <Skeleton className="mt-1 h-7 w-7 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-8 w-32" />
                      <Skeleton className="h-3 w-full max-w-[12rem]" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="flex items-start gap-3 rounded-[10px] bg-gray-50 p-3.5 dark:bg-gray-900/30">
                    <Skeleton className="h-6 w-6 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ghost of Appointment Summary — stretches like the real card */}
            <div className={`${CARD} flex flex-1 flex-col`}>
              <SkeletonTitle width="w-52" action={<Skeleton className="h-9 w-48 rounded-[10px]" />} />
              <div className="grid flex-1 content-center gap-5 rounded-[10px] border border-gray-100 p-5 dark:border-gray-700 sm:grid-cols-2">
                {[0, 1].map((column) => (
                  <div key={column} className={`space-y-5 ${column ? 'sm:pl-5' : ''}`}>
                    {[0, 1].map((key) => (
                      <div key={key} className="flex gap-3.5">
                        <Skeleton className="h-10 w-10 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-4 w-36 max-w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (verifyError) {
    return <HealthProfileVerifyError retry={retryVerification} />;
  }

  if (!profileVerified) {
    return <Navigate to="/student/health-profile" replace />;
  }

  const fullName = `${formatPersonName(user.first_name)} ${formatPersonName(user.last_name)}`.trim();
  const courseLine = [user.course, user.year, user.section].filter(Boolean).join(' • ');
  // Once today's visit is finished the QR is gone too, so the tracker starts over at
  // "Not yet checked in" (the finished visit is under View Records below).
  const trackedAppointment = visitCompleted ? null : todayAppointment;
  const currentStep = trackedAppointment ? checkinStepIndex(queue, trackedAppointment) : 0;
  const statusNote = !visitCompleted && QUEUE_STATUS_NOTES[queue?.status];
  const isNoShow = queue?.status === 'no_show';
  const opensLabel = formatTime(checkinOpensAt);
  const deadlineLabel = formatTime(checkinDeadlineAt);
  // Live Queue takes the Check-in Information spot once the student is in today's queue.
  const inLiveQueue = Boolean(liveQueue?.mine);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full min-w-0 space-y-3"
    >
      <StudentPageHero {...QR_HERO} />

      <StudentToast message={message} type={messageType === 'error' ? 'error' : 'success'} onClose={() => setMessage('')} />

      {/* Check-in Status */}
      <div className={CARD}>
          <CardTitle icon={History}>Check-in Status</CardTitle>

          {!trackedAppointment && (
            <p className="-mt-2 mb-4 text-xs text-gray-500 dark:text-gray-400">
              Your progress will be tracked here on the day of an approved appointment.
            </p>
          )}

          {isNoShow ? (
            <div className="flex items-start gap-3 rounded-[10px] border border-red-200 bg-red-50 p-4 dark:border-red-800/30 dark:bg-red-900/20">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">Marked as No Show</p>
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
                  You were not present when called. Please approach the clinic staff for assistance.
                </p>
              </div>
            </div>
          ) : (
            /* Progress tracker: horizontal on desktop, vertical below lg.
               A connector fills maroon once the step before it is done. */
            <ol className="flex flex-col lg:flex-row lg:gap-3">
              {CHECKIN_STEPS.map((step, index) => {
                const active = Boolean(trackedAppointment) && index === currentStep;
                const done = index < currentStep || (visitCompleted && active);
                const isLast = index === CHECKIN_STEPS.length - 1;
                const connectorColor = done
                  ? 'bg-maroon-800 dark:bg-maroon-500'
                  : 'bg-gray-200 dark:bg-gray-700';
                return (
                  <li
                    key={step.title}
                    className={`relative flex items-start gap-3 ${isLast ? 'lg:flex-none' : 'pb-6 lg:flex-1 lg:pb-0'}`}
                    aria-current={active ? 'step' : undefined}
                  >
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-0 left-5 top-10 w-0.5 -translate-x-1/2 lg:hidden ${connectorColor}`}
                      />
                    )}
                    <span
                      className={`relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        active
                          ? 'bg-maroon-800 text-white'
                          : done
                            ? 'bg-maroon-100 text-maroon-800 dark:bg-maroon-900/40 dark:text-maroon-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {done ? <CircleCheck className="h-5 w-5" /> : index + 1}
                    </span>
                    <div className="min-w-0 lg:max-w-[10.5rem]">
                      <p
                        className={`text-sm font-semibold ${
                          active ? 'text-maroon-800 dark:text-maroon-300' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {active && queue?.status === 'called' ? 'Called' : step.title}
                      </p>
                      <p
                        className={`mt-0.5 text-xs leading-relaxed ${active && statusNote ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}
                        aria-live={active ? 'polite' : undefined}
                      >
                        {active && statusNote ? statusNote : step.desc}
                      </p>
                    </div>
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={`mt-5 hidden h-0.5 min-w-6 flex-1 rounded-full lg:block ${connectorColor}`}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Your QR Code */}
        <div className={`${CARD} flex flex-col`}>
          <CardTitle
            icon={QrCode}
            action={
              canUseQr && (
                <div className="flex shrink-0 items-center gap-2 rounded-[10px] bg-green-50 px-3 py-2 dark:bg-green-900/20">
                  <CircleCheck className="h-5 w-5 fill-green-600 text-white dark:fill-green-500 dark:text-green-950" />
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">Approved</p>
                    <p className="whitespace-nowrap text-xs text-green-700/80 dark:text-green-500/80">Ready for Check-in</p>
                  </div>
                </div>
              )
            }
          >
            Your QR Code
          </CardTitle>

          {canUseQr ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="inline-block rounded-[10px] border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-600">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Clinic check-in QR code"
                    className="h-48 w-48 sm:h-56 sm:w-56"
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
                    <Loader2 className="h-8 w-8 animate-spin text-maroon-800" />
                  </div>
                )}
              </div>

              <h3 className="mt-4 text-xl font-bold text-maroon-800 dark:text-maroon-300">{fullName}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Student ID: {user.student_id}</p>
              {courseLine && <p className="text-sm text-gray-500 dark:text-gray-400">{courseLine}</p>}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading || !qrDataUrl}
                  className="flex items-center justify-center gap-2 rounded-[10px] bg-maroon-800 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-900 disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span>{downloading ? 'Downloading...' : 'Download'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!qrDataUrl}
                  className="flex items-center justify-center gap-2 rounded-[10px] border border-maroon-800 bg-white py-2.5 text-sm font-semibold text-maroon-800 transition hover:bg-maroon-50 disabled:opacity-50 dark:border-maroon-700 dark:bg-gray-800 dark:text-maroon-300 dark:hover:bg-maroon-900/20"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[10px] bg-gray-100 dark:bg-gray-700">
                <QrCode className="h-8 w-8 text-gray-400" />
              </div>

              <h3 className="mt-5 text-lg font-bold text-gray-900 dark:text-white">QR Check-in Not Available</h3>

              <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                {todayAppointment && !visitCompleted
                  ? 'Your QR credential is currently unavailable. Please contact the clinic if this continues.'
                  : 'You need an approved appointment scheduled for today before the QR can be used at the clinic kiosk.'}
              </p>

              <Link
                to="/student/appointments"
                className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-maroon-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-900"
              >
                <CalendarDays className="h-4 w-4" />
                View Appointments
              </Link>
            </div>
          )}

          {/* After a completed visit this card looks the same as with no appointment today. */}
          {todayAppointment && !visitCompleted && (
            <div className="mt-6 space-y-5 border-t border-gray-100 pt-5 dark:border-gray-700">
              <DetailRow
                icon={CalendarDays}
                label="Appointment Date & Time"
                value={`${formatAppointmentDate(todayAppointment.appointment_date, { month: 'long', weekday: 'short' })}  |  ${todayAppointment.time_slot || 'N/A'}`}
              />
              <DetailRow
                icon={Stethoscope}
                label="Service"
                value={todayAppointment.service || 'Appointment'}
                hint={todayAppointment.concern}
              />
              <DetailRow
                icon={Users}
                label="Queue Type"
                value={queue ? queueTypeLabel(queue.queue_type) : 'Assigned at check-in'}
                hint={queue?.queue_number ? `Queue number ${queue.queue_number}` : 'Set by the kiosk after triage'}
              />
            </div>
          )}

          {/* Keep Your QR Private */}
          <div className="mt-6 flex items-start gap-3 rounded-[10px] bg-gray-50 p-3 dark:bg-gray-900/30">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Keep Your QR Private</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                This QR identifies your student account at the clinic. Do not share screenshots or printed copies with other people. Medical information is not stored directly inside the QR.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* One spot, two views: Check-in Information by default, and Live Queue once the
              student has checked in at the kiosk and has a queue number today. */}
          <div className={CARD}>
            {inLiveQueue ? (
              <>
                <CardTitle
                  icon={Users}
                  action={(
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-600" />
                      </span>
                      Live, updates every 10 seconds
                    </span>
                  )}
                >
                  Live Queue
                </CardTitle>

                <LiveQueue queue={liveQueue} />
              </>
            ) : (
              <>
                <CardTitle icon={Clock}>Check-in Information</CardTitle>

                {/* Only while a visit is in progress: once it is completed (or there is none) it goes back to the default note. */}
                {trackedAppointment && opensLabel && deadlineLabel ? (
                  <div className="grid gap-4 rounded-[10px] bg-gray-50 p-5 dark:bg-gray-900/30 sm:grid-cols-2 sm:divide-x sm:divide-gray-200 dark:sm:divide-gray-700">
                    <div className="flex items-start gap-3.5">
                      <LogIn className="mt-1 h-7 w-7 shrink-0 text-maroon-700 dark:text-maroon-300" />
                      <div>
                        <p className="text-sm font-medium text-maroon-800 dark:text-maroon-300">Check-in Opens</p>
                        <p className="text-3xl font-bold text-maroon-800 dark:text-maroon-200">{opensLabel}</p>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          {allDayWindow
                            ? 'Open all day (kiosk time guard off)'
                            : minutesBeforeStart
                              ? `${minutesBeforeStart} minutes before your appointment`
                              : 'Before your appointment'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3.5 sm:pl-5">
                      <Clock className="mt-1 h-7 w-7 shrink-0 text-maroon-700 dark:text-maroon-300" />
                      <div>
                        <p className="text-sm font-medium text-maroon-800 dark:text-maroon-300">Check-in Deadline</p>
                        <p className="text-3xl font-bold text-maroon-800 dark:text-maroon-200">{deadlineLabel}</p>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          {allDayWindow
                            ? 'Open until the end of your appointment day.'
                            : 'After this time, your slot may be forfeited.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[10px] bg-gray-50 p-5 text-sm text-gray-600 dark:bg-gray-900/30 dark:text-gray-400">
                    Your check-in window will appear here on the day of an approved appointment.
                  </div>
                )}

                {trackedAppointment && (
                  <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                    After you check in at the clinic kiosk, your live queue will show here.
                  </p>
                )}
              </>
            )}

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {CHECKIN_TIPS.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-[10px] bg-gray-50 p-3.5 dark:bg-gray-900/30"
                >
                  <Icon className="mt-0.5 h-6 w-6 shrink-0 text-maroon-700 dark:text-maroon-300" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Appointment Summary */}
          <div className={`${CARD} flex flex-1 flex-col`}>
            <CardTitle
              icon={CalendarDays}
              action={
                <Link
                  to="/student/appointments"
                  className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--sp-border)] px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900/30"
                >
                  View Appointment Details
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              }
            >
              Appointment Summary
            </CardTitle>

            {/* A completed visit's appointment is done: back to the default empty state, like the QR. */}
            {trackedAppointment ? (
              <div className="grid flex-1 content-center gap-5 rounded-[10px] border border-gray-100 p-5 dark:border-gray-700 sm:grid-cols-2 sm:divide-x sm:divide-gray-100 dark:sm:divide-gray-700">
                <div className="space-y-5">
                  <DetailRow
                    icon={CalendarDays}
                    label="Date"
                    value={formatDateWithWeekday(trackedAppointment.appointment_date)}
                  />
                  <DetailRow
                    icon={Clock}
                    label="Time"
                    value={trackedAppointment.time_slot || 'N/A'}
                  />
                </div>
                <div className="space-y-5 sm:pl-5">
                  <DetailRow
                    icon={FileText}
                    label="Appointment Type"
                    value={trackedAppointment.service || 'Appointment'}
                    hint={trackedAppointment.concern}
                  />
                  <DetailRow
                    icon={Hash}
                    label="Reference"
                    value={<span className="font-mono">{trackedAppointment.reference_number || 'N/A'}</span>}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <CalendarDays className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                <p>No approved appointment scheduled for today.</p>
                <Link
                  to="/student/appointments"
                  className="text-xs font-semibold text-gray-900 hover:underline dark:text-white"
                >
                  Book an appointment
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Records: its own card, shown once today's visit is finished */}
      {visitCompleted && (
        <div className={`${CARD} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 dark:bg-maroon-900/20">
              <FileText className="h-5 w-5 text-maroon-800 dark:text-maroon-300" />
            </span>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white">View Records</p>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                See your consultation records, findings, and any follow-up instructions from today&apos;s visit.
              </p>
            </div>
          </div>
          <Link
            to="/student/health-records"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] bg-maroon-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-900"
          >
            GO
          </Link>
        </div>
      )}

      {/* Recent QR Activity */}
      <div className={CARD}>
        <CardTitle icon={History}>Recent QR Activity</CardTitle>

        {recentActivity.length > 0 ? (() => {
          const todayItems = recentActivity.filter((item) => item.appointment_date === today);
          const pastItems = recentActivity.filter((item) => item.appointment_date !== today);

          const renderActivityRow = (item) => {
            const badge = QR_STATE_BADGES[item.qr_state] || QR_STATE_BADGES.completed;
            const checkedInTime = formatTime(item.checked_in_at);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedActivity(item)}
                className="flex w-full items-center justify-between gap-4 rounded-[10px] border border-gray-200 bg-gray-50/70 p-4 text-left transition hover:border-gray-300 hover:bg-gray-100/80 dark:border-gray-700 dark:bg-gray-900/30 dark:hover:border-gray-600 dark:hover:bg-gray-800/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.service === 'Consultation' ? 'General Consultation' : item.service || 'Appointment'}
                    </p>
                    <span className={`inline-flex items-center rounded-[10px] border px-2 py-0.5 text-[11px] font-semibold ${badge.tone}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                    {item.qr_note}
                    {checkedInTime ? ` · Checked in at ${checkedInTime}` : ''}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      {formatDate(item.appointment_date)}
                    </p>
                    <p>{item.time_slot || 'N/A'}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </button>
            );
          };

          return (
            <div className="space-y-5">
              {todayItems.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Today
                  </p>
                  <div className="space-y-2.5">
                    {todayItems.map(renderActivityRow)}
                  </div>
                </div>
              )}

              {pastItems.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Past &amp; Other Activity
                  </p>
                  <div className="space-y-2.5">
                    {pastItems.map(renderActivityRow)}
                  </div>
                </div>
              )}
            </div>
          );
        })() : (
          <div className="rounded-[10px] bg-gray-50 p-5 text-center text-sm text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
            No recent QR or check-in activity yet.
          </div>
        )}
      </div>

      {selectedActivity && (() => {
        const badge = QR_STATE_BADGES[selectedActivity.qr_state] || QR_STATE_BADGES.completed;
        const checkedInTime = formatTime(selectedActivity.checked_in_at);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedActivity(null);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="qr-activity-title"
              className="relative w-full max-w-md rounded-[10px] border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            >
              <button
                type="button"
                onClick={() => setSelectedActivity(null)}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-[10px] p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300">
                  <QrCode className="h-6 w-6" />
                </div>
                <h3 id="qr-activity-title" className="text-lg font-bold text-gray-900 dark:text-white">
                  QR Activity Details
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {selectedActivity.qr_note}
                </p>
              </div>

              <div className="mt-5 divide-y divide-gray-200 rounded-[10px] bg-gray-50 px-4 text-sm dark:divide-gray-700 dark:bg-gray-900/40">
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-gray-500 dark:text-gray-400">Status</span>
                  <span className={`inline-flex items-center rounded-[10px] border px-2 py-0.5 text-xs font-semibold ${badge.tone}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-gray-500 dark:text-gray-400">Service</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {selectedActivity.service === 'Consultation' ? 'General Consultation' : selectedActivity.service || 'Appointment'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-gray-500 dark:text-gray-400">Date</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatDateWithWeekday(selectedActivity.appointment_date)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-gray-500 dark:text-gray-400">Time</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {selectedActivity.time_slot || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-gray-500 dark:text-gray-400">Reference</span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-white">
                    {selectedActivity.reference_number || 'N/A'}
                  </span>
                </div>
                {selectedActivity.queue_number && (
                  <div className="flex items-center justify-between gap-4 py-3">
                    <span className="text-gray-500 dark:text-gray-400">Queue Number</span>
                    <span className="font-mono font-semibold text-gray-900 dark:text-white">
                      {selectedActivity.queue_number}
                    </span>
                  </div>
                )}
                {checkedInTime && (
                  <div className="flex items-center justify-between gap-4 py-3">
                    <span className="text-gray-500 dark:text-gray-400">Checked In At</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {checkedInTime}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setSelectedActivity(null)}
                  className="rounded-[10px] bg-gray-100 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </section>
          </div>
        );
      })()}
    </motion.div>
  );
};

export default QR;
