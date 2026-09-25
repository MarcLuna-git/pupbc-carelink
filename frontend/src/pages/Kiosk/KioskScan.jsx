import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  ArrowLeft,
  User,
  Camera,
  Keyboard,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Clock,
  CameraOff,
  ImageUp,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../services/api';
import KioskLayout from '../../layouts/KioskLayout';

const KioskScan = ({
  onStudentFound,
  onBack,
  method: initialMethod,
}) => {
  const [methodTab, setMethodTab] = useState(initialMethod || 'manual');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [scanTimeout, setScanTimeout] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);
  const [liveCameraSupported, setLiveCameraSupported] = useState(true);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const timeoutRef = useRef(null);

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
      }, 800);

      return () => clearTimeout(timer);
    }

    stopQrScanner();
  }, [methodTab]);

  const startQrScanner = async () => {
    setError('');
    setScanTimeout(false);
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

      setError(
        'Live camera scanning is unavailable on this connection. Please take a photo of the QR code instead.'
      );

      return;
    }

    try {
      await stopQrScanner();

      // Hintayin munang ma-render ang scanner container.
      await new Promise((resolve) => setTimeout(resolve, 300));

      const element = document.getElementById(qrRegionId);

      if (!element) {
        setError(
          'QR scanner could not be initialized. Please use manual entry.'
        );
        return;
      }

      element.innerHTML = '';

      const html5QrCode = new Html5Qrcode(qrRegionId, {
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        {
          facingMode: 'environment',
        },
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250,
          },
          aspectRatio: 1,
        },
        (decodedText) => {
          handleQRScanned(decodedText);
        },
        () => {
          // Normal lang ang per-frame decode failures habang naghahanap ng QR.
        }
      );

      setCameraReady(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setScanTimeout(true);
      }, 15000);
    } catch (err) {
      console.error('QR Scanner error:', err);

      let errorMessage =
        'Could not access the live camera. You can take a QR photo instead.';

      if (
        err?.name === 'NotAllowedError' ||
        err?.message?.includes('NotAllowed')
      ) {
        errorMessage =
          'Camera permission was denied. Allow camera access or take/upload a QR photo.';
      } else if (
        err?.name === 'NotFoundError' ||
        err?.message?.includes('NotFound')
      ) {
        errorMessage =
          'No camera was detected. Please take/upload a QR photo or enter your Student ID.';
      } else if (
        err?.name === 'NotReadableError' ||
        err?.message?.includes('NotReadable')
      ) {
        errorMessage =
          'The camera is currently being used by another application.';
      }

      setError(errorMessage);
      setCameraReady(false);
    }
  };

  const stopQrScanner = async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
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
    setScanTimeout(false);
  };

  const handleQrImage = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileScanning(true);
    setError('');
    setScanTimeout(false);

    isScanningRef.current = false;
    scanCooldownRef.current = false;

    try {
      await stopQrScanner();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const element = document.getElementById(qrRegionId);

      if (!element) {
        throw new Error('QR reader element is not available.');
      }

      element.innerHTML = '';

      const html5QrCode = new Html5Qrcode(qrRegionId, {
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      /* Ipakita rin ang uploaded QR image kapag true ang scanFile argument. */
      const decodedText = await html5QrCode.scanFile(file, true);

      await handleQRScanned(decodedText);
    } catch (err) {
      console.error('QR image scan error:', err);

      setError(
        'No readable QR code was found. Move closer to the QR code, avoid glare, and try again.'
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
      }, 800);
    } catch (err) {
      console.error('QR lookup error:', err);

      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        'QR code was not recognized. Please enter your Student ID manually.';

      setError(errorMessage);

      isScanningRef.current = false;

      /* Mag-offer ng manual entry kapag rejected ng backend ang QR. */
      setTimeout(() => {
        setMethodTab('manual');
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const retryScanner = () => {
    stopQrScanner();

    setError('');
    setScanTimeout(false);
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
      setError(
        'Please enter a valid Student ID.'
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        student_id: trimmedStudentId,
        method: 'manual',
      };

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
        err.message ||
        'Student was not found. Please verify your Student ID.';

      setError(errorMessage);
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

            <p className="text-white/40">
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
            <div className="flex items-center gap-4 mb-6">
              <motion.button
                whileHover={{
                  scale: 1.05,
                }}
                whileTap={{
                  scale: 0.95,
                }}
                onClick={() => {
                  stopQrScanner();
                  onBack();
                }}
                className="
                  p-3
                  bg-white/5
                  hover:bg-white/10
                  rounded-2xl
                  border border-white/10
                  transition
                "
              >
                <ArrowLeft className="w-5 h-5 text-white/60" />
              </motion.button>

              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  Check In
                </h1>

                <p className="text-white/40 text-sm">
                  Verify your identity
                </p>
              </div>
            </div>

            <div
              className="
                flex
                bg-white/5
                rounded-2xl
                p-1.5
                mb-6
                border border-white/10
              "
            >
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMethodTab('qr');
                }}
                className={`
                  flex-1
                  py-3
                  rounded-xl
                  font-semibold
                  text-sm
                  transition
                  flex
                  items-center
                  justify-center
                  gap-2
                  ${
                    methodTab === 'qr'
                      ? 'bg-yellow-400 text-maroon-900 shadow-lg'
                      : 'text-white/40 hover:text-white/60'
                  }
                `}
              >
                <Camera className="w-4 h-4" />
                Scan QR
              </button>

              <button
                type="button"
                onClick={() => {
                  stopQrScanner();
                  setMethodTab('manual');
                  setError('');
                }}
                className={`
                  flex-1
                  py-3
                  rounded-xl
                  font-semibold
                  text-sm
                  transition
                  flex
                  items-center
                  justify-center
                  gap-2
                  ${
                    methodTab === 'manual'
                      ? 'bg-yellow-400 text-maroon-900 shadow-lg'
                      : 'text-white/40 hover:text-white/60'
                  }
                `}
              >
                <Keyboard className="w-4 h-4" />
                Enter ID
              </button>
            </div>

            {methodTab === 'qr' && (
              <div className="space-y-4">

                {error && !cameraReady && (
                  <div
                    className="
                      bg-white/5
                      backdrop-blur-xl
                      rounded-3xl
                      p-8
                      text-center
                      border border-white/10
                    "
                  >
                    <CameraOff
                      className="
                        w-14 h-14
                        text-white/20
                        mx-auto mb-4
                      "
                    />

                    <h3 className="text-white font-semibold text-lg mb-2">
                      Camera Unavailable
                    </h3>

                    <p className="text-white/50 text-sm mb-6">
                      {error}
                    </p>

                    <div
                      className="
                        flex
                        flex-col
                        sm:flex-row
                        gap-3
                        justify-center
                      "
                    >
                      {liveCameraSupported && (
                        <button
                          type="button"
                          onClick={retryScanner}
                          className="
                            px-6 py-3
                            bg-white/10
                            text-white
                            rounded-xl
                            text-sm
                            font-semibold
                            hover:bg-white/20
                            transition
                            flex
                            items-center
                            justify-center
                            gap-2
                          "
                        >
                          <RefreshCw className="w-4 h-4" />

                          Retry Camera
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        disabled={fileScanning || loading}
                        className="
                          px-6 py-3
                          bg-yellow-400
                          text-maroon-900
                          rounded-xl
                          text-sm
                          font-semibold
                          hover:bg-yellow-300
                          transition
                          flex
                          items-center
                          justify-center
                          gap-2
                          disabled:opacity-50
                        "
                      >
                        {fileScanning ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ImageUp className="w-4 h-4" />
                        )}

                        {fileScanning
                          ? 'Reading QR...'
                          : 'Take / Upload QR Photo'}
                      </button>

                      <button
                        type="button"
                        onClick={switchToManual}
                        className="
                          px-6 py-3
                          bg-white/10
                          text-white
                          rounded-xl
                          text-sm
                          font-semibold
                          hover:bg-white/20
                          transition
                        "
                      >
                        Enter ID Instead
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleQrImage}
                      className="hidden"
                    />
                  </div>
                )}

                <div className="relative">
                  <div
                    id={qrRegionId}
                    className="
                      rounded-3xl
                      overflow-hidden
                      border-2 border-white/10
                      w-full
                      bg-black
                    "
                    style={{
                      minHeight: '320px',
                    }}
                  />

                  {cameraReady && (
                    <div
                      className="
                        absolute
                        inset-0
                        pointer-events-none
                        rounded-3xl
                        overflow-hidden
                      "
                    >
                      <div
                        className="
                          absolute top-6 left-6
                          w-10 h-10
                          border-t-4 border-l-4
                          border-yellow-400/60
                          rounded-tl-xl
                        "
                      />

                      <div
                        className="
                          absolute top-6 right-6
                          w-10 h-10
                          border-t-4 border-r-4
                          border-yellow-400/60
                          rounded-tr-xl
                        "
                      />

                      <div
                        className="
                          absolute bottom-6 left-6
                          w-10 h-10
                          border-b-4 border-l-4
                          border-yellow-400/60
                          rounded-bl-xl
                        "
                      />

                      <div
                        className="
                          absolute bottom-6 right-6
                          w-10 h-10
                          border-b-4 border-r-4
                          border-yellow-400/60
                          rounded-br-xl
                        "
                      />
                    </div>
                  )}

                  {scanTimeout && cameraReady && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 20,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      className="
                        absolute
                        bottom-4
                        left-4
                        right-4
                        bg-black/90
                        backdrop-blur-xl
                        rounded-2xl
                        p-4
                        border border-yellow-400/30
                        z-10
                      "
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-yellow-400" />

                        <p className="text-white/70 text-sm">
                          Having trouble scanning?
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            fileInputRef.current?.click()
                          }
                          className="
                            flex-1
                            py-3
                            bg-white/10
                            text-white
                            rounded-xl
                            text-sm
                            font-semibold
                            hover:bg-white/20
                            transition
                          "
                        >
                          Use Photo
                        </button>

                        <button
                          type="button"
                          onClick={switchToManual}
                          className="
                            flex-1
                            py-3
                            bg-yellow-400
                            text-maroon-900
                            rounded-xl
                            text-sm
                            font-semibold
                            hover:bg-yellow-300
                            transition
                          "
                        >
                          Enter ID
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                {cameraReady && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      disabled={fileScanning || loading}
                      className="
                        px-4 py-2
                        bg-white/5
                        border border-white/10
                        text-white/60
                        rounded-xl
                        text-xs
                        font-semibold
                        hover:bg-white/10
                        transition
                        flex
                        items-center
                        gap-2
                        disabled:opacity-50
                      "
                    >
                      {fileScanning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImageUp className="w-4 h-4" />
                      )}

                      Use QR Photo Instead
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleQrImage}
                      className="hidden"
                    />
                  </div>
                )}

                {loading && (
                  <div
                    className="
                      flex
                      items-center
                      justify-center
                      gap-3
                      text-white/50
                      text-sm
                    "
                  >
                    <Loader2 className="w-5 h-5 animate-spin" />

                    Verifying QR code...
                  </div>
                )}

                <p className="text-white/20 text-xs text-center">
                  {cameraReady
                    ? 'Point the camera at your CareLink QR code'
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
              >
                <div className="mb-4">
                  <label
                    className="
                      text-white/50
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
                        text-white/20
                      "
                    />

                    <input
                      className="
                        w-full
                        bg-white/5
                        border-2 border-white/10
                        rounded-2xl
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
                      "
                      type="text"
                      value={studentId}
                      onChange={(event) =>
                        setStudentId(event.target.value)
                      }
                      placeholder="2023-00000-BN-0"
                      maxLength={17}
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div
                    className="
                      bg-red-500/10
                      border border-red-500/20
                      rounded-2xl
                      p-4
                      mb-4
                      flex
                      items-start
                      gap-3
                    "
                  >
                    <AlertCircle
                      className="
                        w-5 h-5
                        text-red-400
                        mt-0.5
                        flex-shrink-0
                      "
                    />

                    <p className="text-red-300 text-sm">
                      {error}
                    </p>
                  </div>
                )}

                <motion.button
                  whileHover={{
                    scale: 1.02,
                  }}
                  whileTap={{
                    scale: 0.98,
                  }}
                  type="submit"
                  disabled={loading}
                  className="
                    w-full
                    py-5
                    bg-gradient-to-r
                    from-yellow-400
                    to-yellow-500
                    text-maroon-900
                    font-bold
                    rounded-2xl
                    text-lg
                    transition
                    flex
                    items-center
                    justify-center
                    gap-3
                    disabled:opacity-50
                    shadow-xl
                    shadow-yellow-400/10
                  "
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Search className="w-6 h-6" />
                      Continue
                    </>
                  )}
                </motion.button>
              </motion.form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </KioskLayout>
  );
};

export default KioskScan;