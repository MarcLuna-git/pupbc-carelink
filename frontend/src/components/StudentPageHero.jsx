import { useEffect } from 'react';

import { popRouteLoading, pushRouteLoading } from './RouteLoadingBar';

/*
 * Student-portal page banner: the page title and one line of description.
 * `leading` sits left of the copy (e.g. an avatar), `children` renders extra
 * lines under the description, `action` sits in the top-right corner, and
 * `loading` drives the single top-edge loading bar while the page loads.
 */
const StudentPageHero = ({
  id,
  title,
  description,
  action = null,
  loading = false,
  leading = null,
  children = null,
}) => {
  // Hold the global top loading bar up while this page's first data loads.
  useEffect(() => {
    if (!loading) return undefined;
    pushRouteLoading();
    return () => popRouteLoading();
  }, [loading]);

  return (
    <section
      className="relative isolate overflow-hidden rounded-[10px] border border-[var(--sp-border)] bg-[var(--sp-surface)]"
      aria-labelledby={id}
    >
      <div className="relative z-[1] flex max-w-full items-center gap-5 px-5 py-5 sm:px-6 sm:py-6">
        {leading}
        <div className="min-w-0">
          <h1
            id={id}
            className="break-words text-3xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-4xl"
          >
            {title}
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {description}
          </p>
          {children}
        </div>
      </div>

      {action && <div className="absolute right-3 top-3 z-[2]">{action}</div>}
    </section>
  );
};

export default StudentPageHero;
