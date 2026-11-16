import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

const KioskErrorModal = ({
  open,
  title = 'Check-In Notice',
  message,
  onClose,
  primaryLabel = 'OK',
  secondaryLabel,
  onSecondary,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose?.();
          }}
        >
          <motion.section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="kiosk-error-title"
            aria-describedby="kiosk-error-message"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-md rounded-[10px] border border-white/15 bg-[#2a0808] p-6 text-center text-white shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close error message"
              className="absolute right-4 top-4 rounded-[10px] p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[10px] border border-red-400/25 bg-red-500/15 text-red-400">
              <AlertCircle className="h-7 w-7" />
            </div>

            <h3 id="kiosk-error-title" className="text-xl font-bold text-white">
              {title || 'Check-In Notice'}
            </h3>

            <p id="kiosk-error-message" className="mt-2.5 text-sm leading-relaxed text-white/80">
              {message}
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              {secondaryLabel && onSecondary && (
                <button
                  type="button"
                  onClick={onSecondary}
                  className="rounded-[10px] border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  {secondaryLabel}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                autoFocus
                className="min-w-[120px] rounded-[10px] bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-3 text-sm font-bold text-maroon-950 shadow-lg shadow-yellow-500/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {primaryLabel}
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KioskErrorModal;
