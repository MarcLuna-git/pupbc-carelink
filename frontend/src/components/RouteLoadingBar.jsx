import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

/*
 * The looping route-loading progress bar — ONE bar for the whole app, fixed
 * to the top edge of the browser viewport (above the header), YouTube-style.
 *
 * Pages no longer render the bar inside their hero. While a page's first
 * data loads it calls pushRouteLoading(), and popRouteLoading() when done
 * (see StudentPageHero and AppointmentHero). The counter keeps the bar up
 * while two pages overlap during a route swap.
 *
 * Loop, two phases:
 *
 *   Phase 1 — FILL:  the HEAD (right edge) travels from the left edge to the
 *                    end of the track while the TAIL (left edge) stays pinned.
 *   Phase 2 — DRAIN: only once the head has reached the right edge, the tail
 *                    chases it — the head stays pinned at the end.
 *
 * The loop restarts ONLY after the tail reaches the right edge.
 *
 * Color: SOLID brand maroon (maroon-800 = #800000, same as the portal's
 * buttons). Never a gradient — lighter maroon shades (e.g. maroon-600 =
 * #dc2626) read pink against the pink hero backgrounds (Appointments).
 */

const EVENT = 'carelink:route-loading';
let activeCount = 0;
const emit = () => window.dispatchEvent(new CustomEvent(EVENT, { detail: activeCount > 0 }));

export const pushRouteLoading = () => {
  activeCount += 1;
  emit();
};

export const popRouteLoading = () => {
  activeCount = Math.max(0, activeCount - 1);
  emit();
};

export default function RouteLoadingBar() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onEvent = (event) => setActive(Boolean(event.detail));
    window.addEventListener(EVENT, onEvent);
    return () => window.removeEventListener(EVENT, onEvent);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1"
      aria-hidden="true"
    >
      {active && (
        <>
          {/* Faint track so the bar also reads over dark surfaces (sidebar). */}
          <div className="absolute inset-0 rounded-full bg-white/30 dark:bg-white/10" />
          <motion.div
          initial={{ left: '0%', width: '0%' }}
          animate={{
            left: ['0%', '0%', '100%'],
            width: ['0%', '100%', '0%'],
          }}
          transition={{
            duration: 2.2,
            times: [0, 0.5, 1],
            ease: 'easeInOut',
            repeat: Infinity,
            repeatDelay: 0.15,
          }}
          className="absolute h-1 rounded-full bg-maroon-800"
          />
        </>
      )}
    </div>
  );
}

/*
 * Student-portal scope: the bar appears ONLY for student pages — the portal
 * under /student plus the student auth pages (login, register, forgot and
 * reset password, including their OTP/reset steps). The nurse portal
 * (/nurse, /carelink-portal), the kiosk (/kiosk) and the public landing
 * page stay bar-free.
 */
export const isStudentPath = (pathname) =>
  pathname === '/login' ||
  pathname === '/register' ||
  pathname === '/forgot-password' ||
  pathname === '/reset-password' ||
  pathname === '/student' ||
  pathname.startsWith('/student/');

/* Suspense fallback for the lazy routes: while a student page's chunk loads,
   hold the top bar up (this covers every student page, even ones without a
   hero — login, register, forgot password, OTP). Other portals resolve with
   no bar at all. */
export function StudentRouteSuspenseFallback() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!isStudentPath(pathname)) return undefined;
    pushRouteLoading();
    return () => popRouteLoading();
  }, [pathname]);
  return null;
}
