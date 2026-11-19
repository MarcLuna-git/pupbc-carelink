/*
 * Live Queue window on the student QR page: where the student is in today's clinic queue, who is
 * being called and who is in consultation. Fed by `live_queue` of GET /student/qr, which the page
 * reloads every 10 seconds. Other students appear as queue numbers only, never by name.
 * QR.jsx shows it in place of Check-in Information only while the student is in today's queue.
 */

const PANEL = 'rounded-[10px] bg-gray-50 p-4 dark:bg-gray-900/30';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const CHIP = 'inline-flex min-w-[4.5rem] items-center justify-center rounded-[10px] border px-3 py-1.5 text-sm font-bold tabular-nums';
const CHIP_PLAIN = 'border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const CHIP_MINE = 'border-maroon-800 bg-maroon-800 text-white';

// What the student should know right now, in one short line.
const myLine = (mine) => {
  if (!mine) return ['Not in the queue yet', 'Check in at the clinic kiosk to get your queue number.'];
  if (mine.status === 'serving') return ['You are in consultation', 'The nurse is seeing you now.'];
  if (mine.status === 'called') return ['It is your turn', 'Please go to the clinic now.'];
  if (mine.ahead === 0) return ['You are next', 'Please stay near the clinic.'];
  const people = mine.ahead === 1 ? '1 student is' : `${mine.ahead} students are`;
  return [`You are number ${mine.ahead + 1} in line`, `${people} ahead of you.`];
};

const Numbers = ({ numbers, mine, empty }) => (numbers.length ? (
  <div className="mt-2 flex flex-wrap gap-2">
    {numbers.map((number) => (
      <span key={number} className={`${CHIP} ${number === mine ? CHIP_MINE : CHIP_PLAIN}`}>
        {number}{number === mine && <span className="ml-1.5 text-xs font-semibold">You</span>}
      </span>
    ))}
  </div>
) : <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{empty}</p>);

const LiveQueue = ({ queue }) => {
  const serving = queue?.serving || [];
  const calling = queue?.calling || [];
  const waiting = queue?.waiting || [];
  const total = queue?.waiting_total || 0;
  const mine = queue?.mine || null;
  const [headline, detail] = myLine(mine);
  const active = mine && ['called', 'serving'].includes(mine.status);

  return (
    <div className="grid gap-3">
      {/* The student's own place */}
      <div aria-live="polite" className={`flex flex-wrap items-center gap-4 rounded-[10px] p-5 ${active ? 'bg-maroon-800 text-white' : 'bg-gray-50 dark:bg-gray-900/30'}`}>
        <div className={`flex h-20 min-w-[7rem] flex-col items-center justify-center rounded-[10px] border px-4 ${active ? 'border-white/30' : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800'}`}>
          <span className={`text-[11px] font-semibold uppercase tracking-wide ${active ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>Your number</span>
          <span className={`text-2xl font-extrabold tabular-nums ${active ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{mine?.queue_number || 'None'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xl font-bold ${active ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{headline}</p>
          <p className={`mt-0.5 text-sm ${active ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}`}>{detail}</p>
        </div>
      </div>

      {/* What the clinic is doing now */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={PANEL}>
          <p className={LABEL}>Now calling</p>
          <Numbers numbers={calling} mine={mine?.queue_number} empty="No one is being called." />
        </div>
        <div className={PANEL}>
          <p className={LABEL}>In consultation</p>
          <Numbers numbers={serving} mine={mine?.queue_number} empty="No one is in consultation." />
        </div>
      </div>

      {/* Who is called next, in order */}
      <div className={PANEL}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={LABEL}>Waiting in line</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{total === 1 ? '1 student waiting' : `${total} students waiting`}</p>
        </div>
        <Numbers numbers={waiting} mine={mine?.queue_number} empty="No one is waiting." />
        {total > waiting.length && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">and {total - waiting.length} more</p>}
      </div>
    </div>
  );
};

export default LiveQueue;
