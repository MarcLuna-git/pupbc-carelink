import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, Loader2, CheckCheck, Trash2, Inbox, Pill, Stethoscope, Clock, ChevronLeft, ChevronRight, BellRing } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageHero from '../../../components/NursePageHero';
import NurseListCard from '../../../components/NurseListCard';
import { fetchNurseNotifications } from '../../../services/nurseNotifications';
import useNurseSync from '../../../hooks/useNurseSync';
import { NurseToast } from '../../../components/NurseFeedback';

const NurseNotifications = () => {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const requestId = useRef(0);
  const categories = [['all', 'All'], ['medicine', 'Medicines'], ['appointment', 'Appointments'], ['consultation', 'Consultations']];

  const fetchNotifications = useCallback(async (silent = false) => {
    const currentRequest = ++requestId.current;
    try {
      if (!silent) setLoading(true);
      setError('');
      const response = await fetchNurseNotifications({ category, page });
      if (currentRequest !== requestId.current) return;
      if (response.data.success) {
        const data = response.data.data;
        if (data?.last_page && page > data.last_page) {
          setPage(data.last_page);
          return;
        }
        setLastPage(data?.last_page || 1);
        const notifications = Array.isArray(data) ? data : (data?.data || []);
        const formatted = notifications.map(n => ({
          id: n.id,
          title: n.title || n.type || 'Notification',
          message: n.message || n.text || n.description || '',
          time: formatTimeAgo(n.created_at),
          read: n.read || false,
          type: n.type || 'info',
          data: n.data || {},
        }));
        setNotifs(formatted);
      }
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      console.log('Notifications error:', err);
      if (silent) throw err;
      setError('Failed to load notifications.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [category, page]);

  useNurseSync(['notifications', 'medicines'], () => fetchNotifications(true));

  useEffect(() => {
    const requests = requestId;
    fetchNotifications();
    return () => { requests.current++; };
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      return true;
    } catch (err) {
      console.error('Mark read error:', err);
      setActionError('Could not mark the notification as read.');
      return false;
    }
  };

  const openNotification = async (notification) => {
    if (!notification.read && !(await markAsRead(notification.id))) return;
    if (notification.type.startsWith('appointment_')) navigate('/nurse/appointments');
    else if (notification.type.startsWith('medicine_')) navigate('/nurse/medicines');
    else if (notification.type.startsWith('consultation_')) navigate('/nurse/consultation');
    else navigate('/nurse/notifications');
  };

  const deleteNotification = async (id) => {
    setActionLoading(id);
    try {
      await api.delete(`/notifications/${id}`);
      setNotifs((current) => current.filter((notification) => notification.id !== id));
      await fetchNotifications();
    } catch (err) {
      console.error('Delete notification error:', err);
      setActionError(err.response?.data?.message || 'Could not delete the notification.');
    } finally {
      setActionLoading(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.log('Mark all read error:', err);
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  const categoryIcons = { all: Inbox, medicine: Pill, appointment: Calendar, consultation: Stethoscope };
  const categoryLabel = categories.find(([value]) => value === category)?.[1];

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <NursePageHero
        id="nurse-notifications-title"
        title="Notifications"
        description="Clinic updates about appointments, consultations, and medicine stock."
        art={Bell}
      />

      <NurseToast message={actionError} type="error" onClose={() => setActionError('')} />

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-center text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div>
      )}

      {/* Feed card: its own heading, category tabs, and the list in a nested panel. */}
      <NurseListCard
        aria-label="Notification list"
        icon={BellRing}
        title="Notification feed"
        description="Open a notification to jump to its page. Unread items are highlighted."
        actions={!loading && (unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllAsRead}
              aria-label={`Mark all categories read (${unreadCount} unread on this page)`}
              title="Mark all categories read"
              className="flex shrink-0 items-center gap-2 rounded-lg bg-maroon-50 px-3 py-2 text-sm font-semibold text-maroon-700 transition hover:bg-maroon-100 dark:bg-maroon-900/20 dark:text-maroon-400 dark:hover:bg-maroon-900/30"
            >
              <CheckCheck className="h-4 w-4" />
              <span>Mark all read</span>
              <span className="min-w-6 rounded-full bg-maroon-800 px-1.5 py-0.5 text-center text-[11px] font-bold leading-4 text-white tabular-nums dark:bg-maroon-400 dark:text-gray-900">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </button>
          ) : (
            <span className="flex shrink-0 items-center gap-1.5 px-1 text-sm font-medium text-gray-400">
              <CheckCheck className="h-4 w-4" />
              All caught up
            </span>
          ))}
        toolbar={
          <div role="group" aria-label="Filter notifications by category" className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700/60">
            {categories.map(([value, label]) => {
              const Icon = categoryIcons[value];
              const active = category === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => { setCategory(value); setPage(1); }}
                  className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 ${
                    active
                      ? 'bg-maroon-800 text-white'
                      : 'text-gray-500 hover:bg-white hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        }
      >
        <div className="p-3 sm:p-4">
          {loading ? <NursePageSkeleton contentOnly label="Loading notifications" /> : notifs.length === 0 ? (
            <div className="py-14 text-center">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50">
                <Bell className="h-8 w-8 text-gray-300 dark:text-gray-500" />
              </span>
              <h3 className="text-base font-semibold text-gray-600 dark:text-gray-300">No {category === 'all' ? '' : categoryLabel + ' '}Notifications</h3>
              <p className="mt-1 text-sm text-gray-400">Notifications for this category will appear here.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifs.map(n => (
                <li key={n.id}>
                  <div
                    onClick={() => openNotification(n)}
                    onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) openNotification(n); }}
                    role="button"
                    tabIndex={0}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 ${
                      n.read
                        ? 'border-gray-100 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/40'
                        : 'border-maroon-100 bg-maroon-50/50 hover:bg-maroon-50 dark:border-maroon-900/40 dark:bg-maroon-900/10 dark:hover:bg-maroon-900/20'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      n.read ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500' : 'bg-white text-maroon-800 shadow-sm dark:bg-gray-800 dark:text-maroon-400'
                    }`}>
                      <Bell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className={`text-sm ${n.read ? 'font-medium text-gray-500 dark:text-gray-400' : 'font-bold text-gray-900 dark:text-white'}`}>
                          {n.title}
                        </h3>
                        <div className="flex shrink-0 items-center gap-2">
                          {!n.read && <span className="h-2 w-2 rounded-full bg-maroon-600" aria-label="Unread" />}
                          <button type="button" onClick={(event) => { event.stopPropagation(); deleteNotification(n.id); }}
                            disabled={actionLoading === n.id} aria-label="Delete notification"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20">
                            {actionLoading === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{n.message}</p>
                      <p className="mt-1.5 flex items-center text-xs text-gray-400">
                        <Clock className="mr-1 inline h-3 w-3" />{n.time}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lastPage > 1 && (
          <nav aria-label="Notification pages" className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm dark:border-gray-700 lg:px-6">
            <button type="button" disabled={loading || page === 1} onClick={() => setPage(current => current - 1)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50">
              <ChevronLeft className="h-4 w-4" /><span>Previous</span>
            </button>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Page {page} of {lastPage}</span>
            <button type="button" disabled={loading || page >= lastPage} onClick={() => setPage(current => current + 1)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50">
              <span>Next</span><ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        )}
      </NurseListCard>
    </div>
  );
};

export default NurseNotifications;
