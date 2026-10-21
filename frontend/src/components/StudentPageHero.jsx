import { RefreshCw } from 'lucide-react';
import heroImage from '../assets/hero-appointment.png';
import RouteLoadingBar from './RouteLoadingBar';

/*
 * Illustrated Student-portal page banner — same artwork and fade as the
 * Appointments hero. `leading` sits left of the copy (e.g. an avatar),
 * `children` renders extra lines under the description (pass a null
 * `eyebrow` to hide it), `benefits` renders the small icon row under the copy,
 * `action` sits in the top-right corner (e.g. a refresh button), and
 * `loading` pins the route-loading bar to the bottom edge.
 */
const StudentPageHero = ({
  id,
  title,
  description,
  eyebrow = 'Student clinic',
  benefits = [],
  action = null,
  loading = false,
  leading = null,
  children = null,
}) => (
  <section
    className="relative isolate min-h-[168px] overflow-hidden rounded-xl border border-[var(--sp-border)] bg-[#fbeee9] bg-cover bg-right bg-no-repeat dark:bg-[#2a1c26] dark:bg-blend-multiply"
    style={{ backgroundImage: `url(${heroImage})` }}
    aria-labelledby={id}
  >
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,249,244,.95)_0%,rgba(255,249,244,.78)_52%,rgba(255,249,244,.2)_100%)] dark:bg-[linear-gradient(90deg,rgba(36,25,33,.95)_0%,rgba(36,25,33,.8)_52%,rgba(36,25,33,.35)_100%)]" />

    <div className="relative z-[1] flex max-w-full items-center gap-5 px-5 py-5 sm:max-w-[60%] sm:px-6">
      {leading}
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[1.7px] text-[#96604b] dark:text-[#d5a99a]">
            {eyebrow}
          </p>
        )}
        <h1
          id={id}
          className="mt-0.5 break-words text-[29px] font-bold leading-tight tracking-tight text-maroon-800 dark:text-maroon-300 sm:text-4xl"
        >
          {title}
        </h1>
        <p className={`mt-2 text-xs leading-relaxed text-gray-700 dark:text-gray-300 sm:max-w-none sm:text-sm ${leading ? '' : 'max-w-[62%]'}`}>
          {description}
        </p>
        {children}

        {benefits.length > 0 && (
          <div className="mt-4 flex max-w-[62%] flex-wrap gap-x-5 gap-y-2 sm:max-w-none">
            {benefits.map(({ icon: Icon, label }, index) => (
              <span
                key={label}
                className={`items-center gap-2 text-[10px] leading-snug text-gray-600 dark:text-gray-400 ${
                  index === benefits.length - 1 ? 'hidden sm:flex' : 'flex'
                }`}
              >
                <Icon className="h-[30px] w-[30px] shrink-0 rounded-md bg-[#f6deda] p-[7px] text-maroon-800 dark:bg-maroon-900/40 dark:text-maroon-300" />
                <span className="max-w-[7.5rem]">{label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>

    {action && <div className="absolute right-3 top-3 z-[2]">{action}</div>}

    {/* Route-loading bar — full-width fill/drain loop, hero only. */}
    {loading && <RouteLoadingBar className="z-[2]" />}
  </section>
);

/* Frosted refresh button for the hero's `action` slot. */
export const HeroRefreshButton = ({ onClick, refreshing = false, label = 'Refresh' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={refreshing}
    className="rounded-xl border border-white/60 bg-white/80 p-2.5 backdrop-blur transition hover:bg-white disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800/80 dark:hover:bg-gray-800"
    title="Refresh"
    aria-label={label}
  >
    <RefreshCw className={`h-4 w-4 text-gray-600 dark:text-gray-300 ${refreshing ? 'animate-spin' : ''}`} />
  </button>
);

export default StudentPageHero;
