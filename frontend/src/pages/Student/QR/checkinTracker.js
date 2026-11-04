// Maps today's queue status to the QR page's four check-in steps (0-3).
export const checkinStepIndex = (queue, appointment) => {
  if (appointment?.status === 'completed') return 3;
  switch (queue?.status) {
    // Checked in and still in line, including a skipped or held turn.
    case 'waiting':
    case 'skipped':
    case 'on_hold':
      return 1;
    // Called by the nurse (on the way in) or already in the consultation room.
    case 'called':
    case 'serving':
      return 2;
    case 'completed':
      return 3;
    default:
      return 0;
  }
};

// What the current step says when the queue status needs more than the step's usual text.
export const QUEUE_STATUS_NOTES = {
  skipped: 'You were not here when called. Tell the clinic staff you have arrived.',
  on_hold: 'Your turn is on hold. Please stay near the clinic.',
  called: 'Your number has been called. Please proceed to the clinic now.',
};
