/*
 * Preload helpers for lazily-loaded Student pages.
 *
 * App.jsx keeps its own `lazy(() => import(...))` calls; importing the same
 * module path here returns the same Vite chunk, so the browser serves it from
 * cache the moment React Router actually renders the page. Triggers are
 * user-intent only (hover / focus) — nothing downloads on its own. Failures
 * are swallowed: the real navigation retries the import by itself.
 */
const PRELOADS = {
  '/student/settings': () =>
    import('../pages/Student/Settings/Settings').catch(() => {}),
  '/student/profile': () =>
    import('../pages/Student/Overview/Overview').catch(() => {}),
  '/student/health-records': () =>
    import('../pages/Student/HealthRecords/HealthRecords').catch(() => {}),
  '/student/qr': () =>
    import('../pages/Student/QR/QR').catch(() => {}),
  '/student/appointments': () =>
    import('../pages/Student/Appointments/Appointments').catch(() => {}),
};

export const preloadForPath = (path) => PRELOADS[path]?.();
