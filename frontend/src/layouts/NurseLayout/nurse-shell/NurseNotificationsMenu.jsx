import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Calendar, CheckCheck, Loader2, Pill, Stethoscope, UserX, X } from 'lucide-react';
import api from '../../../services/api';
import { fetchNurseNotifications } from '../../../services/nurseNotifications';
import useNurseSync from '../../../hooks/useNurseSync';

/*
 * Header bell with a drop-down notification list (replaces the old
 * Notifications page). All / Unread tabs, items grouped by day, a colored
 * icon per kind, an unread dot, and "Load more" for older pages.
 * The panel is portaled to <body>: the header's backdrop-filter would
 * otherwise trap and clip a fixed-position panel.
 */

const KINDS = [
  ['appointment_', Calendar, 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', '/nurse/appointments'],
  ['medicine_', Pill, 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', '/nurse/medicines'],
  ['consultation_', Stethoscope, 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', '/nurse/consultation'],
  ['student_', UserX, 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300', '/nurse/students'],
];
const kindOf = (type = '') => KINDS.find(([prefix]) => type.startsWith(prefix)) || [null, Bell, 'bg-maroon-100 text-maroon-800 dark:bg-maroon-900/40 dark:text-maroon-300', null];

const manilaDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
const groupOf = (value) => {
  const date = new Date(value);
  const today = manilaDay(new Date());
  const yesterday = manilaDay(new Date(Date.now() - 86400000));
  const day = manilaDay(date);
  return day === today ? 'Today' : day === yesterday ? 'Yesterday' : 'Earlier';
};
const timeAgo = (value) => {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const NurseNotificationsMenu = ({ unreadCount, onUnreadCount }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('all');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [position, setPosition] = useState({ top: 64, right: 12 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const requestId = useRef(0);

  // Pages 1..`through` of the current tab, replacing the list.
  const load = useCallback(async (through = 1) => {
    const request = ++requestId.current;
    setLoading(true); setError('');
    try {
      const pages = [];
      let last = 1;
      for (let current = 1; current <= through; current += 1) {
        const { data } = await fetchNurseNotifications({ status, page: current });
        if (request !== requestId.current) return;
        const body = data.data || {};
        pages.push(...(Array.isArray(body) ? body : body.data || []));
        last = body.last_page || 1;
        onUnreadCount(Math.max(0, Number(data.unread_count) || 0));
        if (current >= last) break;
      }
      setItems(pages);
      setLastPage(last);
      setPage(Math.min(through, last));
    } catch {
      if (request === requestId.current) setError('Notifications could not be loaded.');
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [status, onUnreadCount]);

  useEffect(() => { if (open) load(1); }, [open, load]);
  useNurseSync(['notifications', 'medicines'], async () => { if (open) await load(page); }, `${open}:${status}:${page}`);

  // Close on route change, outside click and Escape.
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!panelRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // Anchor the panel under the bell, kept on screen.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(400, window.innerWidth - 24);
      const right = Math.min(window.innerWidth - rect.right, window.innerWidth - width - 12);
      setPosition({ top: rect.bottom + 8, right: Math.max(12, right) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  const markRead = async (item) => {
    if (item.read) return true;
    try {
      await api.patch(`/notifications/${item.id}/read`);
      setItems((current) => (status === 'unread' ? current.filter((n) => n.id !== item.id) : current.map((n) => (n.id === item.id ? { ...n, read: true } : n))));
      onUnreadCount(Math.max(0, unreadCount - 1));
      return true;
    } catch {
      setError('Could not mark the notification as read.');
      return false;
    }
  };

  const openItem = async (item) => {
    if (!(await markRead(item))) return;
    const target = kindOf(item.type)[3];
    setOpen(false);
    if (target) navigate(target);
  };

  const markAll = async () => {
    try {
      await api.patch('/notifications/read-all');
      setItems((current) => (status === 'unread' ? [] : current.map((n) => ({ ...n, read: true }))));
      onUnreadCount(0);
    } catch {
      setError('Could not mark all as read.');
    }
  };

  const remove = async (item) => {
    setBusyId(item.id);
    try {
      await api.delete(`/notifications/${item.id}`);
      setItems((current) => current.filter((n) => n.id !== item.id));
      if (!item.read) onUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete the notification.');
    } finally {
      setBusyId(null);
    }
  };

  const groups = ['Today', 'Yesterday', 'Earlier']
    .map((label) => [label, items.filter((item) => groupOf(item.created_at) === label)])
    .filter(([, list]) => list.length);

  const tab = (value, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={status === value}
      onClick={() => setStatus(value)}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        status === value
          ? 'bg-maroon-50 text-maroon-800 dark:bg-maroon-900/40 dark:text-maroon-200'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  const panel = (
    <section
      ref={panelRef}
      id="nurse-notifications-panel"
      role="dialog"
      aria-label="Notifications"
      style={{ top: position.top, right: position.right }}
      className="fixed z-[70] flex max-h-[min(640px,calc(100dvh-90px))] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden rounded-[10px] border border-gray-200 bg-white text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h2 className="text-xl font-bold">Notifications</h2>
        <button
          type="button"
          onClick={markAll}
          disabled={unreadCount === 0}
          className="inline-flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-xs font-semibold text-maroon-800 hover:bg-maroon-50 disabled:cursor-default disabled:text-gray-400 disabled:hover:bg-transparent dark:text-maroon-300 dark:hover:bg-maroon-900/30"
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          Mark all as read
        </button>
      </header>
      <div role="tablist" aria-label="Show notifications" className="flex shrink-0 gap-1 px-4 pb-2">
        {tab('all', 'All')}
        {tab('unread', unreadCount > 0 ? `Unread (${unreadCount > 99 ? '99+' : unreadCount})` : 'Unread')}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {error && <p role="alert" className="mx-2 mb-2 rounded-[10px] bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
        {loading && items.length === 0 ? (
          <div role="status" className="space-y-2 p-2">
            {[0, 1, 2].map((key) => <div key={key} className="flex gap-3"><div className="h-12 w-12 animate-pulse rounded-full bg-gray-100 dark:bg-gray-700" /><div className="flex-1 space-y-2 py-1"><div className="h-3 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-700" /><div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-700" /></div></div>)}
            <span className="sr-only">Loading notifications</span>
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Bell className="mx-auto mb-3 h-9 w-9 text-gray-300 dark:text-gray-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{status === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
            <p className="mt-1 text-xs text-gray-400">{status === 'unread' ? 'You are all caught up.' : 'Clinic updates will show up here.'}</p>
          </div>
        ) : (
          groups.map(([label, list]) => (
            <div key={label} className="mt-1">
              <h3 className="px-2 pb-1 pt-2 text-sm font-bold text-gray-800 dark:text-gray-200">{label}</h3>
              <ul>
                {list.map((item) => {
                  const [, Icon, tone] = kindOf(item.type);
                  return (
                    <li key={item.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        className={`flex w-full items-start gap-3 rounded-[10px] p-2 pr-8 text-left transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 dark:hover:bg-gray-700/60 ${item.read ? '' : 'bg-maroon-50/40 dark:bg-maroon-900/10'}`}
                      >
                        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tone}`}>
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm leading-snug ${item.read ? 'text-gray-600 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                            <span className="font-semibold">{item.title || 'Notification'}</span>
                            {item.message && <span className="line-clamp-2"> {item.message}</span>}
                          </span>
                          <span className={`mt-0.5 block text-xs font-semibold ${item.read ? 'text-gray-400' : 'text-maroon-700 dark:text-maroon-300'}`}>{timeAgo(item.created_at)}</span>
                        </span>
                        {!item.read && <span className="mt-5 h-2.5 w-2.5 shrink-0 rounded-full bg-maroon-600" aria-label="Unread" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        disabled={busyId === item.id}
                        aria-label={`Remove notification: ${item.title || 'Notification'}`}
                        title="Remove"
                        className="absolute right-1 top-1 rounded-full p-1.5 text-gray-400 opacity-0 transition hover:bg-gray-200 hover:text-gray-700 focus:opacity-100 group-hover:opacity-100 disabled:opacity-100 dark:hover:bg-gray-600 dark:hover:text-gray-200"
                      >
                        {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {page < lastPage && items.length > 0 && (
        <footer className="border-t border-gray-100 p-3 dark:border-gray-700">
          <button
            type="button"
            onClick={() => load(page + 1)}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-gray-100 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            See older notifications
          </button>
        </footer>
      )}
    </section>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? 'nurse-notifications-panel' : undefined}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        title="Notifications"
        className={`nurse-header-icon nurse-notification-bell ${open ? 'is-open' : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="nurse-bell-count" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && createPortal(panel, document.body)}
    </>
  );
};

export default NurseNotificationsMenu;
