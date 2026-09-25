import api from '../../services/api';
import { useState } from 'react';
import KioskWelcome from './KioskWelcome';
import KioskTerms from './KioskTerms';
import KioskOptions from './KioskOptions';
import KioskScan from './KioskScan';
import KioskConfirm from './KioskConfirm';
import KioskQueue from './KioskQueue';

const KioskPage = () => {
  const [authorized, setAuthorized] = useState(Boolean(sessionStorage.getItem('carelink.kiosk.token') || import.meta.env.VITE_KIOSK_DEVICE_TOKEN));
  const [deviceToken, setDeviceToken] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const authorizeDevice = async (event) => {
    event.preventDefault();
    sessionStorage.setItem('carelink.kiosk.token', deviceToken.trim());
    try { await api.get('/kiosk/queue'); setAuthorized(true); setDeviceToken(''); }
    catch { sessionStorage.removeItem('carelink.kiosk.token'); setDeviceError('Device authorization failed. Ask the clinic to verify this device.'); }
  };
  const [step, setStep] = useState('welcome');
  const [studentData, setStudentData] = useState(null);
  const [checkinData, setCheckinData] = useState(null);
  const [scanMethod, setScanMethod] = useState(null);

  const handleStart = () => setStep('terms');
  const handleAgree = () => setStep('options');
  const handleDecline = () => setStep('welcome');
  
  const handleScanQR = () => { setScanMethod('qr'); setStep('scan'); };
  const handleEnterID = () => { setScanMethod('manual'); setStep('scan'); };
  
  const handleBack = () => {
    if (step === 'terms') setStep('welcome');
    if (step === 'options') setStep('terms');
    if (step === 'scan') setStep('options');
    if (step === 'confirm') setStep('scan');
  };
  
  const handleStudentFound = (data) => {
    setStudentData(data);
    setStep('confirm');
  };
  
  const handleCheckedIn = (data) => {
    setCheckinData(data);
    setStep('queue');
  };
  
  const handleDone = () => {
    setStep('welcome');
    setStudentData(null);
    setCheckinData(null);
    setScanMethod(null);
  };

  if (!authorized) return <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6"><form onSubmit={authorizeDevice} className="bg-white rounded-2xl p-6 max-w-md space-y-4"><h1 className="text-xl font-bold">Clinic Device Setup</h1><p>Clinic staff must authorize this tablet before student check-in.</p><label className="block">Device access token<input autoComplete="off" type="password" required value={deviceToken} onChange={e => setDeviceToken(e.target.value)} className="border rounded-xl p-3 w-full" /></label>{deviceError && <p role="alert">{deviceError}</p>}<button className="bg-maroon-800 text-white px-4 py-3 rounded-xl">Authorize Device</button></form></div>;
  return (
    <>
      {step === 'welcome' && <KioskWelcome onStart={handleStart} />}
      {step === 'terms' && <KioskTerms onAgree={handleAgree} onDecline={handleDecline} onBack={handleBack} />}
      {step === 'options' && <KioskOptions onScanQR={handleScanQR} onEnterID={handleEnterID} onBack={handleBack} />}
      {step === 'scan' && <KioskScan onStudentFound={handleStudentFound} onBack={handleBack} method={scanMethod} />}
      {step === 'confirm' && studentData && <KioskConfirm data={studentData} onCheckedIn={handleCheckedIn} onBack={handleBack} onDone={handleDone} />}
      {step === 'queue' && checkinData && <KioskQueue checkin={checkinData} onDone={handleDone} />}
    </>
  );
};

export default KioskPage;