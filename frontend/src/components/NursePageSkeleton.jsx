const Block = ({ className = '' }) => <div className={`rounded-xl bg-gray-200 dark:bg-gray-700 ${className}`} />;

export default function NursePageSkeleton({ variant = 'list', label = 'Loading page', contentOnly = false }) {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-6xl space-y-5">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
        {!contentOnly && <div className="space-y-2"><Block className="h-7 w-48" /><Block className="h-4 w-64 max-w-full" /></div>}
        {variant === 'dashboard' && <>
          <Block className="h-44 rounded-3xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-28 rounded-3xl" />)}</div>
        </>}
        {!contentOnly && variant !== 'dashboard' && <Block className="h-11" />}
        <div className={variant === 'cards' ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3' : variant === 'dashboard' ? 'grid gap-5 lg:grid-cols-2' : 'space-y-3'}>
          {Array.from({ length: variant === 'cards' ? 6 : 4 }, (_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3"><Block className="h-10 w-10 shrink-0" /><Block className="h-4 w-1/2" /></div>
              <Block className="h-3 w-3/4" /><Block className="h-3 w-1/2" />
              {(variant === 'cards' || variant === 'dashboard') && <Block className="h-10" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
