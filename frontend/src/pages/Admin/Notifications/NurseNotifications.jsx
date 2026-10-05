import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, Loader2, CheckCheck, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import { fetchNurseNotifications } from '../../../services/nurseNotifications';

const NurseNotifications = () => {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const requestId = useRef(0);
  const categories = [['all', 'All'], ['medicine', 'Medicines'], ['appointment', 'Appointments'], ['consultation', 'Consultations']];

  const fetchNotifications = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      setLoading(true);
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
      setError('Failed to load notifications.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [category, page]);

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
      setError('Could not mark the notification as read.');
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
      setError(err.response?.data?.message || 'Could not delete the notification.');
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

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? 'Loading notifications…' : unreadCount > 0 ? `${unreadCount} unread on this page` : 'No unread notifications on this page'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="flex items-center space-x-1.5 text-xs font-semibold text-maroon-600 dark:text-maroon-400 hover:text-maroon-800 dark:hover:text-maroon-300 bg-maroon-50 dark:bg-maroon-900/20 px-3 py-1.5 rounded-xl transition"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All Categories Read</span>
          </button>
        )}
      </div>

      <div role="group" aria-label="Filter notifications by category" className="flex flex-wrap gap-2">
        {categories.map(([value, label]) => <button key={value} type="button" aria-pressed={category === value}
          onClick={() => { setCategory(value); setPage(1); }}
          className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-300 ${category === value
            ? 'border-maroon-800 bg-maroon-800 text-white dark:border-maroon-300 dark:bg-maroon-300 dark:text-gray-900'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'}`}>
          {label}
        </button>)}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl text-sm text-center">{error}</div>
      )}

      {loading ? <NursePageSkeleton contentOnly label="Loading notifications" /> : notifs.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500">No {category === 'all' ? '' : categories.find(([value]) => value === category)[1] + ' '}Notifications</h3>
          <p className="text-sm text-gray-400 mt-1">Notifications for this category will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => (
            <div
              key={n.id} 
              onClick={() => openNotification(n)}
              onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) openNotification(n); }}
              role="button"
              tabIndex={0}
              className={`bg-white dark:bg-gray-800 rounded-2xl border p-4 cursor-pointer transition hover:shadow-md ${
                !n.read 
                  ? 'border-l-4 border-l-maroon-800 bg-maroon-50/30 dark:bg-maroon-900/10' 
                  : 'border-gray-100 dark:border-gray-700 opacity-75'
              }`}>
              <div className="flex items-start space-x-3">
                <Bell className={`w-5 h-5 mt-0.5 flex-shrink-0 ${n.read ? 'text-gray-400' : 'text-maroon-800 dark:text-maroon-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={`text-sm ${n.read ? 'font-medium text-gray-500 dark:text-gray-400' : 'font-bold text-gray-900 dark:text-white'}`}>
                      {n.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      {!n.read && <span className="w-2 h-2 bg-maroon-600 rounded-full flex-shrink-0" />}
                      <button type="button" onClick={(event) => { event.stopPropagation(); deleteNotification(n.id); }}
                        disabled={actionLoading === n.id} aria-label="Delete notification"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                        {actionLoading === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1.5 flex items-center">
                    <Calendar className="w-3 h-3 inline mr-1" />{n.time}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {lastPage > 1 && <nav aria-label="Notification pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" disabled={loading || page === 1} onClick={() => setPage(current => current - 1)} className="min-h-11 rounded-xl border border-gray-200 px-4 py-2 disabled:opacity-40 dark:border-gray-600">Previous</button>
        <span>Page {page} of {lastPage}</span>
        <button type="button" disabled={loading || page >= lastPage} onClick={() => setPage(current => current + 1)} className="min-h-11 rounded-xl border border-gray-200 px-4 py-2 disabled:opacity-40 dark:border-gray-600">Next</button>
      </nav>}
    </div>
  );
};

export default NurseNotifications;
