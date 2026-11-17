import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Wrench, Clock, Lock, Loader2, ShieldAlert } from 'lucide-react';
import KioskLayout from '../../layouts/KioskLayout';
import KioskErrorModal from './KioskErrorModal';
import { fetchKioskDevTools, updateKioskTimeGuardBypass, useKioskTimeGuardBypass } from '../../services/devTools';

/*
 * Hidden kiosk settings page — reached only by typing /kiosk/settings (there is
 * no button to it on the kiosk). Protected by the kiosk device token.
 */
const isDeviceAuthorized = () =>
  Boolean(sessionStorage.getItem('carelink.kiosk.token') || import.meta.env.VITE_KIOSK_DEVICE_TOKEN);

const KioskSettings = () => {
  const authorized = isDeviceAuthorized();
  const timeGuardOff = useKioskTimeGuardBypass();
  const [loading, setLoading] = useState(authorized);
  const [available, setAvailable] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authorized) return;
    fetchKioskDevTools()
      .then((data) => setAvailable(data?.available !== false))
      .catch(() => setError('Unable to load kiosk settings. Check that this device is authorized.'))
      .finally(() => setLoading(false));
  }, [authorized]);

  const toggle = async () => {
    if (saving) return;
    setError('');
    setMessage('');
    if (!timeGuardOff) {
      // Turning on needs the developer password; tapping again cancels the prompt.
      setShowPassword((open) => !open);
      setPassword('');
      return;
    }
    setSaving(true);
    try {
      const response = await updateKioskTimeGuardBypass(false);
      setMessage(response?.message || 'Time guard restored.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not restore the time guard.');
    } finally {
      setSaving(false);
    }
  };

  const confirm = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await updateKioskTimeGuardBypass(true, password);
      setShowPassword(false);
      setPassword('');
      setMessage(response?.message || 'Time guard removed.');
    } catch (err) {
      setError(err.response?.data?.errors?.password?.[0] || err.response?.data?.message || 'Could not remove the time guard.');
    } finally {
      setSaving(false);
    }
  };

  const switchOn = timeGuardOff || showPassword;

  return (
    <KioskLayout>
      <Link
        to="/kiosk"
        className="absolute left-6 top-6 z-20 inline-flex items-center gap-2 rounded-[15px] border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm md:left-10 md:top-8"
      >
        <Home className="h-5 w-5" />
        Home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl space-y-6"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white md:text-4xl">Kiosk Settings</h1>
          <p className="mt-2 text-sm text-white/70">For clinic staff only.</p>
        </div>

        <section className="rounded-[15px] border border-white/10 bg-white/10 p-6 text-white backdrop-blur-md md:p-8">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <Wrench className="h-5 w-5 text-yellow-300" />
            Developer Tools
          </h2>
          <p className="mb-6 text-xs text-white/70">Testing tools for the clinic flow. Applies to this kiosk.</p>

          {!authorized ? (
            <div className="flex items-start gap-3 rounded-[15px] bg-white/5 p-4 text-sm text-white/70">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow-300" />
              <p>This device is not authorized yet. Go to the kiosk home to authorize it first.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-3 text-sm text-white/70" role="status">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading settings…
            </div>
          ) : !available ? (
            <p className="rounded-[15px] bg-white/5 p-4 text-sm text-white/70">Developer Tools are turned off on this server.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-[15px] bg-white/5 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-yellow-300" />
                  <div className="min-w-0">
                    <p className="font-semibold">Remove time Guard</p>
                    <p className="mt-0.5 text-xs text-white/70">
                      {timeGuardOff
                        ? 'On: check-in is open all day for approved appointments today.'
                        : 'Off: check-in opens 15 minutes before and closes 30 minutes after the slot.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={switchOn}
                  aria-label="Remove time Guard"
                  disabled={saving}
                  onClick={toggle}
                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:opacity-60 ${
                    switchOn ? 'bg-yellow-400' : 'bg-white/20'
                  }`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow ${
                    switchOn ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {showPassword && !timeGuardOff && (
                <form onSubmit={confirm} className="space-y-3 rounded-[15px] border border-yellow-300/30 bg-yellow-300/10 p-4">
                  <p className="text-xs font-semibold text-yellow-200">Enter the developer password to remove the time guard.</p>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
                    <input
                      type="password"
                      autoComplete="off"
                      autoFocus
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      placeholder="Developer password"
                      aria-label="Developer password"
                      required
                      className="w-full rounded-[15px] border border-white/15 bg-black/20 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={saving || !password}
                      className="inline-flex items-center gap-2 rounded-[15px] bg-yellow-400 px-5 py-3 text-sm font-semibold text-maroon-950 disabled:opacity-50"
                    >
                      <Wrench className="h-4 w-4" />
                      {saving ? 'Checking…' : 'Remove time guard'}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => { setShowPassword(false); setPassword(''); setError(''); }}
                      className="rounded-[15px] px-5 py-3 text-sm font-semibold text-white/70 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {message && <p role="status" className="mt-4 text-sm text-green-300">{message}</p>}
        </section>
      </motion.div>
      <KioskErrorModal open={Boolean(error)} title="Kiosk Settings" message={error} onClose={() => setError('')} />
    </KioskLayout>
  );
};

export default KioskSettings;
