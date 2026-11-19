import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, CalendarX, Check, Loader2, X } from 'lucide-react';
import { useNurseTimeGuardBypass } from '../../../services/devTools';

/*
 * Queue: the patient popup. Call next on the row calls the student and opens this popup on the
 * arrival timer; "Patient arrived" confirms them and opens their consultation form right away.
 * When the timer runs out the visit is closed as No Show and the popup tells the nurse to have
 * the student book a new appointment (no Recall / On hold).
 */
export const PRIORITY = {
  HIGH: { label: 'Priority', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30' },
  LOW: { label: 'Regular', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30' },
};

const TITLE = {
  waiting: 'Ready to call',
  called: 'Now calling',
  serving: 'Patient arrived',
  skipped: 'Did not arrive',
  on_hold: 'Did not arrive',
  no_show: 'Did not arrive',
};

const QueuePatientModal = ({
  student, isNext, deskBusy, nextName, loading, timeLeft,
  onClose, onCall, onArrived, onServe, onNoShow, onGoToConsultation,
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

  const priority = student ? (PRIORITY[student.priority] || PRIORITY.LOW) : PRIORITY.LOW;
  const missed = ['no_show', 'skipped', 'on_hold'].includes(student?.status);
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
            className="relative flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl dark:bg-gray-800"
          >
            <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
              <X className="h-5 w-5" />
            </button>
            {/* Scrolls inside the rounded card, with a thin scrollbar, only when the screen is short. */}
            <div className="overflow-y-auto p-6 sm:p-7" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent' }}>

            <div className="text-center">
              {/* While the patient is called, the arrival countdown sits to the right of the bell. */}
              <div className="flex items-center justify-center gap-4">
                {missed ? (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    <CalendarX className="h-8 w-8" />
                  </span>
                ) : (
                <motion.span
                  key={called ? 'ringing' : 'still'}
                  animate={called || student.status === 'called' ? { rotate: [0, -18, 16, -12, 10, -6, 0] } : { rotate: 0 }}
                  transition={called ? { duration: 0.8 } : { duration: 0.9, repeat: student.status === 'called' ? Infinity : 0, repeatDelay: 1.6 }}
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${
                    called ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300'}`}
                >
                  <BellRing className="h-8 w-8" />
                </motion.span>
                )}

                {student.status === 'called' && (
                  <div className="min-w-0 max-w-[13rem] text-left">
                    <p className="font-mono text-3xl font-bold leading-tight tabular-nums text-amber-600 dark:text-amber-300" aria-live="polite">
                      {timeLeft === 0 ? 'Time is up' : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
                    </p>
                    {timeLeft === 0 && timeGuardOff && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Remove time Guard is on (Settings → Developer Tools), so the visit is not closed automatically.
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


            <div className={`${missed || student.status === 'serving' ? 'mt-3' : 'mt-6'} space-y-2`}>
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
                  <p className="rounded-[10px] bg-gray-50 p-3 text-center text-sm text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">
                    Not next in line{nextName ? `: ${nextName} is called first` : ''}. Priority patients are called before others.
                  </p>
                  {/* Serve out of turn, e.g. an urgent case, straight into consultation. */}
                  <button type="button" onClick={onServe} disabled={loading || deskBusy} className={`${secondary}`}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Serve now (out of turn)'}
                  </button>
                  {deskBusy && <p className="text-center text-xs text-gray-500 dark:text-gray-400">Finish the patient who is called or in consultation first.</p>}
                </>
              ))}

              {/* Called: the arrival timer and one button, nothing else. */}
              {student.status === 'called' && (
                <button type="button" onClick={onArrived} disabled={loading} className={`${primary} bg-green-700 hover:bg-green-800`}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Patient arrived'}
                </button>
              )}

              {/* Already arrived (the form was left before saving): one button back into the form. */}
              {student.status === 'serving' && (
                <>
                  <p className="pb-2 text-center text-sm text-gray-600 dark:text-gray-300">
                    {student.name.trim() || 'The student'} arrived and is in consultation. Open their form to continue.
                  </p>
                  <button type="button" onClick={onGoToConsultation} className={`${primary} bg-maroon-800 hover:bg-maroon-900`}>Open consultation form</button>
                </>
              )}

              {/* Did not arrive in time: no Recall / On hold, the student books again. */}
              {missed && (
                <>
                  <p className="pb-2 text-center text-sm text-gray-600 dark:text-gray-300">
                    {student.name.trim() || 'The student'} did not arrive in time. Tell them to <span className="font-semibold">book a new appointment</span> in the CareLink portal.
                  </p>
                  {student.status === 'no_show' ? (
                    <button type="button" onClick={onClose} className={`${primary} bg-maroon-800 hover:bg-maroon-900`}>OK</button>
                  ) : (
                    <button type="button" onClick={onNoShow} disabled={loading} className={`${primary} bg-maroon-800 hover:bg-maroon-900`}>
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Close visit'}
                    </button>
                  )}
                </>
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
