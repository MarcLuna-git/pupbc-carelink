import { lazy, Suspense, useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import api from '../../services/api';
import KioskLayout from '../../layouts/KioskLayout';
import KioskErrorModal from './KioskErrorModal';
import KioskWelcome from './KioskWelcome';
import KioskTerms from './KioskTerms';
import KioskOptions from './KioskOptions';
import KioskConfirm from './KioskConfirm';
import KioskQueue from './KioskQueue';

const KioskScan = lazy(() => import('./KioskScan'));

const DEV_UNLOCK_KEY = 'carelink.kiosk.dev_unlocked';

const todayIso = () => new Date().toISOString().slice(0, 10);

const buildDemoStudent = (studentId = '2026-00001-BN-0', activeCheckin = false) => ({
  demo: true,
  has_active_checkin: activeCheckin,
  active_checkin: activeCheckin
    ? { id: 'demo-active', queue_number: 'R-005', priority: 'LOW', status: 'waiting' }
    : null,
  identity: { student_id: studentId || '2026-00001-BN-0', method: 'manual' },
  user: {
    student_id: studentId || '2026-00001-BN-0',
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    full_name: 'Juan Dela Cruz',
  },
  appointment: {
    id: 'demo-appt',
    reference_number: 'APT-DEMO-001',
    service: 'General Consultation',
    appointment_date: todayIso(),
    appointment_time: '09:00 AM',
    concern: 'Headache and mild fever',
  },
});

const DEMO_CHECKIN = {
  id: 'demo-checkin',
  queue_number: 'R-001',
  queue_type: 'regular',
  priority: 'LOW',
  status: 'waiting',
};

const DEMO_PAGES = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'terms', label: 'Terms' },
  { id: 'options', label: 'Options' },
  { id: 'scan-qr', label: 'Scan QR' },
  { id: 'scan-manual', label: 'Enter ID' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'already-checked-in', label: 'Checked In' },
  { id: 'queue', label: 'Queue' },
];

/*
 * Hidden Kiosk Demo / Dev Mode (/kiosk/dev).
 * No button or link points here from the normal kiosk.
 * Protected by the admin/developer password and makes ZERO database writes.
 */
const KioskDev = () => {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(DEV_UNLOCK_KEY) === '1');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const [step, setStep] = useState('welcome');
  const [scanMethod, setScanMethod] = useState('qr');
  const [studentData, setStudentData] = useState(() => buildDemoStudent());
  const [checkinData, setCheckinData] = useState(DEMO_CHECKIN);

  const handleUnlock = async (event) => {
    event.preventDefault();
    if (verifying) return;
    setVerifying(true);
    setError('');
    try {
      await api.post('/kiosk/dev-verify', { password });
      sessionStorage.setItem(DEV_UNLOCK_KEY, '1');
      setUnlocked(true);
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect admin password.');
    } finally {
      setVerifying(false);
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem(DEV_UNLOCK_KEY);
    setUnlocked(false);
    setStep('welcome');
    setPassword('');
  };

  const jumpTo = (target) => {
    if (target === 'scan-qr') {
      setScanMethod('qr');
      setStep('scan');
    } else if (target === 'scan-manual') {
      setScanMethod('manual');
      setStep('scan');
    } else if (target === 'confirm') {
      setStudentData(buildDemoStudent(studentData?.user?.student_id, false));
      setStep('confirm');
    } else if (target === 'already-checked-in') {
      setStudentData(buildDemoStudent(studentData?.user?.student_id, true));
      setStep('confirm');
    } else if (target === 'queue') {
      setCheckinData((prev) => prev || DEMO_CHECKIN);
      setStep('queue');
    } else {
      setStep(target);
    }
  };

  const activeJump =
    step === 'scan'
      ? (scanMethod === 'qr' ? 'scan-qr' : 'scan-manual')
      : step === 'confirm' && studentData?.has_active_checkin
        ? 'already-checked-in'
        : step;

  if (!unlocked) {
    return (
      <KioskLayout>
        <div className="mx-auto w-full max-w-md rounded-[15px] border border-white/15 bg-white/10 p-6 text-white backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] bg-yellow-400/20 text-yellow-300">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-center text-2xl font-bold">Kiosk Demo Mode</h1>
          <p className="mt-2 text-center text-sm text-white/75">
            Enter the admin password to preview all kiosk screens without saving to the database.
          </p>

          <form onSubmit={handleUnlock} autoComplete="off" className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-white/85">
              Admin password
              <div className="relative mt-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  autoComplete="off"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter admin password"
                  className="w-full rounded-[15px] border border-white/20 bg-white/5 px-4 py-3 pr-11 text-white placeholder:text-white/40 focus:border-yellow-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={verifying || !password}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[15px] bg-yellow-400 px-6 py-3 font-extrabold text-maroon-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {verifying ? 'Checking...' : 'Unlock Demo Mode'}
            </button>
          </form>
        </div>

        <KioskErrorModal
          open={Boolean(error)}
          title="Access Denied"
          message={error}
          onClose={() => setError('')}
        />
      </KioskLayout>
    );
  }

  return (
    <div className="relative">
      <div className="fixed top-2 left-1/2 z-50 flex max-w-[96vw] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-[12px] border border-yellow-400/40 bg-maroon-950/90 px-3 py-1.5 text-xs text-white shadow-xl backdrop-blur-md">
        <span className="mr-1 rounded bg-yellow-400 px-2 py-0.5 font-extrabold text-maroon-950">
          DEMO · NO DB
        </span>
        {DEMO_PAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => jumpTo(page.id)}
            className={`cursor-pointer rounded-[8px] px-2.5 py-1 font-semibold ${
              activeJump === page.id
                ? 'bg-white text-maroon-950'
                : 'bg-white/10 text-white/85'
            }`}
          >
            {page.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleLock}
          className="ml-1 cursor-pointer rounded-[8px] border border-white/20 px-2.5 py-1 font-semibold text-white/80"
        >
          Lock
        </button>
      </div>

      {step === 'welcome' && <KioskWelcome onStart={() => setStep('terms')} />}
      {step === 'terms' && (
        <KioskTerms
          onAgree={() => setStep('options')}
          onDecline={() => setStep('welcome')}
          onBack={() => setStep('welcome')}
        />
      )}
      {step === 'options' && (
        <KioskOptions
          onScanQR={() => { setScanMethod('qr'); setStep('scan'); }}
          onEnterID={() => { setScanMethod('manual'); setStep('scan'); }}
          onBack={() => setStep('terms')}
        />
      )}
      {step === 'scan' && (
        <Suspense fallback={null}>
          <KioskScan
            demoMode
            method={scanMethod}
            onBack={() => setStep('options')}
            onStudentFound={(found) => {
              const id = found?.identity?.student_id || '2026-00001-BN-0';
              setStudentData({
                ...buildDemoStudent(id, false),
                ...found,
              });
              setStep('confirm');
            }}
          />
        </Suspense>
      )}
      {step === 'confirm' && studentData && (
        <KioskConfirm
          demoMode
          data={studentData}
          onBack={() => setStep('scan')}
          onDone={() => setStep('welcome')}
          onCheckedIn={(checkedIn) => {
            setCheckinData(checkedIn);
            setStep('queue');
          }}
        />
      )}
      {step === 'queue' && (
        <KioskQueue
          demoMode
          checkin={checkinData || DEMO_CHECKIN}
          onDone={() => setStep('welcome')}
        />
      )}
    </div>
  );
};

export default KioskDev;
