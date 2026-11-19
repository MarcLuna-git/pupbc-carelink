/*
 * Nurse-portal list / table card: its own heading (icon, title, short
 * description, optional actions on the right), an optional toolbar for search
 * and filters, and the records themselves inside a nested bordered panel.
 * `bodyClassName` styles that nested panel (e.g. padding for card lists).
 * `fill` stretches the card (and the panel) to the height left in a flex
 * column, so side-by-side columns end on the same line.
 */
const NurseListCard = ({
  icon: Icon,
  title,
  description,
  actions = null,
  toolbar = null,
  children,
  bodyClassName = '',
  className = '',
  fill = false,
  ...sectionProps
}) => (
  <section
    {...sectionProps}
    className={`overflow-hidden rounded-[10px] border border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${fill ? 'flex flex-1 flex-col' : ''} ${className}`}
  >
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-700 lg:px-6">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-400">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-bold text-gray-900 dark:text-white">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
    <div className={`space-y-4 p-4 lg:p-6 ${fill ? 'flex flex-1 flex-col' : ''}`}>
      {toolbar}
      <div className={`overflow-hidden rounded-[10px] border border-gray-100 dark:border-gray-700 ${fill ? 'flex flex-1 flex-col' : ''} ${bodyClassName}`}>
        {children}
      </div>
    </div>
  </section>
);

export const CountChip = ({ children }) => (
  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500 tabular-nums dark:bg-gray-700 dark:text-gray-300">{children}</span>
);

export default NurseListCard;
