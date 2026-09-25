import {
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Megaphone,
  Check,
  Trash2,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  Heart,
  GraduationCap,
  Siren,
  Loader2,
  RefreshCw,
  Stethoscope,
} from 'lucide-react';
import api from '../../../services/api';

const Skeleton = ({ className = '' }) => (
  <div
    className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl ${className}`}
  />
);

const normalizeNotificationType = (type) => {
  const value = String(type || '')
    .trim()
    .toLowerCase();

  if (
    value === 'appointment_approved' ||
    value === 'approved'
  ) {
    return 'success';
  }

  if (
    value === 'appointment_rejected' ||
    value === 'rejected' ||
    value === 'error'
  ) {
    return 'error';
  }

  if (
    value === 'appointment_pending' ||
    value === 'appointment_rescheduled' ||
    value === 'reminder'
  ) {
    return 'reminder';
  }

  if (
    value === 'consultation_completed' ||
    value === 'consultation'
  ) {
    return 'consultation';
  }

  if (
    value.startsWith('appointment_')
  ) {
    return 'appointment';
  }

  if (
    value === 'warning' ||
    value === 'info' ||
    value === 'success'
  ) {
    return value;
  }

  return 'info';
};

const getNotificationLink = (
  notification
) => {
  if (notification?.link) {
    return notification.link;
  }

  if (notification?.data?.link) {
    return notification.data.link;
  }

  const type = String(
    notification?.type || ''
  ).toLowerCase();

  if (
    type.startsWith(
      'appointment_'
    )
  ) {
    return '/student/appointments';
  }

  if (
    type ===
    'consultation_completed'
  ) {
    return '/student/health-records';
  }

  return null;
};

const formatDate = (dateStr) => {
  if (!dateStr) {
    return '';
  }

  const date = new Date(dateStr);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  const now = new Date();

  const diffMs =
    now.getTime() -
    date.getTime();

  const diffMins =
    Math.floor(
      diffMs / 60000
    );

  if (diffMins < 1) {
    return 'Just now';
  }

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  const diffHrs =
    Math.floor(
      diffMins / 60
    );

  if (diffHrs < 24) {
    return `${diffHrs}h ago`;
  }

  const diffDays =
    Math.floor(
      diffHrs / 24
    );

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString(
    'en-PH',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );
};

const Alerts = () => {
  const navigate = useNavigate();

  const [tab, setTab] =
    useState('notifications');

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    announcements,
    setAnnouncements,
  ] = useState([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    markingAll,
    setMarkingAll,
  ] = useState(false);

  const [
    deletingId,
    setDeletingId,
  ] = useState(null);

  const [
    markingId,
    setMarkingId,
  ] = useState(null);

  const [error, setError] =
    useState('');

  const emitUnreadUpdate =
    useCallback((count) => {
      window.dispatchEvent(
        new CustomEvent(
          'carelink:notifications-updated',
          {
            detail: {
              unreadCount:
                Math.max(
                  0,
                  Number(count) || 0
                ),
            },
          }
        )
      );
    }, []);

  const normalizeNotifications =
    useCallback((items) => {
      return items.map(
        (notification) => ({
          id: notification.id,

          title:
            notification.title ||
            notification.type ||
            'Notification',

          message:
            notification.message ||
            notification.text ||
            notification.description ||
            '',

          type:
            notification.type ||
            'info',

          displayType:
            normalizeNotificationType(
              notification.type
            ),

          date:
            notification.created_at ||
            new Date().toISOString(),

          read:
            Boolean(
              notification.read
            ),

          readAt:
            notification.read_at ||
            null,

          data:
            notification.data &&
            typeof notification.data ===
              'object'
              ? notification.data
              : {},

          link:
            getNotificationLink(
              notification
            ),
        })
      );
    }, []);

  const fetchAll =
    useCallback(
      async (
        silent = false
      ) => {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        try {
          setError('');

          const token =
            localStorage.getItem(
              'token'
            );

          const headers = {
            Authorization:
              `Bearer ${token}`,
          };

          const [
            notifRes,
            announceRes,
          ] = await Promise.all([
            api.get(
              '/student/notifications?limit=50',
              {
                headers,
              }
            ),

            api.get(
              '/announcements?limit=20',
              {
                headers,
              }
            ),
          ]);

          if (
            notifRes.data.success
          ) {
            const payload =
              notifRes.data.data;

            const items =
              Array.isArray(payload)
                ? payload
                : Array.isArray(
                    payload?.data
                  )
                  ? payload.data
                  : [];

            setNotifications(
              normalizeNotifications(
                items
              )
            );

            const serverUnread =
              Number(
                notifRes.data
                  .unread_count
              ) || 0;

            setUnreadCount(
              serverUnread
            );

            emitUnreadUpdate(
              serverUnread
            );
          }

          if (
            announceRes.data.success
          ) {
            const payload =
              announceRes.data.data;

            const items =
              Array.isArray(payload)
                ? payload
                : Array.isArray(
                    payload?.data
                  )
                  ? payload.data
                  : [];

            setAnnouncements(
              items.map(
                (
                  announcement
                ) => ({
                  id:
                    announcement.id,

                  title:
                    announcement.title ||
                    'Announcement',

                  content:
                    announcement.content ||
                    announcement.description ||
                    '',

                  category:
                    announcement.category ||
                    'General',

                  date:
                    announcement.created_at ||
                    new Date()
                      .toISOString(),
                })
              )
            );
          }
        } catch (err) {
          console.error(
            'Alerts error:',
            err
          );

          if (!silent) {
            setError(
              err?.response?.data
                ?.message ||
                'Failed to load alerts.'
            );
          }
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        emitUnreadUpdate,
        normalizeNotifications,
      ]
    );

  useEffect(() => {
    fetchAll();

    const interval =
      setInterval(() => {
        fetchAll(true);
      }, 30000);

    return () => {
      clearInterval(
        interval
      );
    };
  }, [fetchAll]);

  const markNotificationRead =
    async (id) => {
      const notification =
        notifications.find(
          (item) =>
            item.id === id
        );

      if (
        !notification ||
        notification.read
      ) {
        return true;
      }

      setMarkingId(id);

      try {
        const token =
          localStorage.getItem(
            'token'
          );

        await api.patch(
          `/student/notifications/${id}/read`,
          {},
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        setNotifications(
          (previous) =>
            previous.map(
              (item) =>
                item.id === id
                  ? {
                      ...item,
                      read: true,
                      readAt:
                        new Date()
                          .toISOString(),
                    }
                  : item
            )
        );

        setUnreadCount(
          (previous) => {
            const next =
              Math.max(
                0,
                previous - 1
              );

            emitUnreadUpdate(
              next
            );

            return next;
          }
        );

        return true;
      } catch (err) {
        console.error(
          'Mark notification read error:',
          err
        );

        setError(
          err?.response?.data
            ?.message ||
            'Unable to mark notification as read.'
        );

        return false;
      } finally {
        setMarkingId(null);
      }
    };

  const handleNotificationClick =
    async (notification) => {
      if (
        !notification.read
      ) {
        await markNotificationRead(
          notification.id
        );
      }

      if (notification.link) {
        navigate(
          notification.link
        );
      }
    };

  const markAsRead = async (
    id,
    event
  ) => {
    event.stopPropagation();

    await markNotificationRead(
      id
    );
  };

  const markAllRead =
    async () => {
      if (
        unreadCount === 0 ||
        markingAll
      ) {
        return;
      }

      setMarkingAll(true);

      try {
        setError('');

        const token =
          localStorage.getItem(
            'token'
          );

        await api.patch(
          '/student/notifications/read-all',
          {},
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        setNotifications(
          (previous) =>
            previous.map(
              (notification) => ({
                ...notification,
                read: true,
                readAt:
                  notification.readAt ||
                  new Date()
                    .toISOString(),
              })
            )
        );

        setUnreadCount(0);

        emitUnreadUpdate(0);
      } catch (err) {
        console.error(
          'Mark all notifications error:',
          err
        );

        setError(
          err?.response?.data
            ?.message ||
            'Unable to mark all notifications as read.'
        );
      } finally {
        setMarkingAll(false);
      }
    };

  const deleteNotif = async (
    id,
    event
  ) => {
    event.stopPropagation();

    if (deletingId) {
      return;
    }

    setDeletingId(id);

    try {
      setError('');

      const token =
        localStorage.getItem(
          'token'
        );

      const response =
        await api.delete(
          `/student/notifications/${id}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      setNotifications(
        (previous) =>
          previous.filter(
            (notification) =>
              notification.id !==
              id
          )
      );

      const serverUnread =
        response?.data
          ?.unread_count;

      if (
        serverUnread !==
          undefined &&
        serverUnread !== null
      ) {
        const next =
          Math.max(
            0,
            Number(
              serverUnread
            ) || 0
          );

        setUnreadCount(next);

        emitUnreadUpdate(
          next
        );
      } else {
        const deleted =
          notifications.find(
            (notification) =>
              notification.id ===
              id
          );

        if (
          deleted &&
          !deleted.read
        ) {
          setUnreadCount(
            (previous) => {
              const next =
                Math.max(
                  0,
                  previous - 1
                );

              emitUnreadUpdate(
                next
              );

              return next;
            }
          );
        }
      }
    } catch (err) {
      console.error(
        'Delete notification error:',
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          'Unable to delete notification.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const typeIcons = {
    success: (
      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
    ),

    info: (
      <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
    ),

    warning: (
      <Clock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
    ),

    error: (
      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
    ),

    reminder: (
      <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
    ),

    appointment: (
      <Calendar className="w-4 h-4 text-green-500 flex-shrink-0" />
    ),

    consultation: (
      <Stethoscope className="w-4 h-4 text-blue-500 flex-shrink-0" />
    ),
  };

  const categoryIcons = {
    'Clinic Advisory': (
      <Heart className="w-4 h-4 text-blue-500 flex-shrink-0" />
    ),

    'Health Advisory': (
      <Heart className="w-4 h-4 text-green-500 flex-shrink-0" />
    ),

    'School Events': (
      <GraduationCap className="w-4 h-4 text-purple-500 flex-shrink-0" />
    ),

    Emergency: (
      <Siren className="w-4 h-4 text-red-500 flex-shrink-0" />
    ),

    General: (
      <Megaphone className="w-4 h-4 text-gray-500 flex-shrink-0" />
    ),
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-20 mb-1.5" />
            <Skeleton className="h-4 w-32" />
          </div>

          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>

        <div className="space-y-3">
          {[1, 2, 3, 4].map(
            (item) => (
              <div
                key={item}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4"
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />

                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-5 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Alerts
          </h1>

          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {tab ===
            'notifications'
              ? `${unreadCount} unread notification${
                  unreadCount !== 1
                    ? 's'
                    : ''
                }`
              : `${announcements.length} announcement${
                  announcements.length !==
                  1
                    ? 's'
                    : ''
                }`}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            fetchAll(true)
          }
          disabled={refreshing}
          className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-400 disabled:opacity-50"
          title="Refresh alerts"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400 rounded-2xl text-sm text-center">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            setTab(
              'notifications'
            )
          }
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            tab ===
            'notifications'
              ? 'bg-maroon-800 text-white shadow-md'
              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
          }`}
        >
          <Bell className="w-4 h-4" />

          <span>
            Notifications
            {unreadCount > 0 &&
              ` (${unreadCount})`}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setTab(
              'announcements'
            )
          }
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            tab ===
            'announcements'
              ? 'bg-maroon-800 text-white shadow-md'
              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
          }`}
        >
          <Megaphone className="w-4 h-4" />

          <span>
            Announcements
          </span>
        </button>
      </div>

      {tab ===
        'notifications' && (
        <div className="space-y-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={
                markAllRead
              }
              disabled={
                markingAll
              }
              className="w-full py-2.5 bg-maroon-50 dark:bg-maroon-900/10 text-maroon-700 dark:text-maroon-400 rounded-2xl text-sm font-semibold hover:bg-maroon-100 dark:hover:bg-maroon-900/20 transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {markingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}

              <span>
                {markingAll
                  ? 'Updating...'
                  : 'Mark All as Read'}
              </span>
            </button>
          )}

          {notifications.length ===
          0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-10 text-center">
              <Bell className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />

              <p className="text-gray-500 dark:text-gray-400 font-medium">
                No notifications
              </p>

              <p className="text-sm text-gray-400 mt-1">
                You're all caught up!
              </p>
            </div>
          ) : (
            notifications.map(
              (notification) => (
                <div
                  key={
                    notification.id
                  }
                  className={`w-full bg-white dark:bg-gray-800 rounded-2xl border transition hover:shadow-md ${
                    !notification.read
                      ? 'border-l-4 border-l-maroon-800 border-y-gray-100 border-r-gray-100 dark:border-y-gray-700 dark:border-r-gray-700 bg-maroon-50/30 dark:bg-maroon-900/10'
                      : 'border-gray-100 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-2 p-4">
                    <button
                      type="button"
                      onClick={() =>
                        handleNotificationClick(
                          notification
                        )
                      }
                      className="flex flex-1 min-w-0 items-start space-x-3 text-left"
                    >
                      <div className="mt-0.5">
                        {typeIcons[
                          notification
                            .displayType
                        ] || (
                          <Bell className="w-4 h-4 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3
                            className={`text-sm ${
                              notification.read
                                ? 'font-medium text-gray-700 dark:text-gray-300'
                                : 'font-bold text-gray-900 dark:text-white'
                            }`}
                          >
                            {
                              notification.title
                            }
                          </h3>

                          {!notification.read && (
                            <span className="w-2 h-2 bg-maroon-600 rounded-full flex-shrink-0" />
                          )}
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {
                            notification.message
                          }
                        </p>

                        <p className="text-xs text-gray-400 mt-1.5">
                          {formatDate(
                            notification.date
                          )}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {!notification.read && (
                        <button
                          type="button"
                          onClick={(
                            event
                          ) =>
                            markAsRead(
                              notification.id,
                              event
                            )
                          }
                          disabled={
                            markingId ===
                            notification.id
                          }
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-500 disabled:opacity-50"
                          title="Mark as read"
                        >
                          {markingId ===
                          notification.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(
                          event
                        ) =>
                          deleteNotif(
                            notification.id,
                            event
                          )
                        }
                        disabled={
                          deletingId ===
                          notification.id
                        }
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 disabled:opacity-50"
                        title="Delete notification"
                      >
                        {deletingId ===
                        notification.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            )
          )}
        </div>
      )}

      {tab ===
        'announcements' && (
        <div className="space-y-3">
          {announcements.length ===
          0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-10 text-center">
              <Megaphone className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />

              <p className="text-gray-500 dark:text-gray-400 font-medium">
                No announcements
              </p>
            </div>
          ) : (
            announcements.map(
              (
                announcement
              ) => (
                <div
                  key={
                    announcement.id
                  }
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {categoryIcons[
                        announcement
                          .category
                      ] || (
                        <Megaphone className="w-4 h-4 text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        {
                          announcement.title
                        }
                      </h3>

                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-3">
                        {
                          announcement.content
                        }
                      </p>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs text-gray-400">
                          {formatDate(
                            announcement.date
                          )}
                        </span>

                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400">
                          {
                            announcement.category
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )
          )}
        </div>
      )}
    </div>
  );
};

export default Alerts;