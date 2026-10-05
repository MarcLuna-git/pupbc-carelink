export default function RouteLoading() {
  return <div role="status" aria-busy="true" className="mx-auto min-h-[55vh] w-full max-w-6xl space-y-5 p-6">
    <span className="sr-only">Loading page...</span>
    <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
      <div className="h-7 w-48 rounded-xl bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-64 max-w-full rounded-xl bg-gray-200 dark:bg-gray-700" />
      <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-40 rounded-2xl bg-gray-100 dark:bg-gray-800" />)}</div>
    </div>
  </div>;
}
