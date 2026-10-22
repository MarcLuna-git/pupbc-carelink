import { getToken } from '../../../services/session';
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
  Stethoscope,
  BellDot,
  CheckCheck,
} from 'lucide-react';
import api from '../../../services/api';
import { StudentToast } from '../../../components/StudentFeedback';
import StudentPageHero from '../../../components/StudentPageHero';

const CARD = 'rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface)]';

const ALERTS_HERO = {
  id: 'alerts-title',
  title: 'Alerts',
  art: Bell,
  description: 'Your clinic notifications and announcements in one inbox.',
  benefits: [
    { icon: Bell, label: 'Appointment and visit updates' },
    { icon: Megaphone, label: 'Clinic advisories and news' },
    { icon: CheckCheck, label: 'Stay on top of what needs you' },
  ],
};

// Stacked and compact on phones (three across), side-by-side icon + text from sm up
const StatCard = ({ icon: Icon, label, value, hint }) => (
  <div className={`${CARD} flex flex-col items-center gap-2 p-3 text-center sm:flex-row sm:gap-4 sm:p-4 sm:text-left lg:p-5`}>
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300 sm:h-12 sm:w-12">
      <Icon className="h-[18px] w-[18px] sm:h-6 sm:w-6" />
    </div>
    <div className="min-w-0 max-w-full">
      <p className="truncate text-[11px] font-medium text-gray-700 dark:text-gray-300 sm:text-sm">{label}</p>
      <p className="truncate text-xl font-bold text-maroon-800 dark:text-maroon-300 sm:text-2xl">{value}</p>
      <p className="hidden truncate text-xs text-gray-500 dark:text-gray-400 sm:block">{hint}</p>
    </div>
  </div>
);

const EmptyState = ({ icon: Icon, title, text }) => (
  <div className="rounded-xl border border-dashed border-[var(--sp-border)] py-14 text-center">
    <Icon className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
    <h3 className="font-semibold text-gray-600 dark:text-gray-300">{title}</h3>
    <p className="mx-auto mt-1 max-w-xs text-sm text-gray-400">{text}</p>
  </div>
);

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
  const [actionError, setActionError] = useState('');
  const [notifFilter, setNotifFilter] = useState('all');

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
            getToken('student');

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
          getToken('student');

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

        setActionError(
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
          getToken('student');

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

        setActionError(
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
        getToken('student');

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

      setActionError(
        err?.response?.data
          ?.message ||
          'Unable to delete notification.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  /* Icon + tile colour per notification type / announcement category */
  const typeStyles = {
    success: { icon: CheckCircle, tile: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
    info: { icon: AlertCircle, tile: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    warning: { icon: Clock, tile: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
    error: { icon: XCircle, tile: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
    reminder: { icon: Clock, tile: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
    appointment: { icon: Calendar, tile: 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300' },
    consultation: { icon: Stethoscope, tile: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  };

  const categoryStyles = {
    'Clinic Advisory': { icon: Heart, tile: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    'Health Advisory': { icon: Heart, tile: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
    'School Events': { icon: GraduationCap, tile: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
    Emergency: { icon: Siren, tile: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
    General: { icon: Megaphone, tile: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  };

  const visibleNotifications = notifFilter === 'unread'
    ? notifications.filter((notification) => !notification.read)
    : notifications;

  // Split into "Today" and "Earlier" so the inbox reads like a timeline
  const todayKey = new Date().toDateString();
  const notificationGroups = [
    { label: 'Today', items: visibleNotifications.filter((n) => new Date(n.date).toDateString() === todayKey) },
    { label: 'Earlier', items: visibleNotifications.filter((n) => new Date(n.date).toDateString() !== todayKey) },
  ].filter((group) => group.items.length > 0);

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-3">
        <StudentPageHero {...ALERTS_HERO} loading />

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className={`${CARD} flex flex-col items-center gap-2 p-3 sm:flex-row sm:gap-4 sm:p-4 lg:p-5`}>
              <Skeleton className="h-9 w-9 shrink-0 rounded-xl sm:h-12 sm:w-12" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-28 max-w-full" />
                <Skeleton className="h-6 w-12" />
              </div>
            </div>
          ))}
        </div>

        <div className={`${CARD} space-y-4 p-4 lg:p-6`}>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-40 rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-xl" />
          </div>
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      <StudentPageHero {...ALERTS_HERO} />

      <StudentToast message={actionError} type="error" onClose={() => setActionError('')} />

      {error && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400 sm:flex-row">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchAll(true)}
            className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 font-semibold hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary */}
      <section aria-label="Alerts summary" className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={BellDot} label="Unread" value={unreadCount} hint={unreadCount ? 'Waiting for you' : "You're all caught up"} />
        <StatCard icon={Bell} label="Notifications" value={notifications.length} hint="Appointments and visits" />
        <StatCard icon={Megaphone} label="Announcements" value={announcements.length} hint="From the clinic" />
      </section>

      {/* Inbox */}
      <div className={`${CARD} p-4 lg:p-6`}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div role="tablist" aria-label="Alert type" className="grid grid-cols-2 gap-2 sm:flex">
            {[
              { id: 'notifications', label: 'Notifications', icon: Bell, count: unreadCount },
              { id: 'announcements', label: 'Announcements', icon: Megaphone, count: announcements.length },
            ].map(({ id, label, icon: Icon, count }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:inline-flex sm:w-auto sm:px-4 ${
                    active
                      ? 'border-maroon-800 bg-maroon-800 text-white'
                      : 'border-[var(--sp-border)] text-gray-700 hover:bg-maroon-50 dark:text-gray-300 dark:hover:bg-maroon-900/20'
                  }`}
                >
                  <Icon className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="truncate text-[13px] sm:text-sm">{label}</span>
                  <span className={`rounded-full px-1.5 text-[11px] ${active ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {tab === 'notifications' && (
            <div className="flex items-center gap-2 lg:ml-auto">
              <div className="inline-flex flex-1 rounded-xl border border-[var(--sp-border)] p-1 sm:flex-none" role="group" aria-label="Show">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'unread', label: 'Unread' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={notifFilter === id}
                    onClick={() => setNotifFilter(id)}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:flex-none ${
                      notifFilter === id
                        ? 'bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={markingAll}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--sp-border)] px-3 py-2 text-[13px] font-semibold sm:px-4 sm:text-sm text-maroon-800 transition hover:bg-maroon-50 disabled:opacity-60 dark:text-maroon-300 dark:hover:bg-maroon-900/20"
                >
                  {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                  {markingAll ? 'Updating...' : 'Mark all read'}
                </button>
              )}
            </div>
          )}
        </div>

        {tab === 'notifications' && (
          visibleNotifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={notifFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              text={notifFilter === 'unread' ? "You're all caught up." : 'Updates about your appointments and visits will show up here.'}
            />
          ) : (
            <div className="space-y-5">
              {notificationGroups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[1.2px] text-gray-500 dark:text-gray-400">{group.label}</h3>
                  <ul className="divide-y divide-[var(--sp-border)] overflow-hidden rounded-xl border border-[var(--sp-border)]">
                    {group.items.map((notification) => {
                      const style = typeStyles[notification.displayType] || typeStyles.info;
                      const Icon = style.icon;
                      return (
                        <li
                          key={notification.id}
                          className={`flex items-start gap-3 p-3.5 transition sm:p-4 ${
                            notification.read ? 'hover:bg-gray-50 dark:hover:bg-gray-800/60' : 'bg-maroon-50/40 hover:bg-maroon-50/70 dark:bg-maroon-900/10 dark:hover:bg-maroon-900/20'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          >
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.tile}`}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className={`truncate text-sm ${notification.read ? 'font-medium text-gray-700 dark:text-gray-300' : 'font-bold text-gray-900 dark:text-white'}`}>
                                  {notification.title}
                                </span>
                                {!notification.read && <span className="h-2 w-2 shrink-0 rounded-full bg-maroon-600" aria-label="Unread" />}
                              </span>
                              <span className="mt-0.5 line-clamp-2 block text-xs text-gray-600 dark:text-gray-400 sm:text-[13px]">{notification.message}</span>
                              <span className="mt-1.5 block text-[11px] text-gray-400">{formatDate(notification.date)}</span>
                            </span>
                          </button>

                          <div className="flex shrink-0 items-center gap-1">
                            {!notification.read && (
                              <button
                                type="button"
                                onClick={(event) => markAsRead(notification.id, event)}
                                disabled={markingId === notification.id}
                                className="rounded-lg p-2 text-gray-400 transition hover:bg-white hover:text-green-600 disabled:opacity-50 dark:hover:bg-gray-700"
                                aria-label="Mark as read"
                                title="Mark as read"
                              >
                                {markingId === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(event) => deleteNotif(notification.id, event)}
                              disabled={deletingId === notification.id}
                              className="rounded-lg p-2 text-gray-400 transition hover:bg-white hover:text-red-600 disabled:opacity-50 dark:hover:bg-gray-700"
                              aria-label="Delete notification"
                              title="Delete notification"
                            >
                              {deletingId === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )
        )}

        {tab === 'announcements' && (
          announcements.length === 0 ? (
            <EmptyState icon={Megaphone} title="No announcements" text="Clinic advisories and campus health news will show up here." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {announcements.map((announcement) => {
                const style = categoryStyles[announcement.category] || categoryStyles.General;
                const Icon = style.icon;
                return (
                  <article key={announcement.id} className="flex flex-col rounded-xl border border-[var(--sp-border)] p-4 transition hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.tile}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.tile}`}>{announcement.category || 'General'}</span>
                        <h3 className="mt-1.5 text-sm font-bold text-gray-900 dark:text-white">{announcement.title}</h3>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-line text-[13px] leading-relaxed text-gray-600 dark:text-gray-400">{announcement.content}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
                      <Clock className="h-3.5 w-3.5" /> {formatDate(announcement.date)}
                    </p>
                  </article>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Alerts;