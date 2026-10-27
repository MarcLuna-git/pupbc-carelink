/*
 * Nurse-portal page banner: same layout as the Student page heroes, in the
 * nurse portal's colors. `eyebrow` is only for a lead-in that is part of the
 * heading's sentence (the dashboard greeting). `children` renders extra
 * content under the description (e.g. a status line).
 */
const NursePageHero = ({ id, title, description, eyebrow = null, children = null }) => (
  <section
    className="relative isolate overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800"
    aria-labelledby={id}
  >
    <div className="relative z-[1] max-w-full px-5 py-5 sm:px-6 sm:py-6">
      {eyebrow && <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{eyebrow}</p>}
      <h1 id={id} className="text-3xl font-bold leading-tight tracking-tight text-maroon-800 dark:text-maroon-400 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {description}
      </p>
      {children}
    </div>
  </section>
);

export default NursePageHero;
