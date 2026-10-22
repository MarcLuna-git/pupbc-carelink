import HeroArt from './HeroArt';

/*
 * Nurse-portal page banner: same layout and line-icon artwork as the Student
 * page heroes, in the nurse portal's own colors. `children` renders extra
 * content under the description (e.g. a status line).
 */
const NursePageHero = ({ id, title, description, eyebrow = 'Nurse portal', art = null, children = null }) => (
  <section
    className="relative isolate min-h-[168px] overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800"
    aria-labelledby={id}
  >
    <HeroArt icon={art} />
    <div className="relative z-[1] max-w-full px-5 py-5 sm:max-w-[60%] sm:px-6">
      {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[1.7px] text-gray-400">{eyebrow}</p>}
      <h1 id={id} className="mt-0.5 text-[29px] font-bold leading-tight tracking-tight text-maroon-800 dark:text-maroon-400 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 max-w-[62%] text-xs leading-relaxed text-gray-600 dark:text-gray-300 sm:max-w-none sm:text-sm">
        {description}
      </p>
      {children}
    </div>
  </section>
);

export default NursePageHero;
