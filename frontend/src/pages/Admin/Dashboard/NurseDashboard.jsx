import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Clock, ClipboardList, QrCode, FileText, Bell, Activity, Stethoscope, Loader2 } from 'lucide-react';
import api from '../../../services/api';

const NurseDashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
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
  const [notifications, setNotifications] = useState([]);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    fetchDashboardData();
    fetchTodaySchedule();
    fetchNotifications();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await api.get('/nurse/dashboard-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const data = response.data.data;
        setStats({
          todayAppointments: data.today_appointments || data.todayAppointments || 0,
          confirmedAppointments: data.confirmed_appointments || data.confirmedAppointments || 0,
          totalStudents: data.total_students || data.totalStudents || 0,
          pendingApprovals: data.pending_approvals || data.pendingApprovals || 0,
          todayConsultations: data.today_consultations || data.todayConsultations || 0,
          completedConsultations: data.completed_consultations || data.completedConsultations || 0,
        });
      }
    } catch (err) {
      console.log('Dashboard error:', err);
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodaySchedule = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get('/nurse/dashboard/appointments-today', {
        headers: { Authorization: `Bearer ${token}` }
      });
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

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get('/nurse/dashboard/recent-activity', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const data = response.data.data;
        const activities = Array.isArray(data) ? data : (data?.data || []);
        setRecentActivity(activities.slice(0, 5).map(a => ({
          text: a.description || a.text || 'Activity',
          time: formatTimeAgo(a.created_at),
          type: a.type || 'info',
        })));
      }
    } catch (err) {
      console.log('Notifications error:', err);
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await api.get('/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const data = response.data.data;
        const notifs = Array.isArray(data) ? data : (data?.data || []);
        const unread = notifs.filter(n => !n.read).slice(0, 3);
        setNotifications(unread.map(n => n.message || n.text || 'Notification'));
        setNotifCount(notifs.filter(n => !n.read).length);
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const summaryCards = [
    { icon: Calendar, title: "Today's Appointments", value: stats.todayAppointments, sub: `${stats.confirmedAppointments} confirmed`, color: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400' },
    { icon: Users, title: 'Total Students', value: stats.totalStudents, sub: 'Registered students', color: 'bg-green-50 dark:bg-green-900/20', iconColor: 'text-green-600 dark:text-green-400' },
    { icon: Clock, title: 'Pending Approvals', value: stats.pendingApprovals, sub: 'Needs attention', color: 'bg-yellow-50 dark:bg-yellow-900/20', iconColor: 'text-yellow-600 dark:text-yellow-400' },
    { icon: ClipboardList, title: 'Consultations', value: stats.todayConsultations, sub: `${stats.completedConsultations} completed today`, color: 'bg-purple-50 dark:bg-purple-900/20', iconColor: 'text-purple-600 dark:text-purple-400' },
  ];

  const quickActions = [
    { icon: QrCode, label: 'Scan QR', color: 'from-maroon-800 to-maroon-900', path: '/nurse/appointments' },
    { icon: Calendar, label: 'Appointments', color: 'from-green-500 to-green-600', path: '/nurse/appointments' },
    { icon: Users, label: 'Students', color: 'from-purple-500 to-purple-600', path: '/nurse/students' },
    { icon: FileText, label: 'Records', color: 'from-orange-500 to-orange-600', path: '/nurse/records' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-maroon-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-maroon-800 to-maroon-900 dark:from-maroon-900 dark:to-maroon-950 rounded-3xl p-5 lg:p-6 text-white shadow-xl shadow-maroon-800/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-yellow-200/80 text-sm font-medium">{getGreeting()},</p>
            <h1 className="text-2xl lg:text-3xl font-extrabold mt-1">Nurse {user.first_name || 'Head'}!</h1>
            <p className="text-yellow-100/60 text-sm mt-2">PUP Biñan Campus Clinic</p>
          </div>
          <div className="hidden sm:flex w-16 h-16 lg:w-20 lg:h-20 bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 items-center justify-center">
            <Stethoscope className="w-8 h-8 lg:w-10 lg:h-10 text-white" />
          </div>
        </div>
        <div className="flex items-center space-x-4 mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center space-x-1.5">
            <Activity className="w-4 h-4 text-yellow-300" />
            <span className="text-xs text-yellow-200/80">On Duty</span>
          </div>
          {error && <span className="text-xs text-red-300">{error}</span>}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-4 lg:p-5 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">{card.title}</p>
                <p className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              </div>
              <div className={`w-10 h-10 lg:w-12 lg:h-12 ${card.color} rounded-2xl flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 lg:w-6 lg:h-6 ${card.iconColor}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        <div className="lg:col-span-2 space-y-5">
          
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map((action, i) => (
                <div key={i} onClick={() => navigate(action.path)}
                  className="group flex flex-col items-center space-y-2 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                  <div className={`w-10 h-10 bg-gradient-to-br ${action.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300 text-center">{action.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Today's Schedule</h3>
            {todaySchedule.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No appointments for today.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {todaySchedule.map((item, i) => (
                  <div key={i} className="flex items-center space-x-4 py-3 first:pt-0 last:pb-0">
                    <div className="w-16 text-xs font-bold text-gray-500 dark:text-gray-400">{item.time}</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.concern}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      item.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>{item.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <Activity className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
              <span>Recent Activity</span>
            </h3>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No recent activity.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${item.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-200">{item.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                <Bell className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
                <span>Notifications</span>
              </h3>
              {notifCount > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{notifCount}</span>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No new notifications.</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((text, i) => (
                  <div key={i} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="w-1.5 h-1.5 bg-maroon-500 rounded-full flex-shrink-0"></span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};

export default NurseDashboard;