import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

/*
 * Feedback for the student portal (kept separate from the nurse one so each can be styled on its own).
 *  - StudentToast: short "saved / deleted / failed" results. Floats top-right
 *    (above any open modal) and dismisses itself.
 *  - StudentNoticeModal: messages the student must acknowledge before going on,
 *    e.g. a failed sign-in or a newly created account.
 */

export const StudentToast = ({ message, type = 'success', onClose, duration = 4000 }) => {
  // Pages pass inline callbacks; keep the latest one so re-renders don't restart the timer
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!message || !duration) return undefined;
    const timer = setTimeout(() => closeRef.current?.(), duration);
    return () => clearTimeout(timer);
  }, [message, type, duration]);

  const isSuccess = type === 'success';

  return createPortal(
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex justify-center sm:inset-x-auto sm:right-6 sm:top-6 sm:justify-end">
      <AnimatePresence>
        {message && (
          <motion.div
            key={`${type}-${message}`}
            role={isSuccess ? 'status' : 'alert'}
            aria-live={isSuccess ? 'polite' : 'assertive'}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[10px] border border-gray-100 bg-white p-4 shadow-xl shadow-gray-900/10 dark:border-gray-700 dark:bg-gray-800"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              isSuccess
                ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {isSuccess ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <AlertTriangle className="h-[18px] w-[18px]" />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{isSuccess ? 'Success' : "Couldn't complete that"}</p>
              <p className="mt-0.5 break-words text-sm text-gray-600 dark:text-gray-300">{message}</p>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Dismiss message"
                className="rounded-[10px] p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export const StudentNoticeModal = ({ open, type = 'error', title, highlight, message, actionLabel = 'OK', onClose }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const isSuccess = type === 'success';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-900/50 px-5 backdrop-blur-sm"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="student-notice-title"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[10px] bg-white p-7 text-center shadow-2xl dark:bg-gray-800"
          >
            <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
              isSuccess
                ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {isSuccess ? <CheckCircle2 className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
            </span>
            <h4 id="student-notice-title" className="mt-5 text-xl font-bold text-gray-900 dark:text-white">{title}</h4>
            {/* Optional key fact (e.g. attempts left) shown right under the title. */}
            {highlight && (
              <p className="mt-1 text-sm font-bold tracking-wide text-gray-900 dark:text-white">{highlight}</p>
            )}
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-gray-500 dark:text-gray-300">{message}</p>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="mt-6 h-12 w-full rounded-full bg-maroon-800 text-[15px] font-semibold text-white transition-colors hover:bg-maroon-900"
            >
              {actionLabel}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

/*
 * StudentConfirmModal: a yes/no question (e.g. "Sign out?"). Same look and
 * motion as StudentNoticeModal — icon badge, centered title and message,
 * rounded-full buttons — with a Cancel button beside the maroon confirm.
 * Esc or a click on the backdrop cancels, unless the action is running.
 */
export const StudentConfirmModal = ({
  open,
  icon: Icon = AlertTriangle,
  title,
  message,
  confirmLabel = 'Confirm',
  busyLabel,
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open || busy) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && onCancel?.()}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 px-5 backdrop-blur-sm"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="student-confirm-title"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[320px] rounded-[10px] bg-white p-5 text-center shadow-2xl dark:bg-gray-800"
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300">
              <Icon className="h-6 w-6" />
            </span>
            <h4 id="student-confirm-title" className="mt-4 text-lg font-bold text-gray-900 dark:text-white">{title}</h4>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-500 dark:text-gray-300">{message}</p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                autoFocus
                onClick={onCancel}
                disabled={busy}
                className="h-10 flex-1 rounded-full bg-gray-100 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="h-10 flex-1 rounded-full bg-maroon-800 text-sm font-semibold text-white transition-colors hover:bg-maroon-900 disabled:opacity-60"
              >
                {busy && busyLabel ? busyLabel : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
