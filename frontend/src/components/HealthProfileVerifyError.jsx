/*
 * Shown when the backend Health Profile verification fails and there is no
 * cached / stored completed status to fall back on. Used by the
 * clinic-service pages (Appointments, QR) and the /student redirect.
 */
const HealthProfileVerifyError = ({ retry }) => (
  <div className="flex min-h-[55vh] items-center justify-center px-4">
    <div className="w-full max-w-md rounded-[10px] border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl dark:bg-red-950/30">
        !
      </div>

      <h2 className="mt-4 text-base font-bold text-gray-900 dark:text-white">
        Unable to verify your Health Profile
      </h2>

      <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
        Please check your connection and try again. Your saved
        information has not been changed.
      </p>

      <button
        type="button"
        onClick={retry}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[10px] bg-maroon-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-maroon-500/30"
      >
        Try Again
      </button>
    </div>
  </div>
);

export default HealthProfileVerifyError;
