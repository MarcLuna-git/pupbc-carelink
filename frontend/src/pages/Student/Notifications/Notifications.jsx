import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Trash2, Calendar, Clock, CheckCircle, XCircle, Info, Loader2 } from 'lucide-react';
import api from '../../../services/api';

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl ${className}`} />
);

const Notifications = () => {
  // Do not cache medical/appointment notifications in localStorage: another
  // student could sign in on the same browser and see the previous account's data.
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get('/student/notifications?limit=50', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (response.data.success) {
        const data = response.data.data;
        const items = Array.isArray(data) ? data : (data?.data || []);
        const normalized = items.map(n => ({
          id: n.id,
          title: n.title || 'Notification',
          message: n.message || n.text || '',
          type: n.type || getTypeFromStatus(n),
          date: n.created_at || new Date().toISOString(),
          read: n.read || false,
        }));
        setNotifications(normalized);
      }
    } catch (err) {
      console.log('Notifications error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);
    return () => { 
      clearInterval(interval); 
      window.removeEventListener('focus', handleFocus); 
    };
  }, [fetchNotifications]);

  const getTypeFromStatus = (n) => {
    const msg = (n.message || n.title || '').toLowerCase();
    if (msg.includes('approved') || msg.includes('completed')) return 'success';
    if (msg.includes('rejected') || msg.includes('cancelled')) return 'error';
    if (msg.includes('reminder') || msg.includes('pending')) return 'warning';
    return 'info';
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const typeConfig = {
    success: { icon: CheckCircle, bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/20', iconColor: 'text-green-500', dot: 'bg-green-500' },
    info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/20', iconColor: 'text-blue-500', dot: 'bg-blue-500' },
    warning: { icon: Clock, bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/20', iconColor: 'text-yellow-500', dot: 'bg-yellow-500' },
    error: { icon: XCircle, bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/20', iconColor: 'text-red-500', dot: 'bg-red-500' },
  };

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : filter === 'unread' ? notifications.filter(n => !n.read) : notifications.filter(n => n.read);

  const markAsRead = async (id) => {
    setActionLoading(id);
    try {
      const token = localStorage.getItem('token');
      await api.patch(`/student/notifications/${id}/read`, {}, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setNotifications(current => current.map(n => n.id === id ? { ...n, read: true } : n));
      showMessage('Marked as read');
    } catch (err) {
      console.error('Mark notification read error:', err);
      showMessage('Could not update the notification. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const markAllAsRead = async () => {
    setActionLoading('all');
    try {
      const token = localStorage.getItem('token');
      await api.patch('/student/notifications/read-all', {}, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setNotifications(current => current.map(n => ({ ...n, read: true })));
      showMessage('All marked as read');
    } catch (err) {
      console.error('Mark all notifications error:', err);
      showMessage('Could not mark all notifications as read.');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteNotification = async (id) => {
    setActionLoading(id);
    try {
      // Persist removal on the backend; otherwise polling restores deleted items.
      await api.delete(`/student/notifications/${id}`);
      setNotifications(current => current.filter(n => n.id !== id));
      showMessage('Notification deleted');
    } catch (err) {
      console.error('Delete notification error:', err);
      showMessage('Could not delete the notification. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-7 w-36 mb-1.5" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-20 rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5 pb-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up! 🎉'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead} 
            disabled={actionLoading === 'all'}
            className="flex items-center justify-center gap-2 bg-maroon-800 text-white px-4 py-2.5 rounded-xl hover:bg-maroon-900 transition font-semibold text-xs sm:text-sm disabled:opacity-50">
            {actionLoading === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-2xl text-sm font-medium text-center border border-green-200 dark:border-green-800/20">
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All', count: notifications.length },
          { key: 'unread', label: 'Unread', count: unreadCount },
          { key: 'read', label: 'Read', count: notifications.length - unreadCount },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all flex-shrink-0 ${
              filter === f.key 
                ? 'bg-maroon-800 text-white shadow-md' 
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}>
            {f.label}
            <span className="ml-1.5 text-[10px] opacity-75">({f.count})</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 py-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">No notifications</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {filter === 'unread' ? 'All caught up!' : filter === 'read' ? 'No read notifications yet.' : 'You\'re all clear!'}
            </p>
          </div>
        ) : (
          filteredNotifications.map(notif => {
            const config = typeConfig[notif.type] || typeConfig.info;
            const TypeIcon = config.icon;
            return (
              <motion.div key={notif.id} layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`bg-white dark:bg-gray-800 rounded-2xl border p-4 sm:p-5 hover:shadow-md transition-all ${
                  notif.read 
                    ? 'border-gray-100 dark:border-gray-700/50' 
                    : 'border-l-4 border-l-maroon-800 dark:border-l-maroon-500 bg-maroon-50/20 dark:bg-maroon-900/5'
                }`}>
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <TypeIcon className={`w-5 h-5 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {!notif.read && (
                            <span className={`w-2 h-2 ${config.dot} rounded-full flex-shrink-0`} />
                          )}
                          <h3 className={`text-sm truncate ${notif.read ? 'font-medium text-gray-700 dark:text-gray-300' : 'font-bold text-gray-900 dark:text-white'}`}>
                            {notif.title}
                          </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(notif.date)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notif.read && (
                          <button 
                            onClick={() => markAsRead(notif.id)}
                            disabled={actionLoading === notif.id}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-500 transition"
                            title="Mark as read">
                            {actionLoading === notif.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button 
                          onClick={() => deleteNotification(notif.id)}
                          disabled={actionLoading === notif.id}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition"
                          title="Delete">
                          {actionLoading === notif.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default Notifications;