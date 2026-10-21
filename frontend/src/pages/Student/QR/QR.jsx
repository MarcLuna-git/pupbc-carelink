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
  CircleCheck,
  Users,
  LogIn,
  IdCard,
  Info,
  Stethoscope,
  FileText,
  Hash,
  History,
  ArrowRight,
} from 'lucide-react';
import QRCode from 'qrcode';
import useVisiblePolling from '../../../hooks/useVisiblePolling';
import StudentPageHero, { HeroRefreshButton } from '../../../components/StudentPageHero';
import HealthProfileVerifyError from '../../../components/HealthProfileVerifyError';
import { useStudentHealthProfileStatus } from '../../../hooks/useStudentHealthProfileStatus';
import { formatPersonName } from '../../../utils/studentUser';
import { escapeHtml } from '../../../utils/escapeHtml';

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

const checkinStepIndex = (queue, appointment) => {
  if (appointment?.status === 'completed') return 3;
  switch (queue?.status) {
    case 'waiting':
      return 1;
    case 'serving':
      return 2;
    case 'completed':
      return 3;
    default:
      return 0;
  }
};

/*
 * ROUTE LOADING — same restored effect as the Settings / Profile / Records
 * pages, scoped to this page. TEMP DEMO TIMER: holds the loading phase so
 * the animation is visible even when the API answers quickly on localhost.
 */
const ROUTE_LOADING_DELAY = 1600;

const LOAD_ERROR = 'Unable to load your QR information. Please try again.';

const CARD =
  'rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface)] p-5 lg:p-6';

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700 ${className}`} />
);

const QR_HERO = {
  id: 'qr-title',
  title: 'QR Code',
  art: QrCode,
  description: 'Use your QR code for a faster and easier clinic check-in at the PUP Student Clinic.',
};

const CardTitle = ({ icon: Icon, children, action }) => (
  <div className="mb-5 flex items-center justify-between gap-3">
    <h2 className="flex items-center gap-2.5 text-lg font-bold text-maroon-800 dark:text-maroon-300">
      <Icon className="h-6 w-6" />
      {children}
    </h2>
    {action}
  </div>
);

/* Icon tile + label/value row used in the QR card and summary. */
const DetailRow = ({ icon: Icon, label, value, hint }) => (
  <div className="flex items-start gap-3.5">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300">
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
  { icon: IdCard, title: 'Bring your PUP ID', desc: 'Present your valid PUP ID at the kiosk.' },
  { icon: Clock, title: 'Arrive early', desc: 'Check in within the valid time window.' },
  { icon: Info, title: 'Use the clinic kiosk', desc: 'Scan your QR code at the Student Clinic kiosk.' },
];

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
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [qrCodeHash, setQrCodeHash] = useState('');
  const [qrUsable, setQrUsable] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const hasLoadedRef = useRef(false);

  // Check-in window state
  const [checkinOpensAt, setCheckinOpensAt] = useState(null);
  const [checkinDeadlineAt, setCheckinDeadlineAt] = useState(null);

  const today = getManilaDateString();
  // Today's visit stays on this page all day — including after it is completed.
  const todayAppointment = useMemo(
    () => appointments.find((item) =>
      ['approved', 'completed'].includes(item.status) &&
      appointmentDate(item.appointment_date) === today) || null,
    // `today` re-evaluates the selection when the clinic day rolls over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, today]
  );

  const queue = todayAppointment?.queue || null;
  const visitCompleted = todayAppointment?.status === 'completed' || queue?.status === 'completed';
  // Kiosk → Developer Tools → Remove time Guard opens check-in for the whole day.
  const allDayWindow = Boolean(checkinOpensAt && checkinDeadlineAt) &&
    formatTime(checkinOpensAt) === '12:00 AM' && formatTime(checkinDeadlineAt) === '11:59 PM';

  const canUseQr =
    Boolean(qrUsable) &&
    Boolean(qrCodeHash) &&
    Boolean(todayAppointment);

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

  /* Demo timer: keeps the loading phase on screen long enough to see it. */
  useEffect(() => {
    const timer = setTimeout(() => setRouteReady(true), ROUTE_LOADING_DELAY);
    return () => clearTimeout(timer);
  }, []);

  // Background polls pass the poller's signal; a manual Refresh passes none.
  const fetchQrData = async (signal) => {
    const background = Boolean(signal);
    setRefreshing(true);
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
      setRefreshing(false);
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
          <style>
            body {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f8f8f8;
              font-family: Arial, sans-serif;
            }

            .card {
              width: 360px;
              padding: 32px;
              text-align: center;
              background: white;
              border-radius: 20px;
              border: 1px solid #e5e7eb;
            }

            .title {
              color: #5E1224;
              font-size: 20px;
              font-weight: 700;
              margin: 0 0 4px;
            }

            .subtitle {
              color: #6b7280;
              font-size: 13px;
              margin: 0 0 20px;
            }

            .qr {
              width: 250px;
              height: 250px;
              padding: 10px;
              border: 1px solid #e5e7eb;
              border-radius: 18px;
            }

            .name {
              margin: 16px 0 4px;
              font-size: 18px;
              font-weight: 700;
            }

            .meta {
              margin: 4px 0;
              color: #6b7280;
              font-size: 13px;
            }

            .appointment {
              margin-top: 18px;
              padding: 12px;
              text-align: left;
              background: #f9fafb;
              border-radius: 12px;
              font-size: 12px;
              line-height: 1.6;
            }

            .notice {
              margin-top: 18px;
              color: #9ca3af;
              font-size: 10px;
            }
          </style>
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

          <script>
            setTimeout(function () {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
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

        <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* Ghost of the QR card */}
          <div className={CARD}>
            <div className="mb-5 flex items-center justify-between">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-11 w-36 rounded-xl" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-56 w-56 rounded-2xl" />
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3.5 w-32" />
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
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/30">
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
              <Skeleton className="mb-5 h-6 w-48" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
            </div>

            {/* Ghost of Appointment Summary — stretches like the real card */}
            <div className={`${CARD} flex flex-1 flex-col`}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <Skeleton className="h-6 w-52" />
                <Skeleton className="h-8 w-44 rounded-lg" />
              </div>
              <Skeleton className="min-h-48 w-full flex-1 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Ghost of Check-in Status */}
        <div className={CARD}>
          <Skeleton className="mb-5 h-6 w-40" />
          <div className="grid gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="flex gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-32 max-w-full" />
                </div>
              </div>
            ))}
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
  const currentStep = checkinStepIndex(queue, todayAppointment);
  const isNoShow = queue?.status === 'no_show';
  const opensLabel = formatTime(checkinOpensAt);
  const deadlineLabel = formatTime(checkinDeadlineAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full min-w-0 space-y-3"
    >
      <StudentPageHero
        {...QR_HERO}
        action={
          <HeroRefreshButton
            onClick={() => fetchQrData()}
            refreshing={refreshing}
            label="Refresh QR information"
          />
        }
      />

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          role={messageType === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border p-3 text-sm font-medium ${
            messageType === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-400'
              : messageType === 'success'
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800/30 dark:bg-green-900/20 dark:text-green-400'
                : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/30 dark:bg-blue-900/20 dark:text-blue-400'
          }`}
        >
          {message}
        </motion.div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Your QR Code */}
        <div className={CARD}>
          <CardTitle
            icon={QrCode}
            action={
              canUseQr && (
                <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 dark:bg-green-900/20">
                  <CircleCheck className="h-5 w-5 fill-green-600 text-white dark:fill-green-500 dark:text-green-950" />
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">{visitCompleted ? 'Visit Completed' : 'Approved'}</p>
                    <p className="text-[11px] text-green-700/80 dark:text-green-500/80">{visitCompleted ? 'Your clinic visit is finished' : 'Ready for Check-in'}</p>
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
              <div className="inline-block rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-600">
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
                  className="flex items-center justify-center gap-2 rounded-xl bg-maroon-800 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-900 disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span>{downloading ? 'Downloading...' : 'Download'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!qrDataUrl}
                  className="flex items-center justify-center gap-2 rounded-xl border border-maroon-800 bg-white py-2.5 text-sm font-semibold text-maroon-800 transition hover:bg-maroon-50 disabled:opacity-50 dark:border-maroon-700 dark:bg-gray-800 dark:text-maroon-300 dark:hover:bg-maroon-900/20"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700">
                <QrCode className="h-8 w-8 text-gray-400" />
              </div>

              <h3 className="mt-5 text-lg font-bold text-gray-900 dark:text-white">QR Check-in Not Available</h3>

              <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                {todayAppointment
                  ? 'Your QR credential is currently unavailable. Please contact the clinic if this continues.'
                  : 'You need an approved appointment scheduled for today before the QR can be used at the clinic kiosk.'}
              </p>

              <Link
                to="/student/appointments"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-maroon-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-900"
              >
                <CalendarDays className="h-4 w-4" />
                View Appointments
              </Link>
            </div>
          )}

          {todayAppointment && (
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
          <div className="mt-6 flex items-start gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/30">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Keep Your QR Private</p>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                This QR identifies your student account at the clinic. Do not share screenshots or printed copies with other people. Medical information is not stored directly inside the QR.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* Check-in Information */}
          <div className={CARD}>
            <CardTitle icon={Clock}>Check-in Information</CardTitle>

            {opensLabel && deadlineLabel ? (
              <div className="grid gap-4 rounded-xl bg-maroon-50/70 p-5 dark:bg-maroon-900/20 sm:grid-cols-2 sm:divide-x sm:divide-maroon-100 dark:sm:divide-maroon-900/40">
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
              <div className="rounded-xl bg-maroon-50/70 p-5 text-sm text-gray-600 dark:bg-maroon-900/20 dark:text-gray-400">
                Your check-in window will appear here on the day of an approved appointment.
              </div>
            )}

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {CHECKIN_TIPS.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-xl bg-maroon-50/50 p-3.5 dark:bg-maroon-900/10"
                >
                  <Icon className="mt-0.5 h-6 w-6 shrink-0 text-maroon-700 dark:text-maroon-300" />
                  <div>
                    <p className="text-sm font-semibold text-maroon-800 dark:text-maroon-300">{title}</p>
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-maroon-800 px-3 py-2 text-xs font-semibold text-maroon-800 transition hover:bg-maroon-50 dark:border-maroon-700 dark:text-maroon-300 dark:hover:bg-maroon-900/20"
                >
                  View Appointment Details
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              Appointment Summary
            </CardTitle>

            {todayAppointment ? (
              <div className="grid flex-1 content-center gap-5 rounded-xl border border-gray-100 p-5 dark:border-gray-700 sm:grid-cols-2 sm:divide-x sm:divide-gray-100 dark:sm:divide-gray-700">
                <div className="space-y-5">
                  <DetailRow
                    icon={CalendarDays}
                    label="Date"
                    value={formatDateWithWeekday(todayAppointment.appointment_date)}
                  />
                  <DetailRow
                    icon={Clock}
                    label="Time"
                    value={todayAppointment.time_slot || 'N/A'}
                  />
                </div>
                <div className="space-y-5 sm:pl-5">
                  <DetailRow
                    icon={FileText}
                    label="Appointment Type"
                    value={todayAppointment.service || 'Appointment'}
                    hint={todayAppointment.concern}
                  />
                  <DetailRow
                    icon={Hash}
                    label="Reference"
                    value={<span className="font-mono">{todayAppointment.reference_number || 'N/A'}</span>}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <CalendarDays className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                <p>No approved appointment scheduled for today.</p>
                <Link
                  to="/student/appointments"
                  className="text-xs font-semibold text-maroon-800 hover:underline dark:text-maroon-300"
                >
                  Book an appointment
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Check-in Status */}
      <div className={CARD}>
          <CardTitle icon={History}>Check-in Status</CardTitle>

          {!todayAppointment && (
            <p className="-mt-2 mb-4 text-xs text-gray-500 dark:text-gray-400">
              Your progress will be tracked here on the day of an approved appointment.
            </p>
          )}

          {isNoShow ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/30 dark:bg-red-900/20">
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
                const active = Boolean(todayAppointment) && index === currentStep;
                const done = index < currentStep;
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
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{step.desc}</p>
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
    </motion.div>
  );
};

export default QR;
