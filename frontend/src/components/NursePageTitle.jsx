import { NURSE_PAGE_HEADERS } from '../utils/nurseGreeting';

/*
 * Nurse-portal page banner (hero): the page title and one line on what the page is for, at the
 * top of every nurse page, on every screen size. Same look as the student portal's page hero.
 * The header bar above it shows the breadcrumb instead of the title. `title` replaces the listed
 * title (the dashboard passes its greeting).
 */
const NursePageTitle = ({ path, title }) => {
  const page = NURSE_PAGE_HEADERS[path];
  if (!page) return null;
  return (
    <section className="nurse-page-hero relative isolate overflow-hidden rounded-[10px] border border-[var(--np-border)] bg-[var(--np-surface)] dark:border-gray-700 dark:bg-gray-800">
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <h1 className="break-words text-3xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-4xl">{title || page.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{page.note}</p>
      </div>
    </section>
  );
};

export default NursePageTitle;
