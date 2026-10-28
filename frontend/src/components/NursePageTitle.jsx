import { NURSE_PAGE_HEADERS } from '../utils/nurseGreeting';

/*
 * Page title and purpose for the nurse portal. On tablet and desktop they are shown in the top
 * header bar (see nurseHeaderFor), so here they are only for screen readers. The mobile header
 * shows the brand instead, so on phones this is the visible title.
 */
const NursePageTitle = ({ path }) => {
  const page = NURSE_PAGE_HEADERS[path];
  if (!page) return null;
  return (
    <div className="md:sr-only">
      <h1 className="text-lg font-bold text-maroon-800 dark:text-maroon-300">{page.title}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">{page.note}</p>
    </div>
  );
};

export default NursePageTitle;
