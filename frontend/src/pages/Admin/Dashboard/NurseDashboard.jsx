import { getToken, getUser } from '../../../services/session';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Users, Calendar, Clock, ClipboardList, Activity, CalendarClock, CalendarCheck, CalendarRange, BellRing, ChevronRight } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import { nurseGreeting } from '../../../utils/nurseGreeting';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import ClinicCalendar from './ClinicCalendar';
import { fetchNurseNotifications } from '../../../services/nurseNotifications';
import useNurseSync from '../../../hooks/useNurseSync';

const UPCOMING_ROWS = 3;

const NurseDashboard = () => {
  const user = getUser('nurse');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stats, setStats] = useState({
    todayAppointments: 0,
    confirmedAppointments: 0,
    totalStudents: 0,
    pendingApprovals: 0,
    todayConsultations: 0,
    completedConsultations: 0,
  });
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const requests = useRef({ stats: 0, schedule: 0, activity: 0, notifications: 0 });

  useEffect(() => {
    fetchDashboardData();
    fetchTodaySchedule();
    fetchRecentActivity();
    fetchNotifications();
  }, []);

  useNurseSync(['appointments', 'consultations', 'students', 'queue'], () => Promise.all([
    fetchDashboardData(true), fetchTodaySchedule(), fetchRecentActivity(),
  ]));
  useNurseSync(['notifications', 'medicines'], () => fetchNotifications());

  const fetchDashboardData = async (silent = false) => {
    const request = ++requests.current.stats;
    try {
      if (!silent) setLoading(true);
      const token = getToken('nurse');
      const response = await api.get('/nurse/dashboard-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (request !== requests.current.stats) return;
      if (response.data.success) {
        setError('');
        const data = response.data.data;
        setStats({
          todayAppointments: data.today_appointments || data.todayAppointments || 0,
          confirmedAppointments: data.confirmed_appointments || data.confirmedAppointments || 0,
          totalStudents: data.total_students || data.totalStudents || 0,
          pendingApprovals: data.pending_approvals || data.pendingApprovals || 0,
          todayConsultations: data.today_consultations || data.todayConsultations || 0,
          completedConsultations: data.completed_consultations || data.completedConsultations || 0,
        });
        // Approved visits after today (today's are in Today's Schedule).
        const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
        const nextVisits = Array.isArray(data.upcoming_appointments) ? data.upcoming_appointments : [];
        setUpcoming(nextVisits.filter(a => String(a.appointment_date).slice(0, 10) > todayKey).slice(0, UPCOMING_ROWS));
      }
    } catch (err) {
      console.log('Dashboard error:', err);
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodaySchedule = async () => {
    const request = ++requests.current.schedule;
    try {
      const token = getToken('nurse');
      const response = await api.get('/nurse/dashboard/appointments-today', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (request !== requests.current.schedule) return;
      if (response.data.success) {
        const data = response.data.data;
        const appointments = Array.isArray(data) ? data : (data?.data || []);
        const formatted = appointments.slice(0, 5).map(a => ({
          time: a.time_slot || formatTime(a.appointment_time),
          name: (a.user?.first_name || a.student?.first_name || '') + ' ' + (a.user?.last_name || a.student?.last_name || ''),
          concern: a.reason || a.concern || 'Appointment',
          status: a.status || 'pending',
        }));
        setTodaySchedule(formatted);
      }
    } catch (err) {
      console.log('Schedule error:', err);
    }
  };

  const fetchRecentActivity = async () => {
    const request = ++requests.current.activity;
    try {
      const token = getToken('nurse');
      const response = await api.get('/nurse/dashboard/recent-activity', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (request !== requests.current.activity) return;
      if (response.data.success) {
        const data = response.data.data;
        const activities = Array.isArray(data) ? data : (data?.data || []);
        // One feed of clinic events (bookings, approvals, check-ins, consultations…).
        setRecentActivity(activities.slice(0, 3).map(a => {
          const at = a.occurred_at || a.created_at;
          return {
            id: a.id,
            text: a.title || a.description || a.text || 'Clinic activity',
            detail: a.detail || a.chief_complaint || '',
            time: formatTimeAgo(at),
            exact: at ? new Date(at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '',
            at,
            type: a.tone || 'info',
          };
        }));
      }
    } catch (err) {
      console.log('Recent activity error:', err);
    }
  };

  const fetchNotifications = async () => {
    const request = ++requests.current.notifications;
    try {
      const response = await fetchNurseNotifications();
      if (request !== requests.current.notifications) return;
      if (response.data.success) {
        const data = response.data.data;
        const notifs = Array.isArray(data) ? data : (data?.data || []);
        // The 4 newest notifications, read or not; unread ones are marked.
        setNotifications(notifs.slice(0, 3).map(n => ({
          id: n.id,
          title: n.title || 'Notification',
          message: n.message || n.text || '',
          time: formatTimeAgo(n.created_at),
          read: Boolean(n.read),
        })));
        setNotifCount(Number(response.data.unread_count) || 0);
      }
    } catch (err) {
      console.log('Notifications error:', err);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const summaryCards = [
    { icon: Calendar, title: "Today's Appointments", value: stats.todayAppointments, sub: `${stats.confirmedAppointments} confirmed`, color: 'bg-maroon-50 dark:bg-maroon-900/30', iconColor: 'text-maroon-700 dark:text-maroon-300' },
    { icon: Users, title: 'Total Students', value: stats.totalStudents, sub: 'Registered students', color: 'bg-maroon-50 dark:bg-maroon-900/30', iconColor: 'text-maroon-700 dark:text-maroon-300' },
    { icon: Clock, title: 'Pending Approvals', value: stats.pendingApprovals, sub: 'Needs attention', color: 'bg-maroon-50 dark:bg-maroon-900/30', iconColor: 'text-maroon-700 dark:text-maroon-300' },
    { icon: ClipboardList, title: 'Consultations', value: stats.todayConsultations, sub: `${stats.completedConsultations} completed today`, color: 'bg-maroon-50 dark:bg-maroon-900/30', iconColor: 'text-maroon-700 dark:text-maroon-300' },
  ];


  if (loading) {
    return <NursePageSkeleton variant="dashboard" label="Loading dashboard" />;
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      {/* On tablet and desktop the greeting is in the header; the mobile header shows the brand, so it is here. */}
      <h1 className="text-lg font-bold text-maroon-800 dark:text-maroon-300 md:sr-only">{nurseGreeting(user)}</h1>
      {error && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Clinic totals">
        {summaryCards.map((card) => (
          <div key={card.title} className="flex min-w-0 items-center gap-3 rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:gap-4 sm:p-5">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.color}`}>
              <card.icon className={`h-5 w-5 ${card.iconColor}`} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{card.title}</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{card.value}</p>
              <p className="truncate text-xs text-gray-400">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <ClinicCalendar />

          <NurseListCard
            fill
            aria-label="Today's schedule"
            icon={CalendarClock}
            title={<>Today&apos;s Schedule<CountChip>{todaySchedule.length}</CountChip></>}
            description="Appointments booked for today, earliest time first."
            actions={<Link to="/nurse/appointments" className="inline-flex items-center gap-1 text-sm font-semibold text-maroon-700 hover:text-maroon-900 dark:text-maroon-400">View all <ChevronRight className="h-4 w-4" /></Link>}
          >
            {todaySchedule.length === 0 ? (
              <div className="py-12 text-center">
                <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50">
                  <CalendarCheck className="h-7 w-7 text-gray-300 dark:text-gray-500" />
                </span>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No appointments for today.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {todaySchedule.map((item, i) => (
                  <li key={i} className="flex items-center gap-4 px-4 py-3">
                    <span className="w-20 shrink-0 text-xs font-bold text-gray-500 dark:text-gray-400">{item.time}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">{item.name}</p>
                      <p className="truncate text-xs text-gray-400">{item.concern}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                      item.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>{item.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </NurseListCard>
        </div>

        <div className="flex flex-col gap-5">
          <NurseListCard
            aria-label="Upcoming schedule"
            icon={CalendarRange}
            title={<>Upcoming Schedule<CountChip>{upcoming.length}</CountChip></>}
            description={upcoming.length ? 'Next approved visits after today.' : 'No approved visits after today yet.'}
            actions={<Link to="/nurse/appointments" className="inline-flex items-center gap-1 text-sm font-semibold text-maroon-700 hover:text-maroon-900 dark:text-maroon-400">View all <ChevronRight className="h-4 w-4" /></Link>}
          >
            {(
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {upcoming.map((visit) => {
                  const date = new Date(`${String(visit.appointment_date).slice(0, 10)}T00:00:00`);
                  return (
                    <li key={visit.id}>
                      <Link to="/nurse/appointments" className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-maroon-50 py-1 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-300">
                          <span className="text-xs font-bold uppercase leading-tight">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                          <span className="text-base font-bold leading-tight">{date.getDate()}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{[visit.user?.first_name, visit.user?.last_name].filter(Boolean).join(' ') || 'Student'}</p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{visit.service || 'Clinic visit'}</p>
                          <p className="text-xs text-gray-400">{date.toLocaleDateString('en-US', { weekday: 'short' })} · {visit.time_slot}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
                {/* Empty slots keep the card at a steady size: gray placeholder rows. */}
                {Array.from({ length: UPCOMING_ROWS - upcoming.length }, (_, i) => (
                  <li key={`placeholder-${i}`} className="flex items-center gap-3 px-4 py-2.5" aria-hidden="true">
                    <span className="h-[42px] w-11 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-700/60" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <span className="block h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-700/60" />
                      <span className="block h-2.5 w-1/2 rounded bg-gray-100 dark:bg-gray-700/60" />
                      <span className="block h-2.5 w-1/3 rounded bg-gray-100 dark:bg-gray-700/60" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {upcoming.length === 0 && <p className="sr-only">No upcoming visits.</p>}
          </NurseListCard>

          <NurseListCard
            aria-label="Unread notifications"
            icon={BellRing}
            title={<>Notifications{notifCount > 0 && <span className="min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-xs font-bold leading-4 text-white">{notifCount}</span>}</>}
            description="Latest clinic updates. Unread ones have a dot."
            actions={<Link to="/nurse/notifications" className="inline-flex items-center gap-1 text-sm font-semibold text-maroon-700 hover:text-maroon-900 dark:text-maroon-400">View all <ChevronRight className="h-4 w-4" /></Link>}
          >
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center"><p className="text-sm font-medium text-gray-500 dark:text-gray-400">No notifications yet.</p><p className="mt-1 text-xs text-gray-400">New bookings and clinic alerts will show up here.</p></div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <Link to="/nurse/notifications" className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? 'bg-gray-300 dark:bg-gray-600' : 'bg-maroon-600'}`} aria-label={item.read ? undefined : 'Unread'} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm ${item.read ? 'font-medium text-gray-600 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-white'}`}>{item.title}</p>
                        {item.message && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{item.message}</p>}
                        <p className="mt-0.5 text-xs text-gray-400">{item.time}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </NurseListCard>

          <NurseListCard
            fill
            aria-label="Recent activity"
            icon={Activity}
            title="Recent Activity"
            description="Latest bookings, approvals, and visits."
          >
            {recentActivity.length === 0 ? (
              <div className="px-4 py-10 text-center"><p className="text-sm font-medium text-gray-500 dark:text-gray-400">No recent activity.</p><p className="mt-1 text-xs text-gray-400">Bookings, check-ins, and consultations will show up here.</p></div>
            ) : (
              /* Rows share any spare height so the panel never ends in a blank gap. */
              <ul className="flex flex-1 flex-col divide-y divide-gray-100 dark:divide-gray-700">
                {recentActivity.map((item, i) => (
                  <li key={item.id || i} className="flex flex-1 items-center gap-3 px-4 py-2.5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      { success: 'bg-green-500', warning: 'bg-orange-500', danger: 'bg-red-500' }[item.type] || 'bg-blue-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-gray-800 dark:text-gray-100">{item.text}</p>
                      {item.detail && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{item.detail}</p>}
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        <time dateTime={item.at} title={item.exact}>{item.time}</time>
                        {item.exact && <span>· {item.exact}</span>}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </NurseListCard>
        </div>
      </div>
    </div>
  );
};

export default NurseDashboard;
