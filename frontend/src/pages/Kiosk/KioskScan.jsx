import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  ArrowLeft,
  User,
  CheckCircle,
  RefreshCw,
  Delete,
} from 'lucide-react';
import api from '../../services/api';
import KioskLayout from '../../layouts/KioskLayout';
import KioskErrorModal from './KioskErrorModal';

/* Ang mga QR decoder ay hiwalay na chunk; ikinakarga lang kapag camera o
   larawan ang gamit, hindi kapag manual na Student ID ang pinili. */
const loadHtml5Qrcode = () =>
  import('html5-qrcode').then((module) => module.Html5Qrcode);
const loadJsQR = () => import('jsqr').then((module) => module.default);

/* Mas maaasahan ang jsQR sa pag-decode ng nakapasang larawan kaysa sa
   scanFile() ng html5-qrcode, lalo na sa maliliit na quiet zone. */
const decodeQrFromFile = async (file) => {
  const jsQR = await loadJsQR();

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );

        const result = jsQR(
          imageData.data,
          imageData.width,
          imageData.height,
          { inversionAttempts: 'attemptBoth' }
        );

        resolve(result ? result.data : null);
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read the selected image.'));
    };

    image.src = objectUrl;
  });
};

/* Ginagawang nababasang text ang kahit anong error (minsan string lang ang
   ibinabato ng html5-qrcode), para makita sa tablet ang totoong sanhi. */
const describeError = (err) => {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;

  const status = err.response?.status;
  const parts = [];

  if (status) parts.push(`HTTP ${status}`);
  if (err.code) parts.push(err.code);
  if (err.name && err.name !== 'Error') parts.push(err.name);
  if (err.message) parts.push(err.message);

  return parts.join(' | ') || String(err);
};

const errorHas = (err, word) => describeError(err).includes(word);

const CAMERA_KEY = 'carelink.kiosk.camera';

const savedFacing = () => {
  try {
    return localStorage.getItem(CAMERA_KEY) === 'environment'
      ? 'environment'
      : 'user';
  } catch {
    return 'user';
  }
};

// Student ID format: 2001-00123-BN-0 (4 digits, 5 digits, automatic -BN-, 1 digit 0/1).
const formatStudentId = (value) => {
  const raw = String(value ?? '').replace(/\D/g, '');
  const prefix = raw.slice(0, 9);
  const last = raw.length > 9 && /^[01]$/.test(raw[9]) ? raw[9] : '';

  if (prefix.length < 4) return prefix;
  if (prefix.length === 4) return `${prefix}-`;
  if (prefix.length < 9) return `${prefix.slice(0, 4)}-${prefix.slice(4)}`;
  if (!last) return `${prefix.slice(0, 4)}-${prefix.slice(4)}-BN-`;
  return `${prefix.slice(0, 4)}-${prefix.slice(4)}-BN-${last}`;
};

const KioskScan = ({
  onStudentFound,
  onBack,
  method: initialMethod,
  demoMode = false,
}) => {
  const [methodTab, setMethodTab] = useState(initialMethod || 'manual');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorTitle, setErrorTitle] = useState('Check-In Notice');
  const [success, setSuccess] = useState(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);
  const [liveCameraSupported, setLiveCameraSupported] = useState(true);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const frameTimerRef = useRef(null);
  const frameCanvasRef = useRef(null);
  const facingRef = useRef(savedFacing());

  const showError = (title, message) => {
    setErrorTitle(title || 'Check-In Notice');
    setError(message);
  };

  const isScanningRef = useRef(false);
  const scanCooldownRef = useRef(false);

  const qrRegionId = 'qr-reader-region';

  useEffect(() => {
    return () => {
      stopQrScanner();
    };
  }, []);

  useEffect(() => {
    if (methodTab === 'qr') {
      const timer = setTimeout(() => {
        startQrScanner();
      }, 150);

      return () => clearTimeout(timer);
    }

    stopQrScanner();
  }, [methodTab]);

  const startQrScanner = async () => {
    setError('');
    setCameraReady(false);

    isScanningRef.current = false;
    scanCooldownRef.current = false;

    /* Blocked ang live camera sa HTTP LAN; QR photo ang fallback. */

    const canUseLiveCamera =
      window.isSecureContext &&
      !!navigator.mediaDevices?.getUserMedia;

    setLiveCameraSupported(canUseLiveCamera);

    if (!canUseLiveCamera) {
      await stopQrScanner();

      showError(
        'Camera Unavailable',
        'The camera cannot be used on this page. Please take a photo of the QR code instead.',
        `secureContext=${window.isSecureContext}, mediaDevices=${!!navigator.mediaDevices}, protocol=${window.location.protocol}`
      );

      return;
    }

    try {
      await stopQrScanner();

      // Ikarga ang decoder habang naghihintay ng scanner container.
      const [Html5Qrcode, jsQR] = await Promise.all([
        loadHtml5Qrcode(),
        loadJsQR().catch(() => null),
        // Hintayin munang ma-render ang scanner container.
        new Promise((resolve) => setTimeout(resolve, 300)),
      ]);

      const element = document.getElementById(qrRegionId);

      if (!element) {
        showError(
          'Camera Unavailable',
          'The QR scanner could not start. Please enter your Student ID.',
          'Scanner container was not found on the page.'
        );
        return;
      }

      element.innerHTML = '';

      /* Walang qrbox: buong larawan ng camera ang binabasa, kaya hindi na
         kailangang itapat ang QR sa maliit na kahon. */
      const baseConfig = {
        fps: 10,
      };

      const onDecoded = (decodedText) => {
        handleQRScanned(decodedText);
      };

      const onFrameError = () => {
        // Normal lang ang per-frame decode failures habang naghahanap ng QR.
      };

      /* Kiosk ito: nakaharap ang student sa screen at itinatapat ang QR sa
         harap, kaya front camera muna ("user"), tapos rear camera, tapos default.
         Sa tablet, kapag rear ang inuna, sa likod ng device nag-i-scan.
         Hindi exact ang hinihingi para hindi mag-OverconstrainedError sa
         device na walang ganoong camera. */
      const preferred = facingRef.current;
      const other = preferred === 'user' ? 'environment' : 'user';

      /* Mas mataas na resolution para mabasa ang QR kahit malayo nang kaunti. */
      const sharp = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

      const candidates = [
        { facingMode: preferred, ...sharp },
        { facingMode: other, ...sharp },
        { ...sharp },
      ];

      let lastError = null;

      for (const constraints of candidates) {
        const html5QrCode = new Html5Qrcode(qrRegionId, {
          verbose: false,
        });

        scannerRef.current = html5QrCode;

        try {
          await html5QrCode.start(
            { facingMode: constraints.facingMode || preferred },
            { ...baseConfig, videoConstraints: constraints },
            onDecoded,
            onFrameError
          );

          lastError = null;
          break;
        } catch (err) {
          lastError = err;

          try {
            await html5QrCode.stop();
          } catch {
            // Hindi pa umiiral ang camera session.
          }

          try {
            html5QrCode.clear();
          } catch {
            // Puwedeng cleared na.
          }

          if (scannerRef.current === html5QrCode) {
            scannerRef.current = null;
          }

          // Huwag nang mag-retry kapag permission o hardware ang problema.
          if (
            errorHas(err, 'NotAllowedError') ||
            errorHas(err, 'NotFoundError') ||
            errorHas(err, 'NotReadableError')
          ) {
            throw err;
          }
        }
      }

      if (lastError) {
        throw lastError;
      }

      setCameraReady(true);

      /* Pangalawang decoder: binabasa ng jsQR ang buong frame ng video sa
         totoong linaw nito. Ang html5-qrcode ay nagbabasa lang sa laki ng
         nakikitang video, kaya madalas hindi nito mabasa ang maliit na QR. */
      if (jsQR) {
        let busy = false;

        frameTimerRef.current = setInterval(() => {
          if (busy || isScanningRef.current || scanCooldownRef.current) return;

          const video = document.querySelector(`#${qrRegionId} video`);

          if (!video || video.readyState < 2 || !video.videoWidth) return;

          busy = true;

          try {
            const scale = Math.min(1, 1024 / video.videoWidth);
            const width = Math.round(video.videoWidth * scale);
            const height = Math.round(video.videoHeight * scale);

            const canvas =
              frameCanvasRef.current ||
              (frameCanvasRef.current = document.createElement('canvas'));

            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext('2d', {
              willReadFrequently: true,
            });

            context.drawImage(video, 0, 0, width, height);

            const frame = context.getImageData(0, 0, width, height);
            const result = jsQR(frame.data, width, height, {
              inversionAttempts: 'dontInvert',
            });

            if (result?.data) {
              handleQRScanned(result.data);
            }
          } catch (frameErr) {
            console.error('QR frame read error:', frameErr);
            clearInterval(frameTimerRef.current);
            frameTimerRef.current = null;
          } finally {
            busy = false;
          }
        }, 350);
      }
    } catch (err) {
      console.error('QR Scanner error:', err);

      let errorMessage =
        'The camera could not be opened. You can take a QR photo instead.';

      if (errorHas(err, 'NotAllowed')) {
        errorMessage =
          'The camera is not allowed on this tablet. Allow the camera for this site in the browser settings, then tap Retry Camera.';
      } else if (errorHas(err, 'NotFound')) {
        errorMessage =
          'No camera was found. Please take a QR photo or enter your Student ID.';
      } else if (errorHas(err, 'NotReadable')) {
        errorMessage =
          'The camera is being used by another app. Close the other app, then tap Retry Camera.';
      }

      showError('Camera Unavailable', errorMessage, err);
      setCameraReady(false);
    }
  };

  const stopQrScanner = async () => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }

    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        /* Walang camera session ang scanFile(), kaya puwedeng mag-throw ang stop(). */
      }

      try {
        scannerRef.current.clear();
      } catch (err) {
        // Puwedeng cleared na ang scanner habang nag-cleanup.
      }

      scannerRef.current = null;
    }

    setCameraReady(false);
  };

  const handleQrImage = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileScanning(true);
    setError('');

    isScanningRef.current = false;
    scanCooldownRef.current = false;

    try {
      await stopQrScanner();

      const [Html5Qrcode] = await Promise.all([
        loadHtml5Qrcode(),
        new Promise((resolve) => setTimeout(resolve, 100)),
      ]);

      const element = document.getElementById(qrRegionId);

      if (!element) {
        throw new Error('QR reader element is not available.');
      }

      element.innerHTML = '';

      const html5QrCode = new Html5Qrcode(qrRegionId, {
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      let decodedText = null;

      try {
        /* Ipakita rin ang uploaded QR image kapag true ang scanFile argument. */
        decodedText = await html5QrCode.scanFile(file, true);
      } catch (scanErr) {
        console.warn('html5-qrcode scanFile failed, trying jsQR:', scanErr);
      }

      /* Fallback decoder: mas tolerant sa DC offset/quiet zone ng larawan. */
      if (!decodedText) {
        decodedText = await decodeQrFromFile(file);
      }

      if (!decodedText) {
        throw new Error('No readable QR code was found in the image.');
      }

      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch {
          // Puwedeng cleared na.
        }

        scannerRef.current = null;
      }

      await handleQRScanned(decodedText);
    } catch (err) {
      console.error('QR image scan error:', err);

      showError(
        'QR Code Not Read',
        'The QR code in the photo could not be read. Move closer, avoid glare, and try again.',
        err
      );
    } finally {
      setFileScanning(false);

      /* I-reset para puwedeng piliin ulit ang parehong photo. */
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleQRScanned = async (decodedText) => {
    if (isScanningRef.current || scanCooldownRef.current) {
      return;
    }

    isScanningRef.current = true;

    try {
      await stopQrScanner();

      setLoading(true);
      setError('');

      const rawValue = String(decodedText || '').trim();

      let studentIdFromQR = rawValue;
      let qrHash = null;

      /* Tanggap ang JSON student_id/hash o raw QR hash. */

      if (
        rawValue.startsWith('{') ||
        rawValue.includes('student_id')
      ) {
        try {
          const data = JSON.parse(rawValue);

          studentIdFromQR =
            data.student_id ||
            data.studentId ||
            data.id ||
            rawValue;

          qrHash =
            data.hash ||
            data.qr_hash ||
            null;
        } catch (err) {
          // Kung hindi JSON, gamitin ang raw QR value.
        }
      } else {
        /* Panatilihin bilang qr_hash kapag mukhang hash kaysa student ID. */
        if (
          rawValue.includes('PUPBC-') ||
          rawValue.length > 20
        ) {
          qrHash = rawValue;
        }
      }

      const payload = {
        student_id: studentIdFromQR,
        method: 'qr',
        qr_hash: qrHash || rawValue,
      };

      if (demoMode) {
        scanCooldownRef.current = true;
        setSuccess(true);
        setTimeout(() => {
          onStudentFound({
            demo: true,
            scanned_value: rawValue,
            identity: payload,
          });
        }, 150);
        return;
      }

      const response = await api.post('/kiosk/lookup', payload);

      if (!response.data?.success) {
        throw new Error(
          response.data?.message || 'QR code was not recognized.'
        );
      }

      scanCooldownRef.current = true;

      setSuccess(true);

      setTimeout(() => {
        onStudentFound({
          ...response.data.data,
          identity: payload,
        });
      }, 150);
    } catch (err) {
      console.error('QR lookup error:', err);

      const errorMessage =
        err.response?.data?.message ||
        (err.response
          ? 'The QR code was not accepted. Please enter your Student ID.'
          : 'The kiosk could not reach the clinic server. Check the internet connection and try again.');

      showError('QR Code Not Accepted', errorMessage);

      isScanningRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const switchCamera = () => {
    facingRef.current =
      facingRef.current === 'user' ? 'environment' : 'user';

    try {
      localStorage.setItem(CAMERA_KEY, facingRef.current);
    } catch {
      // Hindi kailangang matandaan ang pinili kapag bawal ang storage.
    }

    retryScanner();
  };

  const retryScanner = () => {
    stopQrScanner();

    setError('');
    setCameraReady(false);

    isScanningRef.current = false;
    scanCooldownRef.current = false;

    setTimeout(() => {
      startQrScanner();
    }, 500);
  };

  const switchToManual = () => {
    stopQrScanner();

    setMethodTab('manual');
    setError('');

    isScanningRef.current = false;
    scanCooldownRef.current = false;
  };

  const handleLookup = async (event) => {
    event.preventDefault();

    const trimmedStudentId = studentId
      .trim()
      .toUpperCase();

    if (!trimmedStudentId || trimmedStudentId.length < 5) {
      setError('Please enter a valid Student ID.');
      setErrorTitle('Invalid Student ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        student_id: trimmedStudentId,
        method: 'manual',
      };

      if (demoMode) {
        setSuccess(true);
        setTimeout(() => {
          onStudentFound({
            demo: true,
            identity: payload,
          });
        }, 400);
        return;
      }

      const response = await api.post(
        '/kiosk/lookup',
        payload
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message ||
            'Student was not found.'
        );
      }

      setSuccess(true);

      setTimeout(() => {
        onStudentFound({
          ...response.data.data,
          identity: payload,
        });
      }, 800);
    } catch (err) {
      console.error('Manual lookup error:', err);

      const errorMessage =
        err.response?.data?.message ||
        (err.response
          ? 'Student was not found. Please verify your Student ID.'
          : 'The kiosk could not reach the clinic server. Check the internet connection and try again.');

      showError('Check-In Notice', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KioskLayout>
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{
              scale: 0.8,
              opacity: 0,
            }}
            animate={{
              scale: 1,
              opacity: 1,
            }}
            className="text-center"
          >
            <motion.div
              initial={{
                scale: 0,
              }}
              animate={{
                scale: 1,
              }}
              transition={{
                type: 'spring',
                stiffness: 200,
              }}
              className="
                w-24 h-24
                bg-green-500/10
                rounded-full
                flex items-center justify-center
                mx-auto mb-4
                border-2 border-green-500/30
              "
            >
              <CheckCircle className="w-12 h-12 text-green-400" />
            </motion.div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Student Found!
            </h2>

            <p className="text-white/70">
              Redirecting...
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="w-full max-w-lg mx-auto"
          >
            <div className="flex items-center gap-4 -mt-4 mb-10">
              <button
                type="button"
                onClick={() => {
                  stopQrScanner();
                  onBack();
                }}
                className="p-3 bg-white/5 rounded-[15px] border border-white/10"
              >
                <ArrowLeft className="w-5 h-5 text-white/70" />
              </button>

              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  Check In
                </h1>

                <p className="text-white/70 text-sm">
                  Verify your identity
                </p>
              </div>
            </div>

            {methodTab === 'qr' && (
              <div className="space-y-4">
                <div className="relative mx-auto aspect-square w-full max-w-[95%]">
                  <div
                    id={qrRegionId}
                    className={`h-full w-full overflow-hidden rounded-[15px] border-2 border-white/10 bg-black [&>div]:!h-full [&>div]:!w-full [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover ${facingRef.current === 'user' ? '[&_video]:-scale-x-100' : ''}`}
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleQrImage}
                    className="hidden"
                  />

                  {cameraReady && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[15px] overflow-hidden">
                      <div className="relative h-56 w-56 sm:h-64 sm:w-64 rounded-[15px] border border-yellow-400/25 shadow-[0_0_0_9999px_rgba(0,0,0,0.48)]">
                        {!loading && (
                          <div className="absolute inset-0 overflow-hidden rounded-[15px]">
                            <motion.div
                              aria-hidden="true"
                              initial={{ top: '8%' }}
                              animate={{ top: ['8%', '88%', '8%'] }}
                              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                              className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent shadow-[0_0_12px_2px_rgba(250,204,21,0.75)]"
                            />
                          </div>
                        )}
                        <div className="absolute -top-0.5 -left-0.5 h-10 w-10 rounded-tl-[15px] border-t-4 border-l-4 border-yellow-400" />
                        <div className="absolute -top-0.5 -right-0.5 h-10 w-10 rounded-tr-[15px] border-t-4 border-r-4 border-yellow-400" />
                        <div className="absolute -bottom-0.5 -left-0.5 h-10 w-10 rounded-bl-[15px] border-b-4 border-l-4 border-yellow-400" />
                        <div className="absolute -bottom-0.5 -right-0.5 h-10 w-10 rounded-br-[15px] border-b-4 border-r-4 border-yellow-400" />
                      </div>
                    </div>
                  )}
                </div>

                <div className={`flex justify-center ${cameraReady ? '' : 'invisible pointer-events-none'}`} aria-hidden={!cameraReady}>
                  <button
                    type="button"
                    onClick={switchCamera}
                    disabled={!cameraReady || fileScanning || loading}
                    className="
                      px-5 py-2.5
                      bg-white/5
                      border border-white/10
                      text-white/80
                      rounded-[15px]
                      text-xs
                      font-semibold
                      flex
                      items-center
                      gap-2
                      disabled:opacity-50
                    "
                  >
                    <RefreshCw className="w-4 h-4" />

                    Switch Camera
                  </button>
                </div>

                {loading && (
                  <div
                    className="
                      flex
                      items-center
                      justify-center
                      gap-3
                      text-white/70
                      text-sm
                    "
                  >
                    <Loader2 className="w-5 h-5 animate-spin" />

                    Verifying QR code...
                  </div>
                )}

                <p className="text-white/70 text-xs text-center">
                  {cameraReady
                    ? 'Show your CareLink QR code to the camera'
                    : 'Take a clear photo of your QR code or enter your Student ID'}
                </p>
              </div>
            )}

            {methodTab === 'manual' && (
              <motion.form
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                onSubmit={handleLookup}
                className="space-y-4"
              >
                <div>
                  <label
                    className="
                      text-white/70
                      text-sm
                      font-medium
                      block
                      mb-2
                    "
                  >
                    Student ID
                  </label>

                  <div className="relative">
                    <User
                      className="
                        absolute
                        left-5
                        top-1/2
                        -translate-y-1/2
                        w-6 h-6
                        text-white/70
                      "
                    />

                    <input
                      className="
                        w-full
                        bg-white/5
                        border-2 border-white/10
                        rounded-[15px]
                        pl-14
                        pr-5
                        py-5
                        text-xl
                        text-white
                        placeholder-white/15
                        focus:border-yellow-400/50
                        focus:ring-4
                        focus:ring-yellow-400/10
                        focus:outline-none
                        transition
                        uppercase
                        tabular-nums
                      "
                      type="text"
                      inputMode="none"
                      readOnly
                      value={studentId}
                      placeholder="2023-00000-BN-0"
                      maxLength={15}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3" role="group" aria-label="Student ID keypad">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      disabled={loading}
                      onClick={() => setStudentId((prev) => formatStudentId(prev + digit))}
                      className="h-16 sm:h-[72px] rounded-[15px] border border-white/15 bg-white/[0.06] text-2xl font-bold text-white tabular-nums disabled:opacity-50"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={loading || !studentId}
                    onClick={() => setStudentId('')}
                    className="h-16 sm:h-[72px] rounded-[15px] border border-white/15 bg-white/10 text-base font-semibold text-white/85 disabled:opacity-40"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setStudentId((prev) => formatStudentId(`${prev}0`))}
                    className="h-16 sm:h-[72px] rounded-[15px] border border-white/15 bg-white/[0.06] text-2xl font-bold text-white tabular-nums disabled:opacity-50"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={loading || !studentId}
                    onClick={() => setStudentId((prev) => formatStudentId(prev.replace(/\D/g, '').slice(0, -1)))}
                    aria-label="Backspace"
                    className="flex h-16 sm:h-[72px] items-center justify-center rounded-[15px] border border-white/15 bg-white/10 text-white/85 disabled:opacity-40"
                  >
                    <Delete className="h-6 w-6" />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-maroon-900 font-bold rounded-[15px] text-lg flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-yellow-400/10"
                >
                  <Search className="w-6 h-6" />
                  {loading ? 'Verifying...' : 'Continue'}
                </button>
              </motion.form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <KioskErrorModal
        open={Boolean(error)}
        title={errorTitle}
        message={error}
        primaryLabel={methodTab === 'qr' && liveCameraSupported ? 'Try Again' : 'OK'}
        onClose={() => {
          const shouldRetry = methodTab === 'qr' && liveCameraSupported && !cameraReady;
          setError('');
          if (shouldRetry) retryScanner();
        }}
        secondaryLabel={methodTab === 'qr' ? 'Enter ID Instead' : undefined}
        onSecondary={methodTab === 'qr' ? () => { setError(''); switchToManual(); } : undefined}
      />
    </KioskLayout>
  );
};

export default KioskScan;
