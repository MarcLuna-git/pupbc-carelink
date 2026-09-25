import api from '../../../services/api';
import { clinicDate as getManilaDateString, groupAppointments, formatAppointmentDate } from '../../../utils/appointmentDate';
const formatDate = (value) => formatAppointmentDate(value, { month: 'long' });
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  QrCode,
  Download,
  Printer,
  Loader2,
  Shield,
  Smartphone,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle,
  Users,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import QRCode from 'qrcode';
import clinicLogo from '../../../assets/clinic logo.jpg';

const Skeleton = ({ className = '' }) => (
  <div
    className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl ${className}`}
  />
);

const queueStatusLabel = (status) => {
  switch (status) {
    case 'waiting':
      return 'Waiting';
    case 'serving':
      return 'Now Serving';
    case 'completed':
      return 'Completed';
    case 'no_show':
      return 'No Show';
    default:
      return status
        ? status
            .replaceAll('_', ' ')
            .replace(/\b\w/g, (char) =>
              char.toUpperCase()
            )
        : 'Not checked in';
  }
};

const QR = () => {
  const user = JSON.parse(
    localStorage.getItem('user') || '{}'
  );

  const healthProfileDone =
    user?.profile?.health_profile_completed === true ||
    user?.profile?.health_profile_completed === 1 ||
    user?.profile?.health_profile_completed === '1';

  const [pageLoading, setPageLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [downloading, setDownloading] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [messageType, setMessageType] =
    useState('info');

  const [qrCodeHash, setQrCodeHash] =
    useState('');

  const [qrUsable, setQrUsable] =
    useState(false);

  const [appointments, setAppointments] =
    useState([]);

  const [qrDataUrl, setQrDataUrl] =
    useState('');

  const today = getManilaDateString();
  const todayAppointment = useMemo(
    () => groupAppointments(appointments).today[0] || null,
    [appointments, today]
  );

  const queue =
    todayAppointment?.queue || null;

  const canUseQr =
    Boolean(qrUsable) &&
    Boolean(qrCodeHash) &&
    Boolean(todayAppointment);

  const fetchQrData = async (
    silent = false
  ) => {
    if (!silent) {
      setPageLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [
        qrResponse,
        statusResponse,
        appointmentsResponse,
      ] = await Promise.all([
        api.get('/student/qr'),
        api.get('/student/qr/status'),
        api.get('/student/appointments'),
      ]);

      const qrData =
        qrResponse?.data?.data || null;

      const statusData =
        statusResponse?.data?.data || null;

      const appointmentPayload =
        appointmentsResponse?.data?.data;

      const normalizedAppointments =
        Array.isArray(appointmentPayload)
          ? appointmentPayload
          : Array.isArray(
                appointmentPayload?.data
              )
            ? appointmentPayload.data
            : [];

      setQrCodeHash(
        qrData?.qr_code_hash || ''
      );

      setQrUsable(
        Boolean(
          statusData?.exists &&
            statusData?.active
        )
      );

      setAppointments(
        normalizedAppointments
      );

      if (!silent) {
        setMessage('');
      }
    } catch (error) {
      console.error(
        'QR data load error:',
        error
      );

      setMessageType('error');
      setMessage(
        'Unable to load your QR information. Please try again.'
      );
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (healthProfileDone) {
      fetchQrData();
    } else {
      setPageLoading(false);
    }
  }, [healthProfileDone]);

  useEffect(() => {
    if (!healthProfileDone) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchQrData(true);
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [healthProfileDone]);

  useEffect(() => {
    let cancelled = false;

    const generateQR = async () => {
      if (!canUseQr) {
        setQrDataUrl('');
        return;
      }

      const qrValue = JSON.stringify({
        student_id: user.student_id,
        name:
          `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        hash: qrCodeHash,
      });

      try {
        const dataUrl =
          await QRCode.toDataURL(
            qrValue,
            {
              width: 400,
              margin: 2,
              color: {
                dark: '#5E1224',
                light: '#FFFFFF',
              },
              errorCorrectionLevel: 'H',
            }
          );

        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch (error) {
        console.error(
          'QR generation error:',
          error
        );

        if (!cancelled) {
          setQrDataUrl('');
          setMessageType('error');
          setMessage(
            'Unable to generate your QR code.'
          );
        }
      }
    };

    generateQR();

    return () => {
      cancelled = true;
    };
  }, [
    canUseQr,
    qrCodeHash,
    user.student_id,
    user.first_name,
    user.last_name,
  ]);

  const handleDownload = () => {
    if (!qrDataUrl || !canUseQr) {
      return;
    }

    setDownloading(true);

    try {
      const link =
        document.createElement('a');

      link.href = qrDataUrl;
      link.download =
        `PUPBC-QR-${user.student_id}.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessageType('success');
      setMessage(
        'QR code downloaded successfully.'
      );

      setTimeout(
        () => setMessage(''),
        2500
      );
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (
      !qrDataUrl ||
      !canUseQr ||
      !todayAppointment
    ) {
      return;
    }

    const printWindow =
      window.open('', '_blank');

    if (!printWindow) {
      setMessageType('error');
      setMessage(
        'Pop-up was blocked. Please allow pop-ups to print your QR code.'
      );

      return;
    }

    const safeName =
      `${user.first_name || ''} ${user.last_name || ''}`.trim();

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
              border: 3px solid #5E1224;
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
            <p class="title">
              PUPBC CareLink
            </p>

            <p class="subtitle">
              Clinic Check-in QR
            </p>

            <img
              class="qr"
              src="${qrDataUrl}"
              alt="QR Code"
            />

            <p class="name">
              ${safeName}
            </p>

            <p class="meta">
              ${user.student_id || ''}
            </p>

            <div class="appointment">
              <strong>
                Today's Approved Appointment
              </strong>
              <br />
              ${todayAppointment.service || 'Appointment'}
              <br />
              ${formatDate(
                todayAppointment.appointment_date
              )}
              •
              ${todayAppointment.time_slot || 'N/A'}
            </div>

            <p class="notice">
              Valid for clinic identification and
              today's approved appointment only.
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
            <QrCode className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Health Profile Required
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Complete your Health Profile
            before using clinic check-in.
          </p>

          <Link
            to="/student/health-profile"
            className="inline-flex items-center space-x-2 mt-5 px-6 py-3 bg-maroon-800 text-white font-semibold rounded-2xl hover:bg-maroon-900 transition"
          >
            <span>
              Complete Health Profile
            </span>

            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto">
        <div className="mb-6">
          <Skeleton className="h-7 w-36 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <Skeleton className="h-[470px] rounded-3xl" />
          </div>

          <div className="lg:col-span-2">
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto pb-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My QR Code
          </h1>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Use this for clinic check-in on
            the day of your approved appointment.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            fetchQrData(true)
          }
          disabled={refreshing}
          className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw
            className={`w-4 h-4 text-gray-500 ${
              refreshing
                ? 'animate-spin'
                : ''
            }`}
          />
        </button>
      </div>

      {message && (
        <motion.div
          initial={{
            opacity: 0,
            y: -8,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className={`mb-5 p-3 rounded-2xl text-sm font-medium border ${
            messageType === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30'
              : messageType ===
                  'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30'
          }`}
        >
          {message}
        </motion.div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {canUseQr ? (
            <>
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.97,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700 text-center shadow-sm"
              >
                <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Approved for today's visit
                </div>

                <div className="relative inline-block mb-5">
                  <div className="bg-white border-[3px] border-maroon-800 dark:border-maroon-700 rounded-2xl p-3 sm:p-4 shadow-lg">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Clinic QR Code"
                        className="w-44 h-44 sm:w-56 sm:h-56 lg:w-64 lg:h-64 xl:w-72 xl:h-72"
                      />
                    ) : (
                      <div className="w-44 h-44 sm:w-56 sm:h-56 lg:w-64 lg:h-64 xl:w-72 xl:h-72 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-maroon-800" />
                      </div>
                    )}
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-white rounded-full shadow-md flex items-center justify-center border-2 border-maroon-800 overflow-hidden">
                      <img
                        src={clinicLogo}
                        alt="PUPBC CareLink"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  {user.first_name}{' '}
                  {user.last_name}
                </h2>

                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {user.student_id}
                </p>

                <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500">
                  {user.course || '—'}
                  {user.year
                    ? ` • ${user.year}`
                    : ''}
                  {user.section
                    ? ` • ${user.section}`
                    : ''}
                </p>
              </motion.div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={
                    downloading ||
                    !qrDataUrl
                  }
                  className="flex items-center justify-center gap-2 py-3.5 bg-maroon-800 text-white font-semibold rounded-2xl hover:bg-maroon-900 transition shadow-lg shadow-maroon-800/20 disabled:opacity-50 text-sm sm:text-base"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}

                  <span>
                    {downloading
                      ? 'Downloading...'
                      : 'Download'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!qrDataUrl}
                  className="flex items-center justify-center gap-2 py-3.5 bg-white dark:bg-gray-800 border-2 border-maroon-800 dark:border-maroon-700 text-maroon-800 dark:text-maroon-400 font-semibold rounded-2xl hover:bg-maroon-50 dark:hover:bg-maroon-900/20 transition disabled:opacity-50 text-sm sm:text-base"
                >
                  <Printer className="w-4 h-4" />

                  <span>
                    Print
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-7 sm:p-10 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <QrCode className="w-8 h-8 text-gray-400" />
              </div>

              <h2 className="mt-5 text-lg font-bold text-gray-900 dark:text-white">
                QR Check-in Not Available
              </h2>

              {!qrUsable ? (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Your QR credential is currently
                  unavailable. Please contact the
                  clinic if this continues.
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  You need an approved appointment
                  scheduled for today before the QR
                  can be used at the clinic kiosk.
                </p>
              )}

              <Link
                to="/student/appointments"
                className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-maroon-800 text-white text-sm font-semibold hover:bg-maroon-900 transition"
              >
                <Calendar className="w-4 h-4" />

                View Appointments
              </Link>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {todayAppointment && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-5 sm:p-6">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-maroon-700 dark:text-maroon-400" />
                Today's Appointment
              </h3>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-gray-400">
                    Service
                  </p>

                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {todayAppointment.service ||
                      'Appointment'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">
                      Date
                    </p>

                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {formatDate(
                        todayAppointment.appointment_date
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">
                      Time
                    </p>

                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {todayAppointment.time_slot ||
                        'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider text-gray-400">
                    Reference
                  </p>

                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {todayAppointment.reference_number ||
                      'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {queue && (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-3xl p-5 sm:p-6">
              <h3 className="font-bold text-green-900 dark:text-green-400 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Queue Status
              </h3>

              <div className="mt-4">
                <p className="text-xs text-green-700 dark:text-green-500">
                  Queue Number
                </p>

                <p className="text-3xl font-black text-green-900 dark:text-green-300 mt-1">
                  {queue.queue_number ||
                    '—'}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-green-700/70 dark:text-green-500/70">
                    Type
                  </p>

                  <p className="text-sm font-semibold text-green-900 dark:text-green-300 capitalize">
                    {queue.queue_type ||
                      'Regular'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider text-green-700/70 dark:text-green-500/70">
                    Status
                  </p>

                  <p className="text-sm font-semibold text-green-900 dark:text-green-300">
                    {queueStatusLabel(
                      queue.status
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {todayAppointment && !queue && (
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-3xl p-5">
              <div className="flex gap-3">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />

                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-400">
                    Not checked in yet
                  </p>

                  <p className="text-xs text-blue-700 dark:text-blue-500 mt-1 leading-relaxed">
                    Scan your QR at the clinic kiosk
                    when you arrive. Your queue
                    number will appear here after
                    check-in and triage.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-maroon-50 dark:bg-maroon-900/10 border border-maroon-200 dark:border-maroon-800/20 rounded-3xl p-5 sm:p-6">
            <h3 className="font-bold text-maroon-900 dark:text-maroon-400 mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              How to Use
            </h3>

            <div className="space-y-4">
              {[
                {
                  step: 1,
                  title: 'Go to the Clinic',
                  desc:
                    'Arrive around 10–15 minutes before your approved appointment.',
                },
                {
                  step: 2,
                  title: 'Scan Your QR',
                  desc:
                    'Present the QR to the clinic kiosk to identify your appointment.',
                },
                {
                  step: 3,
                  title: 'Complete Check-in',
                  desc:
                    'Follow the kiosk instructions and complete triage.',
                },
                {
                  step: 4,
                  title: 'Wait for Your Turn',
                  desc:
                    'Your queue number and current queue status will appear here.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex gap-3"
                >
                  <div className="w-7 h-7 bg-maroon-200 dark:bg-maroon-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-maroon-800 dark:text-maroon-300">
                      {item.step}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.title}
                    </p>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-3xl p-5">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />

              <div>
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">
                  Keep Your QR Private
                </p>

                <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1 leading-relaxed">
                  This QR identifies your student
                  account at the clinic. Do not
                  share screenshots or printed
                  copies with other people.
                  Medical information is not stored
                  directly inside the QR.
                </p>
              </div>
            </div>
          </div>

          {!todayAppointment && (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />

                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Future approved appointments will
                  become eligible for QR check-in
                  on their scheduled date.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QR;
