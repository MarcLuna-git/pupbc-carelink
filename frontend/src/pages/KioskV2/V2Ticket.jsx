import { useEffect, useRef, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import api from '../../services/api';
import { PRIMARY_BTN } from './KioskV2Layout';

const RESET_SECONDS = 30;
const MINUTES_PER_PATIENT = 5;

// Step 6: queue number from the backend, live position, then auto-return home.
const V2Ticket = ({ ticket, alreadyCheckedIn, service, onDone }) => {
  const [queue, setQueue] = useState(null);
  const [countdown, setCountdown] = useState(RESET_SECONDS);
  const pendingRef = useRef(false);
  const isPriority = ticket.queue_type === 'priority';

  useEffect(() => {
    const fetchQueue = async () => {
      if (pendingRef.current || document.hidden) return;
      pendingRef.current = true;
      try {
        const response = await api.get('/kiosk/queue');
        if (response.data.success) setQueue(response.data.data);
      } catch {
        // Keep the last known queue on a connection failure.
      } finally {
        pendingRef.current = false;
      }
    };
    fetchQueue();
    const poll = setInterval(fetchQueue, 10000);
    const tick = setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, []);

  useEffect(() => {
    if (countdown === 0) onDone();
  }, [countdown, onDone]);

  const position = queue?.queue?.findIndex((item) => item.id === ticket.id) ?? -1;
  const ahead = position < 0 ? 0 : queue.queue.slice(0, position).filter((item) => item.status === 'waiting').length;

  return (
    <div className="w-full max-w-lg text-center">
      <CheckCircle className="mx-auto h-16 w-16 text-green-600" aria-hidden="true" />
      <h1 className="mt-3 text-3xl font-extrabold">{alreadyCheckedIn ? 'You Are Already Checked In' : 'You Are Checked In!'}</h1>
      <p className="mt-1 text-lg text-gray-600">Please wait for your number to be called.</p>

      <div className={`mt-6 rounded-3xl border-2 bg-white p-8 shadow-sm ${isPriority ? 'border-red-300' : 'border-maroon-200'}`}>
        <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Your Queue Number</p>
        <p className={`my-2 text-8xl font-black tracking-tight ${isPriority ? 'text-red-600' : 'text-maroon-800'}`}>{ticket.queue_number}</p>
        <span className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${isPriority ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
          {isPriority ? 'Priority Queue' : 'Regular Queue'}
        </span>
        {service && <p className="mt-3 font-semibold text-gray-700">{service}</p>}

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-dashed border-gray-200 pt-5">
          <div>
            <p className="text-sm text-gray-500">Ahead of you</p>
            <p className="text-xl font-bold">{ahead}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Est. wait</p>
            <p className="text-xl font-bold">~{ahead * MINUTES_PER_PATIENT} min</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Now serving</p>
            <p className="text-xl font-bold text-green-700">{queue?.now_serving?.queue_number || '—'}</p>
          </div>
        </div>
      </div>

      <button type="button" onClick={onDone} className={`${PRIMARY_BTN} mt-6 w-full`}>Done</button>
      <p className="mt-3 text-gray-500">Returning to the home screen in {countdown}s</p>
    </div>
  );
};

export default V2Ticket;
