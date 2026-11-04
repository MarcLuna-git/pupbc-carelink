import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Camera, ImageUp, Keyboard, Loader2, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { CARD, PRIMARY_BTN, SECONDARY_BTN } from './KioskV2Layout';

// QR decoders are separate chunks, loaded only when the QR tab is used.
const loadHtml5Qrcode = () => import('html5-qrcode').then((module) => module.Html5Qrcode);
const loadJsQR = () => import('jsqr').then((module) => module.default);

const REGION_ID = 'kioskv2-qr-region';
const HARDWARE_ERRORS = ['NotAllowedError', 'NotFoundError', 'NotReadableError'];

const decodeQrFromFile = async (file) => {
  const jsQR = await loadJsQR();
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read the selected image.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })?.data || null;
  } finally {
    URL.revokeObjectURL(url);
  }
};

// Same QR payload rules as v1: JSON { student_id, hash } or a raw QR hash.
const identityFromQr = (decoded) => {
  const raw = String(decoded || '').trim();
  let studentId = raw;
  let hash = null;
  if (raw.startsWith('{') || raw.includes('student_id')) {
    try {
      const data = JSON.parse(raw);
      studentId = data.student_id || data.studentId || data.id || raw;
      hash = data.hash || data.qr_hash || null;
    } catch {
      // Not JSON: use the raw value.
    }
  } else if (raw.includes('PUPBC-') || raw.length > 20) {
    hash = raw;
  }
  return { student_id: studentId, method: 'qr', qr_hash: hash || raw };
};

// Student ID format: 2021-00123-BN-0. Dashes are inserted while typing.
const STUDENT_ID_SEGMENTS = [
  { length: 4, pattern: /[0-9]/ },
  { length: 5, pattern: /[0-9]/ },
  { length: 2, pattern: /[A-Z]/ },
  { length: 1, pattern: /[0-9]/ },
];
const STUDENT_ID_LENGTH = 15;

const formatStudentId = (value) => {
  const segments = STUDENT_ID_SEGMENTS.map(() => '');
  let segment = 0;
  for (const char of value.toUpperCase().replace(/[^0-9A-Z]/g, '')) {
    while (segment < segments.length && segments[segment].length === STUDENT_ID_SEGMENTS[segment].length) segment += 1;
    if (segment === segments.length) break;
    if (STUDENT_ID_SEGMENTS[segment].pattern.test(char)) segments[segment] += char;
  }
  return segments.filter(Boolean).join('-');
};

const V2Scan = ({ service, onFound, onBack }) => {
  const [mode, setMode] = useState('qr');
  const [camera, setCamera] = useState('starting'); // starting | live | unavailable
  const [studentId, setStudentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const scannerRef = useRef(null);
  // Bumped on every stop, so a camera that finishes starting late shuts itself off.
  const sessionRef = useRef(0);
  const lookupLockRef = useRef(false);
  const lookupRef = useRef(null);

  const stopCamera = async () => {
    sessionRef.current += 1;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try { await scanner.stop(); } catch { /* never started */ }
    try { scanner.clear(); } catch { /* already cleared */ }
  };

  const startCamera = async () => {
    await stopCamera();
    const session = sessionRef.current;
    setError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable');
      setError('Live camera is not available here. Use a photo of your QR code or your Student ID.');
      return;
    }
    setCamera('starting');
    try {
      const Html5Qrcode = await loadHtml5Qrcode();
      let lastError = null;
      // Rear camera first, then front, then whatever the device offers.
      for (const constraints of [{ facingMode: 'environment' }, { facingMode: 'user' }, {}]) {
        if (session !== sessionRef.current) return;
        const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
        try {
          await scanner.start(
            constraints,
            { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
            (text) => lookupRef.current(identityFromQr(text)),
            () => {}
          );
          if (session !== sessionRef.current) {
            try { await scanner.stop(); scanner.clear(); } catch { /* already stopped */ }
            return;
          }
          scannerRef.current = scanner;
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          try { await scanner.stop(); } catch { /* never started */ }
          try { scanner.clear(); } catch { /* already cleared */ }
          if (HARDWARE_ERRORS.includes(err?.name)) break;
        }
      }
      if (lastError) throw lastError;
      setCamera('live');
    } catch (err) {
      if (session !== sessionRef.current) return;
      setCamera('unavailable');
      setError(
        err?.name === 'NotAllowedError'
          ? 'Camera access was denied. Use a photo of your QR code or your Student ID.'
          : 'The camera could not start. Use a photo of your QR code or your Student ID.'
      );
    }
  };

  const lookup = async (identity) => {
    if (lookupLockRef.current) return;
    lookupLockRef.current = true;
    setBusy(true);
    setError('');
    await stopCamera();
    try {
      const response = await api.post('/kiosk/lookup', identity);
      if (!response.data?.success) throw new Error(response.data?.message || 'Student was not found.');
      onFound({ ...response.data.data, identity });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'We could not find your appointment.');
      setCamera('unavailable');
      setBusy(false);
      lookupLockRef.current = false;
    }
  };
  lookupRef.current = lookup;

  useEffect(() => {
    if (mode === 'qr') startCamera();
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const switchMode = (next) => {
    if (busy || next === mode) return;
    setError('');
    setMode(next);
  };

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await stopCamera();
    setError('');
    let text = null;
    try { text = await decodeQrFromFile(file); } catch { /* handled below */ }
    if (!text) {
      setCamera('unavailable');
      setError('No readable QR code was found in the photo. Move closer, avoid glare, and try again.');
      return;
    }
    lookup(identityFromQr(text));
  };

  const submitStudentId = (event) => {
    event.preventDefault();
    if (studentId.length < STUDENT_ID_LENGTH) {
      setError('Enter your complete Student ID, for example 2021-00123-BN-0.');
      return;
    }
    lookup({ student_id: studentId, method: 'manual' });
  };

  const tabClass = (active) =>
    `flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-lg font-semibold transition-colors ${
      active ? 'bg-white text-maroon-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'
    }`;

  return (
    <div className="w-full max-w-xl">
      <span className="inline-block rounded-full bg-maroon-800 px-4 py-1.5 text-sm font-bold text-white">{service}</span>
      <h1 className="mt-3 text-3xl font-extrabold">Check In</h1>
      <p className="mt-1 text-lg text-gray-600">Scan your appointment QR code or enter your Student ID.</p>

      <div role="tablist" aria-label="Check-in method" className="mt-6 flex gap-2 rounded-2xl bg-gray-200/70 p-1.5">
        <button type="button" role="tab" aria-selected={mode === 'qr'} onClick={() => switchMode('qr')} className={tabClass(mode === 'qr')}>
          <Camera className="h-5 w-5" aria-hidden="true" /> Scan QR
        </button>
        <button type="button" role="tab" aria-selected={mode === 'manual'} onClick={() => switchMode('manual')} className={tabClass(mode === 'manual')}>
          <Keyboard className="h-5 w-5" aria-hidden="true" /> Student ID
        </button>
      </div>

      <div className={`${CARD} relative mt-4`}>
        {mode === 'qr' ? (
          <div className="flex flex-col items-center">
            <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-2xl bg-gray-900">
              <div id={REGION_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
              {camera !== 'live' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
                  {camera === 'starting' ? (
                    <><Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" /><p>Starting camera…</p></>
                  ) : (
                    <><Camera className="h-10 w-10" aria-hidden="true" /><p>Camera is off</p></>
                  )}
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-gray-600">
              {camera === 'live' ? 'Hold your QR code inside the frame.' : 'Try the camera again or use a photo of your QR code.'}
            </p>
            <div className="mt-4 flex w-full flex-col gap-3 sm:flex-row">
              {camera === 'unavailable' && (
                <button type="button" onClick={startCamera} disabled={busy} className={`${SECONDARY_BTN} flex-1`}>
                  <RefreshCw className="h-5 w-5" aria-hidden="true" /> Try Camera Again
                </button>
              )}
              <label className={`${SECONDARY_BTN} flex-1 cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                <ImageUp className="h-5 w-5" aria-hidden="true" /> Use a QR Photo
                <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="sr-only" />
              </label>
            </div>
          </div>
        ) : (
          <form onSubmit={submitStudentId}>
            <label htmlFor="kioskv2-student-id" className="block text-lg font-semibold text-gray-800">Student ID</label>
            <input
              id="kioskv2-student-id"
              autoFocus
              autoComplete="off"
              inputMode="text"
              value={studentId}
              onChange={(e) => { setStudentId(formatStudentId(e.target.value)); setError(''); }}
              placeholder="2021-00123-BN-0"
              className="mt-2 w-full rounded-2xl border-2 border-gray-300 px-5 py-4 text-center font-mono text-3xl tracking-wider focus:border-maroon-800 focus:outline-none"
            />
            <button type="submit" disabled={busy || !studentId} className={`${PRIMARY_BTN} mt-5 w-full`}>
              Find My Appointment
            </button>
          </form>
        )}

        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/90 text-lg font-semibold text-maroon-800">
            <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
            Checking your appointment…
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      <button type="button" onClick={onBack} disabled={busy} className={`${SECONDARY_BTN} mt-6 w-full`}>
        <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Back
      </button>
    </div>
  );
};

export default V2Scan;
