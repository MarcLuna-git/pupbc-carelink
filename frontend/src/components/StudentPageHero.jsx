import HeroArt from './HeroArt';
import RouteLoadingBar from './RouteLoadingBar';

/*
 * Student-portal page banner with the same aurora + tab-icon artwork as the
 * Appointments hero (`art` is the tab's lucide icon; see HeroArt). `leading`
 * sits left of the copy (e.g. an avatar),
 * `children` renders extra lines under the description (pass a null
 * `eyebrow` to hide it), `benefits` renders the small icon row under the copy,
 * `action` sits in the top-right corner, and
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
  art = null,
}) => (
  <section
    className="relative isolate min-h-[168px] overflow-hidden rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface)]"
    aria-labelledby={id}
  >
    <HeroArt icon={art} />

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

export default StudentPageHero;
