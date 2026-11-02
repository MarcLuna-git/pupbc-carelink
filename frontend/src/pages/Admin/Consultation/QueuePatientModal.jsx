import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Check, Loader2, X } from 'lucide-react';
import { useNurseTimeGuardBypass } from '../../../services/devTools';

/*
 * Consultation → queue: one popup per patient, opened from its row's step button.
 * It walks the visit through three steps instead of separate buttons on the row:
 *   Call → Arriving → Serve. "Patient arrived" stops on the Serve step with "Serve patient".
 * The patient's details are on the visit page (ConsultationVisit) once they are served.
 */
export const PRIORITY = {
  HIGH: { label: 'Priority', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30' },
  LOW: { label: 'Regular', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30' },
};

// A skipped or on-hold patient's first step is calling them back, so it reads "Recall" like its button.
const stepsFor = (status) => [['skipped', 'on_hold'].includes(status) ? 'Recall' : 'Call', 'Arriving', 'Serve'];

const stepOf = (status) => {
  if (status === 'serving') return 2;
  if (status === 'called') return 1;
  return 0;
};

const TITLE = {
  waiting: 'Ready to call',
  called: 'Now calling',
  serving: 'Patient arrived',
  skipped: 'Skipped',
  on_hold: 'On hold',
  no_show: 'No show',
};

const QueuePatientModal = ({
  student, isNext, deskBusy, nextName, loading, timeLeft,
  onClose, onCall, onArrived, onRecall, onServe, onHold, onNoShow, onOpenVisit,
}) => {
  // With Remove time Guard on, the server does not skip called patients who run out of time.
  const timeGuardOff = useNurseTimeGuardBypass();
  // Brief success state after a call: the bell rings and the button turns green.
  const [called, setCalled] = useState(false);
  useEffect(() => {
    if (!student) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [student, onClose]);
  useEffect(() => { setCalled(false); }, [student?.checkin_id]);

  const handleCall = async () => {
    if (await onCall()) {
      setCalled(true);
      setTimeout(() => setCalled(false), 1600);
    }
  };

  const current = student ? stepOf(student.status) : 0;
  const steps = stepsFor(student?.status);
  const priority = student ? (PRIORITY[student.priority] || PRIORITY.LOW) : PRIORITY.LOW;
  const primary = 'mx-auto flex h-11 w-full max-w-[16rem] items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white transition-colors disabled:opacity-50';
  const secondary = 'mx-auto flex h-10 w-full max-w-[16rem] items-center justify-center gap-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50';

  return createPortal(
    <AnimatePresence>
      {student && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-900/50 px-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby="queue-patient-title"
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-800"
          >
            <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
              <X className="h-5 w-5" />
            </button>
            {/* Scrolls inside the rounded card, with a thin scrollbar, only when the screen is short. */}
            <div className="overflow-y-auto p-6 sm:p-7" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent' }}>

            {/* Steps of this flow */}
            <ol className="mb-5 flex items-center justify-center gap-2 text-[11px] font-semibold" aria-label="Visit steps">
              {steps.map((label, index) => (
                <li key={label} className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                    index === current ? 'bg-maroon-800 text-white'
                      : index < current ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-700'}`}>
                    {index < current ? <Check className="h-3 w-3" /> : <span>{index + 1}</span>}{label}
                  </span>
                  {index < steps.length - 1 && <span className="h-px w-4 bg-gray-200 dark:bg-gray-600" />}
                </li>
              ))}
            </ol>

            <div className="text-center">
              {/* While the patient is called, the arrival countdown sits to the right of the bell. */}
              <div className="flex items-center justify-center gap-4">
                <motion.span
                  key={called ? 'ringing' : 'still'}
                  animate={called || student.status === 'called' ? { rotate: [0, -18, 16, -12, 10, -6, 0] } : { rotate: 0 }}
                  transition={called ? { duration: 0.8 } : { duration: 0.9, repeat: student.status === 'called' ? Infinity : 0, repeatDelay: 1.6 }}
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${
                    called ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300'}`}
                >
                  <BellRing className="h-8 w-8" />
                </motion.span>

                {student.status === 'called' && (
                  <div className="min-w-0 max-w-[13rem] text-left">
                    <p className="font-mono text-3xl font-bold leading-tight tabular-nums text-amber-600 dark:text-amber-300" aria-live="polite">
                      {timeLeft === 0 ? 'Time is up' : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
                    </p>
                    {timeLeft === 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {timeGuardOff ? 'Not here yet. Remove time Guard is on (Settings → Developer Tools), so they are not moved to Skipped automatically.'
                          : 'Not here yet: they move to Skipped shortly, where you can recall them.'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">{TITLE[student.status] || student.status} · {student.queue_number}</p>
              {/* Priority sits beside the name to keep the popup short. */}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                <h4 id="queue-patient-title" className="text-xl font-bold text-gray-900 dark:text-white">{student.name}</h4>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${priority.className}`}>{priority.label}</span>
              </div>
              <p className="font-mono text-xs text-gray-400">{student.id}</p>
            </div>


            <div className="mt-6 space-y-2">
              {student.status === 'waiting' && (isNext ? (
                <>
                  <button type="button" onClick={handleCall} disabled={loading || deskBusy || called}
                    className={`${primary} ${called ? 'bg-green-600' : 'bg-maroon-800 hover:bg-maroon-900'}`}>
                    {called ? <><Check className="h-5 w-5" /> Called!</> : loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Call next patient'}
                  </button>
                  {deskBusy && <p className="text-center text-xs text-gray-500 dark:text-gray-400">Finish the patient who is called or in consultation first.</p>}
                </>
              ) : (
                <>
                  <p className="rounded-xl bg-gray-50 p-3 text-center text-sm text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">
                    Not next in line{nextName ? `: ${nextName} is called first` : ''}. Priority patients are called before others.
                  </p>
                  {/* Serve out of turn, e.g. an urgent case, straight into consultation. */}
                  <button type="button" onClick={onServe} disabled={loading || deskBusy} className={`${secondary}`}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Serve now (out of turn)'}
                  </button>
                  {deskBusy && <p className="text-center text-xs text-gray-500 dark:text-gray-400">Finish the patient who is called or in consultation first.</p>}
                </>
              ))}

              {/* Recall lives on the Skipped popup (Call step), so Arriving only confirms the arrival. */}
              {student.status === 'called' && (
                <button type="button" onClick={onArrived} disabled={loading} className={`${primary} bg-green-700 hover:bg-green-800`}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Patient arrived'}
                </button>
              )}

              {student.status === 'serving' && (
                <button type="button" onClick={onOpenVisit} disabled={loading} className={`${primary} bg-maroon-800 hover:bg-maroon-900`}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Serve patient'}
                </button>
              )}

              {/* Skipped: recall now, or set aside on hold (not a No Show) while the desk calls others. */}
              {student.status === 'skipped' && (
                <>
                  <button type="button" onClick={onRecall} disabled={loading || deskBusy} className={`${primary} bg-maroon-800 hover:bg-maroon-900`}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Recall patient'}
                  </button>
                  <button type="button" onClick={onHold} disabled={loading} className={secondary}
                    title="Not here yet: set aside without marking No Show, and recall them when they arrive">
                    Put on hold
                  </button>
                  {deskBusy && <p className="text-center text-xs text-gray-500 dark:text-gray-400">Finish the patient who is called or in consultation first.</p>}
                </>
              )}

              {/* On hold: still recallable if they arrive; No Show only when the nurse closes it. */}
              {student.status === 'on_hold' && (
                <>
                  <button type="button" onClick={onRecall} disabled={loading || deskBusy} className={`${primary} bg-maroon-800 hover:bg-maroon-900`}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Recall patient'}
                  </button>
                  <button type="button" onClick={onNoShow} disabled={loading} className={secondary}
                    title="They are not coming: close this visit as No Show">
                    Close as No show
                  </button>
                  {deskBusy && <p className="text-center text-xs text-gray-500 dark:text-gray-400">Finish the patient who is called or in consultation first.</p>}
                </>
              )}

              {student.status === 'no_show' && (
                <p className="rounded-xl bg-gray-50 p-3 text-center text-sm text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">
                  This patient did not arrive. The visit is closed as No Show.
                </p>
              )}
            </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default QueuePatientModal;
