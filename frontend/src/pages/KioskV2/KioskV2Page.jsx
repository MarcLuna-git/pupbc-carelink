import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { fetchKioskDevTools } from '../../services/devTools';
import KioskV2Layout, { CARD, PRIMARY_BTN, SECONDARY_BTN } from './KioskV2Layout';
import V2Home from './V2Home';
import V2Terms from './V2Terms';
import V2SelectService, { needsHealthCheck } from './V2SelectService';
import V2Confirm from './V2Confirm';
import V2Health from './V2Health';
import V2Ticket from './V2Ticket';
const V2Scan = lazy(() => import('./V2Scan'));

// Kiosk v2 (/kioskv2): Home → Terms → Service → Check-in → Confirm → (Health Check) → Ticket.
// The queue number is issued only after the student confirms the appointment their QR found.
// Only General Consultation has the Health Check; other services get a Regular ticket on confirm.
// Uses the same /kiosk API and device token as v1; appointments only, no walk-ins.
const STEP_NUMBER = { home: 1, terms: 2, service: 3, scan: 4, notice: 4, confirm: 5, health: 5, ticket: 6 };
const TOKEN_KEY = 'carelink.kiosk.token';
// Unattended screens go back home so the next student never sees someone else's data.
const IDLE_RESET_MS = 120000;


const V2Notice = ({ title, message, primary, secondary }) => (
  <div className={`${CARD} w-full max-w-xl text-center`}>
    <AlertCircle className="mx-auto h-14 w-14 text-amber-500" aria-hidden="true" />
    <h1 className="mt-3 text-2xl font-extrabold">{title}</h1>
    <p className="mt-2 text-lg text-gray-600">{message}</p>
    <button type="button" onClick={primary.onClick} disabled={primary.busy} className={`${PRIMARY_BTN} mt-6 w-full`}>
      {primary.busy ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : primary.label}
    </button>
    <button type="button" onClick={secondary.onClick} disabled={primary.busy} className={`${SECONDARY_BTN} mt-3 w-full`}>
      {secondary.label}
    </button>
  </div>
);

const KioskV2Page = () => {
  const [authorized, setAuthorized] = useState(Boolean(sessionStorage.getItem(TOKEN_KEY) || import.meta.env.VITE_KIOSK_DEVICE_TOKEN));
  const [deviceToken, setDeviceToken] = useState('');
  const [deviceError, setDeviceError] = useState('');

  const [step, setStep] = useState('home');
  const [selectedService, setSelectedService] = useState(null);
  const [student, setStudent] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [notice, setNotice] = useState(null); // 'mismatch'
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => { if (authorized) fetchKioskDevTools().catch(() => {}); }, [authorized]);

  const reset = useCallback(() => {
    setStep('home');
    setSelectedService(null);
    setStudent(null);
    setTicket(null);
    setAlreadyCheckedIn(false);
    setNotice(null);
    setSubmitting(false);
    setSubmitError('');
  }, []);

  useEffect(() => {
    if (step === 'home' || step === 'ticket') return undefined;
    let timer = setTimeout(reset, IDLE_RESET_MS);
    const restart = () => { clearTimeout(timer); timer = setTimeout(reset, IDLE_RESET_MS); };
    window.addEventListener('pointerdown', restart);
    window.addEventListener('keydown', restart);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', restart);
      window.removeEventListener('keydown', restart);
    };
  }, [step, reset]);

  const authorizeDevice = async (event) => {
    event.preventDefault();
    sessionStorage.setItem(TOKEN_KEY, deviceToken.trim());
    try {
      await api.get('/kiosk/queue');
      setAuthorized(true);
      setDeviceToken('');
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      setDeviceError('Device authorization failed. Ask the clinic to verify this device.');
    }
  };

  // Returns the backend's error message, or null when the ticket was issued.
  const checkIn = async (data, triage) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await api.post('/kiosk/checkin', {
        ...data.identity,
        student_id: data.user.student_id,
        ...triage,
      });
      setTicket(response.data.data);
      setStep('ticket');
      return null;
    } catch (err) {
      return err.response?.data?.message || 'Check-in failed. Please try again.';
    } finally {
      setSubmitting(false);
    }
  };

  // After the student is identified: confirm the appointment before any queue number.
  const proceed = () => {
    setSubmitError('');
    setNotice(null);
    setStep('confirm');
  };

  // Confirmed: Consultation answers the health check; other services get the ticket now.
  // The server uses the reason from the portal booking and the regular queue.
  const confirmAppointment = async () => {
    if (needsHealthCheck(student.appointment.service)) {
      setStep('health');
      return;
    }
    const failure = await checkIn(student, {});
    if (failure) setSubmitError(failure);
  };

  const handleFound = async (data) => {
    setStudent(data);
    if (data.has_active_checkin && data.active_checkin) {
      setTicket(data.active_checkin);
      setAlreadyCheckedIn(true);
      setStep('ticket');
    } else if (data.appointment.service !== selectedService) {
      setNotice('mismatch');
      setStep('notice');
    } else {
      proceed();
    }
  };

  const submitHealth = async (triage) => {
    const failure = await checkIn(student, triage);
    if (failure) setSubmitError(failure);
  };

  if (!authorized) {
    return (
      <KioskV2Layout step={1}>
        <form onSubmit={authorizeDevice} className={`${CARD} w-full max-w-md space-y-4`}>
          <h1 className="text-2xl font-extrabold">Clinic Device Setup</h1>
          <p className="text-gray-600">Clinic staff must authorize this tablet before student check-in.</p>
          <label className="block font-semibold">
            Device access token
            <input
              type="password"
              autoComplete="off"
              required
              value={deviceToken}
              onChange={(e) => setDeviceToken(e.target.value)}
              className="mt-2 w-full rounded-xl border-2 border-gray-300 p-3 focus:border-maroon-800 focus:outline-none"
            />
          </label>
          {deviceError && <p role="alert" className="text-red-700">{deviceError}</p>}
          <button className={`${PRIMARY_BTN} w-full`}>Authorize Device</button>
        </form>
      </KioskV2Layout>
    );
  }

  const bookedService = student?.appointment?.service;

  return (
    <KioskV2Layout step={STEP_NUMBER[step]} onHome={reset}>
      {step === 'home' && <V2Home onStart={() => setStep('terms')} />}
      {step === 'terms' && <V2Terms onAgree={() => setStep('service')} onBack={reset} />}
      {step === 'service' && (
        <V2SelectService
          onSelect={(service) => { setSelectedService(service); setStep('scan'); }}
          onBack={() => setStep('terms')}
        />
      )}
      {step === 'scan' && (
        <Suspense fallback={<Loader2 className="h-10 w-10 animate-spin text-maroon-800" />}>
          <V2Scan service={selectedService} onFound={handleFound} onBack={() => setStep('service')} />
        </Suspense>
      )}
      {step === 'notice' && notice === 'mismatch' && (
        <V2Notice
          title="Different Service Booked"
          message={`Your appointment today is for ${bookedService}, not ${selectedService}.`}
          primary={{ label: `Continue with ${bookedService}`, busy: submitting, onClick: proceed }}
          secondary={{ label: 'Choose Again', onClick: () => { setStudent(null); setNotice(null); setStep('service'); } }}
        />
      )}
      {step === 'confirm' && student && (
        <V2Confirm student={student} onConfirm={confirmAppointment} onBack={reset} submitting={submitting} error={submitError} />
      )}
      {step === 'health' && student && (
        <V2Health reason={student.appointment?.concern || ''} onSubmit={submitHealth} onBack={() => { setSubmitError(''); setStep('confirm'); }} submitting={submitting} error={submitError} />
      )}
      {step === 'ticket' && ticket && (
        <V2Ticket ticket={ticket} alreadyCheckedIn={alreadyCheckedIn} service={bookedService} onDone={reset} />
      )}
    </KioskV2Layout>
  );
};

export default KioskV2Page;
