import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConical, Loader2, RotateCcw, Timer, X } from 'lucide-react';
import api from '../../../services/api';

/*
 * Consultation → Queue list → Options. The arrival time is how long a called student has to
 * arrive before the server closes the visit as No Show. It is clinic-wide (every nurse device) and
 * saved on the server (QueueSettingsController).
 */
const PRESETS = [10, 30, 60, 120, 180, 300];
const MIN = 10;
const MAX = 900;

export const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (!minutes) return `${rest} sec`;
  return rest ? `${minutes} min ${rest} sec` : `${minutes} min${minutes === 1 ? '' : 's'}`;
};

/*
 * Developer tools → Demo patient: one fake student (DemoQueue on the server) who loops through
 * the queue: Call next → In consultation → save / print → back to Waiting. Turning it on needs
 * the developer password; Reset puts the demo patient back to Waiting at any time.
 */
// Loaded when the queue page opens (not when Options opens), so the box is there from the first
// frame instead of popping in and stretching the popup.
const demoCache = { state: null };
const loadDemo = () => api.get('/nurse/demo-queue').then(({ data }) => (demoCache.state = data.data));

const DemoPatientTools = ({ open, onChanged }) => {
  const [state, setStateRaw] = useState(() => demoCache.state);
  const setState = (next) => { demoCache.state = next; setStateRaw(next); };
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setAsking(false); setPassword(''); setError('');
    setStateRaw(demoCache.state);
    loadDemo().then(next => { if (active) setStateRaw(next); }).catch(() => {});
    return () => { active = false; };
  }, [open]);

  if (!state?.available) return null;

  const run = async (kind, request, done) => {
    if (busy) return;
    setBusy(kind); setError('');
    try {
      const { data } = await request();
      setState(data.data); setAsking(false); setPassword('');
      onChanged?.(data.message || done);
    } catch (err) {
      setError(Object.values(err.response?.data?.errors || {}).flat().join(' ') || err.response?.data?.message || 'Something went wrong. Try again.');
    } finally { setBusy(''); }
  };
  const turnOn = (e) => { e.preventDefault(); if (password) run('on', () => api.put('/nurse/demo-queue', { enabled: true, password }), 'Demo patients added.'); };
  const turnOff = () => run('off', () => api.put('/nurse/demo-queue', { enabled: false }), 'Demo patients removed.');
  const reset = () => run('reset', () => api.post('/nurse/demo-queue/reset'), 'Demo patients reset.');
  const toggle = () => { if (state.enabled) turnOff(); else { setAsking(v => !v); setError(''); } };

  return (
    <div className="mt-6 rounded-[10px] border border-dashed border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-800/60 dark:bg-indigo-900/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100"><FlaskConical className="h-4 w-4 text-indigo-600 dark:text-indigo-300" /> Developer tools · Demo patients</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Adds three demo students to the queue list, one per triage level: Priority, Medium and Regular. They should be called in that order and get real queue numbers. After a visit is saved, that student goes back to Waiting so you can run the flow again. No medicine is taken from stock.
          </p>
        </div>
        <button type="button" role="switch" aria-checked={state.enabled} aria-label="Demo patients" onClick={toggle} disabled={Boolean(busy)}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${state.enabled || asking ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
          {busy === 'off' ? <Loader2 className="mx-auto h-4 w-4 animate-spin text-white" />
            : <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${state.enabled || asking ? 'translate-x-5' : 'translate-x-0.5'}`} />}
        </button>
      </div>

      {!state.enabled && asking && (
        <form onSubmit={turnOn} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="password" autoFocus value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Developer password" aria-label="Developer password" autoComplete="off"
            className="min-w-0 flex-1 rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          <button type="submit" disabled={!password || Boolean(busy)}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {busy === 'on' && <Loader2 className="h-4 w-4 animate-spin" />} Turn on
          </button>
        </form>
      )}

      {state.enabled && (
        <button type="button" onClick={reset} disabled={Boolean(busy)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:bg-gray-800 dark:text-indigo-300 dark:hover:bg-indigo-900/20">
          {busy === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reset demo patients
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

const QueueOptionsModal = ({ open, callTimeout, onClose, onSaved, onDemoChanged }) => {
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadDemo().catch(() => {}); }, []);

  useEffect(() => {
    if (!open) return;
    setMinutes(Math.floor(callTimeout / 60)); setSeconds(callTimeout % 60); setError('');
  }, [open, callTimeout]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const total = (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
  const valid = total >= MIN && total <= MAX;
  const pick = (value) => { setMinutes(Math.floor(value / 60)); setSeconds(value % 60); setError(''); };

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true); setError('');
    try {
      const { data } = await api.put('/nurse/queue-settings', { call_timeout_seconds: total });
      onSaved(data.data.call_timeout_seconds);
      onClose();
    } catch (err) {
      setError(Object.values(err.response?.data?.errors || {}).flat().join(' ') || err.response?.data?.message || 'Unable to save the arrival time.');
    } finally { setSaving(false); }
  };

  const field = 'w-20 rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-center text-sm font-semibold tabular-nums text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-900/50 px-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby="queue-options-title"
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-h-[90vh] max-w-md overflow-y-auto rounded-[10px] bg-white p-6 shadow-2xl dark:bg-gray-800 sm:p-7"
          >
            <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
              <X className="h-5 w-5" />
            </button>
            <h4 id="queue-options-title" className="text-lg font-bold text-gray-900 dark:text-white">Queue Options</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Applies to every nurse device.</p>

            <div className="mt-5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100"><Timer className="h-4 w-4 text-maroon-700 dark:text-maroon-300" /> Arrival time</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">How long a called student has to arrive. If they do not, the visit is closed and they book a new appointment.</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map((value) => (
                  <button key={value} type="button" onClick={() => pick(value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${total === value
                      ? 'border-maroon-800 bg-maroon-800 text-white'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50'}`}>
                    {formatDuration(value)}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Custom</span>
                <input type="number" min="0" max="15" value={minutes} aria-label="Minutes" className={field}
                  onChange={(e) => { setMinutes(e.target.value); setError(''); }} />
                <span>min</span>
                <input type="number" min="0" max="59" step="5" value={seconds} aria-label="Seconds" className={field}
                  onChange={(e) => { setSeconds(e.target.value); setError(''); }} />
                <span>sec</span>
              </div>
              {!valid && <p className="mt-2 text-xs text-red-600 dark:text-red-400">Choose between 10 seconds and 15 minutes.</p>}
              {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Takes effect right away, also for a student who is being called now.</p>
            </div>

            <DemoPatientTools open={open} onChanged={onDemoChanged} />

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-[10px] border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50">Cancel</button>
              <button type="button" onClick={save} disabled={!valid || saving || total === callTimeout}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-900 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default QueueOptionsModal;
