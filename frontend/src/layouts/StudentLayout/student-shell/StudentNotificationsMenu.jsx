import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Calendar, CalendarCheck, CalendarX, CheckCheck, GraduationCap, Heart, Loader2, Megaphone, Siren, Stethoscope, X } from 'lucide-react';
import api from '../../../services/api';

/*
 * Header bell with a drop-down list of the student's notifications and the
 * clinic's announcements (replaces the old Alerts page). Same look as the
 * nurse portal's menu: All / Unread / Announcements tabs, items grouped by
 * day, a colored icon per kind, an unread dot, and "See older" paging.
 * The panel is portaled to <body> so the header cannot clip it.
 * Unread changes are announced with `carelink:notifications-updated`,
 * which the layout already listens to for the bell count.
 */

const KINDS = [
  [(type) => type === 'appointment_approved', CalendarCheck, 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'],
  [(type) => ['appointment_rejected', 'appointment_cancelled', 'appointment_expired', 'appointment_no_show'].includes(type), CalendarX, 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'],
  [(type) => type.startsWith('appointment_'), Calendar, 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'],
  [(type) => type.startsWith('consultation_'), Stethoscope, 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'],
];
const kindOf = (type = '') => {
  const value = String(type).toLowerCase();
  return KINDS.find(([match]) => match(value)) || [null, Bell, 'bg-maroon-100 text-maroon-800 dark:bg-maroon-900/40 dark:text-maroon-300'];
};
const ANNOUNCEMENT_STYLES = {
  'Clinic Advisory': [Heart, 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'],
  'Health Advisory': [Heart, 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'],
  'School Events': [GraduationCap, 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'],
  Emergency: [Siren, 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'],
  General: [Megaphone, 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'],
};

const linkOf = (item) => {
  if (item.link) return item.link;
  if (item.data?.link) return item.data.link;
  const type = String(item.type || '').toLowerCase();
  if (type.startsWith('appointment_')) return '/student/appointments';
  if (type === 'consultation_completed') return '/student/health-records';
  return null;
};

const manilaDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
const groupOf = (value) => {
  const day = manilaDay(new Date(value));
  if (day === manilaDay(new Date())) return 'Today';
  if (day === manilaDay(new Date(Date.now() - 86400000))) return 'Yesterday';
  return 'Earlier';
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
const listOf = (payload) => (Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []);
const announce = (count) => window.dispatchEvent(new CustomEvent('carelink:notifications-updated', { detail: { unreadCount: Math.max(0, Number(count) || 0) } }));

const StudentNotificationsMenu = ({ unreadCount }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [position, setPosition] = useState({ top: 64, right: 12 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const requestId = useRef(0);

  // Pages 1..`through` of the current tab, replacing the list.
  const load = useCallback(async (through = 1) => {
    const request = ++requestId.current;
    setLoading(true); setError('');
    try {
      if (tab === 'announcements') {
        const { data } = await api.get('/announcements', { params: { limit: 20 } });
        if (request !== requestId.current) return;
        setItems(listOf(data.data));
        setLastPage(1); setPage(1);
        return;
      }
      const collected = [];
      let last = 1;
      for (let current = 1; current <= through; current += 1) {
        const { data } = await api.get('/student/notifications', { params: { status: tab, page: current, limit: 20 } });
        if (request !== requestId.current) return;
        collected.push(...listOf(data.data));
        last = data.data?.last_page || 1;
        announce(data.unread_count);
        if (current >= last) break;
      }
      setItems(collected);
      setLastPage(last);
      setPage(Math.min(through, last));
    } catch {
      if (request === requestId.current) setError(tab === 'announcements' ? 'Announcements could not be loaded.' : 'Notifications could not be loaded.');
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [tab]);

  useEffect(() => { if (open) { setItems([]); load(1); } }, [open, load]);

  // Keep an open list fresh, like the bell count (which the layout polls).
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setInterval(() => { if (!document.hidden) load(page); }, 30000);
    return () => window.clearInterval(timer);
  }, [open, load, page]);

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
      await api.patch(`/student/notifications/${item.id}/read`);
      setItems((current) => (tab === 'unread' ? current.filter((n) => n.id !== item.id) : current.map((n) => (n.id === item.id ? { ...n, read: true } : n))));
      announce(unreadCount - 1);
      return true;
    } catch {
      setError('Could not mark the notification as read.');
      return false;
    }
  };

  const openItem = async (item) => {
    if (!(await markRead(item))) return;
    const target = linkOf(item);
    if (!target) return;
    setOpen(false);
    navigate(target);
  };

  const markAll = async () => {
    try {
      await api.patch('/student/notifications/read-all');
      setItems((current) => (tab === 'unread' ? [] : current.map((n) => ({ ...n, read: true }))));
      announce(0);
    } catch {
      setError('Could not mark all as read.');
    }
  };

  const remove = async (item) => {
    setBusyId(item.id);
    try {
      await api.delete(`/student/notifications/${item.id}`);
      setItems((current) => current.filter((n) => n.id !== item.id));
      if (!item.read) announce(unreadCount - 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete the notification.');
    } finally {
      setBusyId(null);
    }
  };

  const isAnnouncements = tab === 'announcements';
  const groups = ['Today', 'Yesterday', 'Earlier']
    .map((label) => [label, items.filter((item) => groupOf(item.created_at) === label)])
    .filter(([, list]) => list.length);

  const tabButton = (value, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => { setTab(value); setExpanded(null); }}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        tab === value
          ? 'bg-maroon-50 text-maroon-800 dark:bg-maroon-900/40 dark:text-maroon-200'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  const notificationRow = (item) => {
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
              {(item.message || item.text) && <span className="line-clamp-2"> {item.message || item.text}</span>}
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
  };

  // Announcements open in place: a click shows the whole text.
  const announcementRow = (item) => {
    const [Icon, tone] = ANNOUNCEMENT_STYLES[item.category] || ANNOUNCEMENT_STYLES.General;
    const isOpen = expanded === item.id;
    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => setExpanded(isOpen ? null : item.id)}
          aria-expanded={isOpen}
          className="flex w-full items-start gap-3 rounded-[10px] p-2 text-left transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 dark:hover:bg-gray-700/60"
        >
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tone}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-snug text-gray-900 dark:text-white">{item.title || 'Announcement'}</span>
            <span className={`mt-0.5 block whitespace-pre-line text-sm leading-snug text-gray-600 dark:text-gray-300 ${isOpen ? '' : 'line-clamp-2'}`}>{item.content || item.description}</span>
            <span className="mt-0.5 block text-xs font-semibold text-gray-400">{item.category || 'General'} · {timeAgo(item.created_at)}</span>
          </span>
        </button>
      </li>
    );
  };

  const panel = (
    <section
      ref={panelRef}
      id="student-notifications-panel"
      role="dialog"
      aria-label="Notifications"
      style={{ top: position.top, right: position.right }}
      className="fixed z-[70] flex max-h-[min(640px,calc(100dvh-90px))] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden rounded-[10px] border border-gray-200 bg-white text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h2 className="text-xl font-bold">Notifications</h2>
        {!isAnnouncements && (
          <button
            type="button"
            onClick={markAll}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-xs font-semibold text-maroon-800 hover:bg-maroon-50 disabled:cursor-default disabled:text-gray-400 disabled:hover:bg-transparent dark:text-maroon-300 dark:hover:bg-maroon-900/30"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all as read
          </button>
        )}
      </header>
      <div role="tablist" aria-label="Show" className="flex shrink-0 gap-1 overflow-x-auto px-4 pb-2">
        {tabButton('all', 'All')}
        {tabButton('unread', unreadCount > 0 ? `Unread (${unreadCount > 99 ? '99+' : unreadCount})` : 'Unread')}
        {tabButton('announcements', 'Announcements')}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {error && <p role="alert" className="mx-2 mb-2 rounded-[10px] bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
        {loading && items.length === 0 ? (
          <div role="status" className="space-y-2 p-2">
            {[0, 1, 2].map((key) => <div key={key} className="flex gap-3"><div className="h-12 w-12 animate-pulse rounded-full bg-gray-100 dark:bg-gray-700" /><div className="flex-1 space-y-2 py-1"><div className="h-3 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-700" /><div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-700" /></div></div>)}
            <span className="sr-only">Loading</span>
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center">
            {isAnnouncements ? <Megaphone className="mx-auto mb-3 h-9 w-9 text-gray-300 dark:text-gray-600" aria-hidden="true" /> : <Bell className="mx-auto mb-3 h-9 w-9 text-gray-300 dark:text-gray-600" aria-hidden="true" />}
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              {isAnnouncements ? 'No announcements' : tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {isAnnouncements ? 'Clinic advisories and campus health news will show up here.' : tab === 'unread' ? 'You are all caught up.' : 'Updates about your appointments and visits will show up here.'}
            </p>
          </div>
        ) : (
          groups.map(([label, list]) => (
            <div key={label} className="mt-1">
              <h3 className="px-2 pb-1 pt-2 text-sm font-bold text-gray-800 dark:text-gray-200">{label}</h3>
              <ul>{list.map(isAnnouncements ? announcementRow : notificationRow)}</ul>
            </div>
          ))
        )}
      </div>

      {!isAnnouncements && page < lastPage && items.length > 0 && (
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
        aria-controls={open ? 'student-notifications-panel' : undefined}
        aria-label={unreadCount > 0 ? `Notifications and announcements (${unreadCount} unread)` : 'Notifications and announcements'}
        title="Notifications & Announcements"
        className={`student-header-icon student-notification-bell${unreadCount > 0 ? ' has-unread' : ''}${open ? ' is-open' : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="student-bell-count" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && createPortal(panel, document.body)}
    </>
  );
};

export default StudentNotificationsMenu;
