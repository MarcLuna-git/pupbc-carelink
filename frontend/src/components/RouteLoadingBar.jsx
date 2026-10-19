import { motion } from 'framer-motion';

/*
 * The looping route-loading progress bar — full-width fill/drain cycle.
 *
 * Looks like the original one-shot fill (a bar growing from the left edge to
 * full width), but loops in two phases:
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
 * #dc2626) read pink against the pink hero backgrounds (Appointments), and
 * the bar must look identical on every hero.
 *
 * Place inside a `relative overflow-hidden` hero, pinned to its bottom edge.
 */
export default function RouteLoadingBar() {
  return (
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
      className="absolute bottom-0 h-1 rounded-full bg-maroon-800"
    />
  );
}
