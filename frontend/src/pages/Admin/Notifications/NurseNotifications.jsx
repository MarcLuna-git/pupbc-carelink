import { useState, useEffect } from 'react';
import { Bell, Calendar, Loader2, CheckCheck } from 'lucide-react';
import api from '../../../services/api';

const NurseNotifications = () => {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const response = await api.get('/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const data = response.data.data;
        const notifications = Array.isArray(data) ? data : (data?.data || []);
        const formatted = notifications.map(n => ({
          id: n.id,
          title: n.title || n.type || 'Notification',
          message: n.message || n.text || n.description || '',
          time: formatTimeAgo(n.created_at),
          read: n.read || false,
          type: n.type || 'info',
        }));
        setNotifs(formatted);
      }
    } catch (err) {
      console.log('Notifications error:', err);
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await api.patch(`/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.log('Mark read error:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await api.patch('/notifications/read-all', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-maroon-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="flex items-center space-x-1.5 text-xs font-semibold text-maroon-600 dark:text-maroon-400 hover:text-maroon-800 dark:hover:text-maroon-300 bg-maroon-50 dark:bg-maroon-900/20 px-3 py-1.5 rounded-xl transition"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl text-sm text-center">{error}</div>
      )}

      {notifs.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500">No Notifications</h3>
          <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => (
            <div 
              key={n.id} 
              onClick={() => !n.read && markAsRead(n.id)}
              className={`bg-white dark:bg-gray-800 rounded-2xl border p-4 cursor-pointer transition hover:shadow-md ${
                !n.read 
                  ? 'border-l-4 border-l-maroon-800 bg-maroon-50/30 dark:bg-maroon-900/10' 
                  : 'border-gray-100 dark:border-gray-700 opacity-75'
              }`}>
              <div className="flex items-start space-x-3">
                <Bell className={`w-5 h-5 mt-0.5 flex-shrink-0 ${n.read ? 'text-gray-400' : 'text-maroon-800 dark:text-maroon-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm ${n.read ? 'font-medium text-gray-500 dark:text-gray-400' : 'font-bold text-gray-900 dark:text-white'}`}>
                      {n.title}
                    </h3>
                    {!n.read && (
                      <span className="w-2 h-2 bg-maroon-600 rounded-full flex-shrink-0 ml-2"></span>
                    )}
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
    </div>
  );
};

export default NurseNotifications;