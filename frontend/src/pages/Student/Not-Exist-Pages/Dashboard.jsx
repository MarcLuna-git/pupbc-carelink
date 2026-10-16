import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, ClipboardList, FileText, Clock, Bell, ChevronRight, Activity, Heart, QrCode, User, AlertCircle, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import api from '../../../services/api';
import { groupAppointments, formatAppointmentDate } from '../../../utils/appointmentDate';

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl ${className}`} />
);

const dashboardCacheKey = 'carelink.student.dashboard';

const Dashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const cachedDashboard = (() => {
    try {
      return JSON.parse(localStorage.getItem(dashboardCacheKey) || 'null');
    } catch {
      return null;
    }
  })();
  const [loading, setLoading] = useState(!cachedDashboard);
  const [healthProfileDone, setHealthProfileDone] = useState(
    user?.profile?.health_profile_completed || false
  );
  const [stats, setStats] = useState(cachedDashboard?.stats || {
    upcomingAppointments: 0,
    clinicVisits: 0,
    medCerts: 0,
    pending: 0,
  });
  const [announcements, setAnnouncements] = useState(cachedDashboard?.announcements || []);
  const [recentNotifications, setRecentNotifications] = useState(cachedDashboard?.recentNotifications || []);
  const [appointments, setAppointments] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { headers: { Authorization: `Bearer ${token}` } };

      const [healthResult, statsResult, appointmentsResult] = await Promise.allSettled([
        api.get('/student/health-profile/status', headers),
        api.get('/student/dashboard-stats', headers),
        api.get('/student/upcoming-appointments', headers),
      ]);
      if (appointmentsResult.status === 'fulfilled' && appointmentsResult.value.data.success) {
        setAppointments(appointmentsResult.value.data.data || []);
      }

      if (healthResult.status === 'fulfilled' && healthResult.value.data.success) {
        const healthDone = healthResult.value.data.data?.completed || healthResult.value.data.data?.exists || false;
        setHealthProfileDone(healthDone);

        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({
          ...currentUser,
          profile: { ...(currentUser.profile || {}), health_profile_completed: healthDone }
        }));
      } else if (healthResult.status === 'rejected') {
        console.log('Health status error:', healthResult.reason);
      }

      if (statsResult.status === 'fulfilled' && statsResult.value.data.success) {
        const data = statsResult.value.data.data;
        const nextStats = {
          upcomingAppointments: data.upcoming_appointments || data.upcomingAppointments || 0,
          clinicVisits: data.clinic_visits || data.clinicVisits || data.total_consultations || data.totalConsultations || 0,
          medCerts: data.medical_certificates || data.medicalCertificates || 0,
          pending: data.pending_appointments || data.pendingAppointments || 0,
        };
        setStats(nextStats);
        localStorage.setItem(dashboardCacheKey, JSON.stringify({
          stats: nextStats,
          announcements,
          recentNotifications,
        }));
      } else {
        console.log('Stats error:', statsResult.reason);
      }

    } catch (err) {
      console.log('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get('/announcements?limit=3', { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.success) {
        const data = response.data.data;
        const items = Array.isArray(data) ? data : (data?.data || []);
        setAnnouncements(items.slice(0, 3).map(a => ({
          title: a.title || 'Announcement',
          date: a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
          content: a.content || a.description || '',
        })));
      }
    } catch (err) { console.log('Announcements error:', err); }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get('/notifications?limit=5', { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.success) {
        const data = response.data.data;
        const items = Array.isArray(data) ? data : (data?.data || []);
        setRecentNotifications(items.slice(0, 5).map(n => ({
          text: n.message || n.text || 'Notification',
          time: n.created_at ? formatTimeAgo(n.created_at) : '',
          type: n.read ? 'info' : 'warning',
        })));
      }
    } catch (err) { console.log('Notifications error:', err); }
  }, []);

  const refreshAll = useCallback(() => { 
    fetchDashboardData(); 
    fetchAnnouncements(); 
    fetchNotifications(); 
  }, [fetchDashboardData, fetchAnnouncements, fetchNotifications]);

  useEffect(() => {
    refreshAll();
    const handleFocus = () => refreshAll();
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(refreshAll, 60000);
    return () => { 
      window.removeEventListener('focus', handleFocus); 
      clearInterval(interval); 
    };
  }, [refreshAll]);

  useEffect(() => {
    const handleHealthUpdate = () => {
      fetchDashboardData();
    };
    window.addEventListener('storage', handleHealthUpdate);
    window.addEventListener('healthProfileUpdated', handleHealthUpdate);
    return () => { 
      window.removeEventListener('storage', handleHealthUpdate); 
      window.removeEventListener('healthProfileUpdated', handleHealthUpdate); 
    };
  }, [fetchDashboardData]);

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return new Date(dateString).toLocaleDateString();
  };

  const summaryCards = [
    { icon: Calendar, title: stats.upcomingAppointments.toString(), sub: 'Upcoming Appointments', color: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400' },
    { icon: ClipboardList, title: stats.clinicVisits.toString(), sub: 'Clinic Visits', color: 'bg-green-50 dark:bg-green-900/20', iconColor: 'text-green-600 dark:text-green-400' },
    { icon: FileText, title: stats.medCerts.toString(), sub: 'Medical Certificates', color: 'bg-purple-50 dark:bg-purple-900/20', iconColor: 'text-purple-600 dark:text-purple-400' },
    { icon: Clock, title: stats.pending.toString(), sub: 'Pending', color: 'bg-orange-50 dark:bg-orange-900/20', iconColor: 'text-orange-600 dark:text-orange-400' },
  ];
  const appointmentGroups = groupAppointments(appointments);

  const quickActions = [
    { icon: Calendar, label: 'Book Appointment', path: '/student/appointments', color: 'from-maroon-800 to-maroon-900', disabled: !healthProfileDone, disabledMsg: 'Complete Health Profile first' },
    { icon: QrCode, label: 'View QR Code', path: '/student/qr', color: 'from-green-500 to-green-600', disabled: !healthProfileDone, disabledMsg: 'Complete Health Profile first' },
    { icon: FileText, label: 'Health Records', path: '/student/health-records', color: 'from-purple-500 to-purple-600' },
    { icon: User, label: 'My Profile', path: '/student/profile', color: 'from-orange-500 to-orange-600' },
  ];

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-5">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-3xl p-4 lg:p-5 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-12" />
                </div>
                <Skeleton className="w-12 h-12 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700">
              <Skeleton className="h-5 w-32 mb-4" />
              <div className="grid grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex flex-col items-center space-y-2">
                    <Skeleton className="w-10 h-10 rounded-2xl" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700">
              <Skeleton className="h-5 w-36 mb-4" />
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-start space-x-3 mb-3">
                  <Skeleton className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700">
              <Skeleton className="h-5 w-20 mb-4" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start space-x-3 mb-3">
                  <Skeleton className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton className="h-28 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-5 pb-6">
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-maroon-800 to-maroon-900 dark:from-maroon-900 dark:to-maroon-950 rounded-3xl p-5 lg:p-6 text-white shadow-xl shadow-maroon-800/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-yellow-200/80 text-sm font-medium">Welcome back,</p>
            <h1 className="text-2xl lg:text-3xl font-extrabold mt-1">{user.first_name}!</h1>
            <p className="text-yellow-100/60 text-sm mt-2">{user.course} - {user.year}{user.section ? ' - ' + user.section : ''}</p>
          </div>
          <div className="hidden sm:block w-16 h-16 lg:w-20 lg:h-20 bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20"></div>
        </div>
        <div className="flex items-center space-x-4 mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center space-x-1.5">
            <Activity className="w-4 h-4 text-yellow-300" />
            <span className="text-xs text-yellow-200/80">Active Student</span>
          </div>
          {healthProfileDone ? (
            <div className="flex items-center space-x-1.5">
              <CheckCircle className="w-4 h-4 text-green-300" />
              <span className="text-xs text-green-200">Health Profile Complete</span>
            </div>
          ) : (
            <Link to="/student/health-profile" className="flex items-center space-x-1.5 bg-yellow-400/20 px-3 py-1 rounded-full hover:bg-yellow-400/30 transition">
              <AlertCircle className="w-4 h-4 text-yellow-300" />
              <span className="text-xs text-yellow-200">Complete Health Profile</span>
              <ArrowRight className="w-3 h-3 text-yellow-300" />
            </Link>
          )}
        </div>
      </motion.div>

      {!healthProfileDone && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-3xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
            <div>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">Health Profile Required</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500">Complete your health profile to unlock appointments & QR code.</p>
            </div>
          </div>
          <Link to="/student/health-profile" className="px-4 py-2 bg-yellow-500 text-white text-sm font-semibold rounded-xl hover:bg-yellow-600 transition flex-shrink-0">
            Complete Now
          </Link>
        </motion.div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-4 lg:p-5 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">{card.sub}</p>
                <p className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-1">{card.title}</p>
              </div>
              <div className={`w-10 h-10 lg:w-12 lg:h-12 ${card.color} rounded-2xl flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 lg:w-6 lg:h-6 ${card.iconColor}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[['today', "Today's Appointments"], ['upcoming', 'Upcoming Appointments']].map(([key, title]) => (
          <section key={key} className="rounded-3xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
            {appointmentGroups[key].length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No {key === 'today' ? 'appointments today' : 'upcoming appointments'}.</p>
            ) : appointmentGroups[key].map((appointment) => (
              <Link key={appointment.id} to="/student/appointments" className="mt-3 block text-sm text-gray-700 dark:text-gray-200">
                <span className="font-semibold">{appointment.service}</span>
                <span className="block">{formatAppointmentDate(appointment.appointment_date)} · {appointment.time_slot} (Philippine time)</span>
              </Link>
            ))}
          </section>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map((action, i) => (
                action.disabled ? (
                  <button key={i} disabled className="flex flex-col items-center space-y-2 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/30 opacity-50 cursor-not-allowed relative group">
                    <div className={`w-10 h-10 bg-gradient-to-br ${action.color} rounded-2xl flex items-center justify-center`}><action.icon className="w-5 h-5 text-white" /></div>
                    <span className="text-xs font-medium text-gray-400 text-center">{action.label}</span>
                    <span className="absolute -top-2 -right-2 bg-yellow-400 text-[10px] font-bold text-yellow-900 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition whitespace-nowrap">{action.disabledMsg}</span>
                  </button>
                ) : (
                  <Link key={i} to={action.path} className="group flex flex-col items-center space-y-2 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className={`w-10 h-10 bg-gradient-to-br ${action.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}><action.icon className="w-5 h-5 text-white" /></div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 text-center">{action.label}</span>
                  </Link>
                )
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Announcements</h3>
              <Link to="/student/announcements" className="text-xs text-maroon-600 dark:text-maroon-400 hover:underline flex items-center space-x-1"><span>View All</span><ChevronRight className="w-3.5 h-3.5" /></Link>
            </div>
            {announcements.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((item, i) => (
                  <div key={i} className="flex items-start space-x-3 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <Bell className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div><p className="text-sm font-semibold text-gray-800 dark:text-white">{item.title}</p><p className="text-xs text-gray-400 mt-0.5">{item.date} — {item.content}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-900 dark:text-white">Recent</h3><Link to="/student/alerts" className="text-xs text-maroon-600 dark:text-maroon-400 hover:underline">View All</Link></div>
            {recentNotifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No notifications yet.</p>
            ) : (
              <div className="space-y-3">
                {recentNotifications.map((item, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${item.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                    <div><p className="text-sm text-gray-700 dark:text-gray-200">{item.text}</p><p className="text-xs text-gray-400 mt-0.5">{item.time}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={`rounded-3xl p-5 border ${healthProfileDone ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/30'}`}>
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center space-x-2"><Heart className={`w-5 h-5 ${healthProfileDone ? 'text-green-600' : 'text-yellow-600'}`} /><span>Health Profile</span></h3>
            {healthProfileDone ? (
              <div className="flex items-center space-x-2 text-sm text-green-700 dark:text-green-400"><CheckCircle className="w-4 h-4" /><span>Completed — All features unlocked!</span></div>
            ) : (
              <Link to="/student/health-profile" className="flex items-center justify-between text-sm text-yellow-700 dark:text-yellow-400 hover:underline"><span>Not yet completed</span><ArrowRight className="w-4 h-4" /></Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;