import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import './RouteLoading.css';

/*
 * SHARED SPINNER STORE — the overlay is the ONLY spinner (owner's rule).
 *
 * Loading sources (the shells' tab-click curtain, Suspense fallbacks for
 * lazy chunks, and the route guards) NEVER render a spinner on the page
 * itself. Mounting RouteLoading merely increments a shared counter, and the
 * single RouteLoadingOverlay (mounted ONCE in App) shows the frosted
 * spinner overlay while the counter is above zero.
 *
 * The overlay DOM stays mounted continuously across handoffs (curtain ends
 * while a chunk still loads → the overlay simply stays up), so there is
 * never a double spinner and never a blink. StrictMode-safe.
 */
let pendingCount = 0;
const subscribers = new Set();

const emit = () => subscribers.forEach(listener => listener());

const subscribe = listener => {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
};

const getSnapshot = () => pendingCount > 0;

const useRouteLoadingVisible = () => useSyncExternalStore(subscribe, getSnapshot);

/*
 * Mount as a Suspense fallback, inside guards, or as the shells'
 * tab-click curtain. Renders NOTHING on the page — it only raises the
 * shared overlay for as long as it is mounted.
 */
const RouteLoading = () => {
  useEffect(() => {
    pendingCount += 1;
    emit();
    return () => {
      pendingCount -= 1;
      emit();
    };
  }, []);

  return null;
};

/*
 * The ONE spinner overlay. Mount ONCE, near the app root. Portaled to
 * <body> so it always sits above everything, and is BLOCKING while up.
 */
const RouteLoadingOverlay = () => {
  const visible = useRouteLoadingVisible();

  if (!visible) return null;

  return createPortal(
    <div className="route-loading-overlay" role="status" aria-busy="true">
      <span className="route-loading-spinner" aria-hidden="true" />
      <span className="sr-only">Loading page…</span>
    </div>,
    document.body
  );
};

export { RouteLoading, RouteLoadingOverlay };
export default RouteLoading;
