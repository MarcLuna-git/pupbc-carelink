import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Bell, FileText, Megaphone, Settings, Moon, Sun, HelpCircle, Info, LogOut, ChevronRight, Heart, Shield } from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
    if (newMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    window.dispatchEvent(new Event('darkModeChange'));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuSections = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Personal Information', desc: 'Name, ID, course, birthday, mobile', path: '/student/profile/edit' },
        { icon: Heart, label: 'Medical & Emergency', desc: 'Guardian, emergency contacts, address', path: '/student/profile/edit' },
      ],
    },
    {
      title: 'Content',
      items: [
        { icon: Bell, label: 'Notifications', desc: 'Appointment alerts & reminders', path: '/student/notifications' },
        { icon: FileText, label: 'Health Records', desc: 'Consultation history & diagnoses', path: '/student/health-records' },
        { icon: Megaphone, label: 'Announcements', desc: 'Clinic & school updates', path: '/student/announcements' },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { icon: Settings, label: 'Settings', desc: 'Password, email, notifications', path: '/student/settings' },
        { icon: darkMode ? Sun : Moon, label: 'Dark Mode', desc: darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode', action: toggleDarkMode, isToggle: true },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: HelpCircle, label: 'Help & Support', desc: 'FAQs, contact clinic', path: '/student/help' },
        { icon: Info, label: 'About', desc: 'App version, terms, privacy', path: '/student/about' },
      ],
    },
  ];

  return (
    <div className="space-y-5 max-w-2xl mx-auto animate-fadeInUp">
      
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-gradient-to-br from-maroon-800 to-maroon-900 rounded-2xl flex items-center justify-center shadow-lg shadow-maroon-800/20">
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{user.first_name} {user.last_name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.student_id}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{user.course} - {user.year}{user.section}</p>
          </div>
        </div>
      </div>

      {menuSections.map((section, i) => (
        <div key={i} className="space-y-1">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2">{section.title}</p>
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            {section.items.map((item, j) => (
              item.isToggle ? (
                <button key={j} onClick={item.action}
                  className="w-full flex items-center space-x-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-b-0">
                  <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <item.icon className="w-4.5 h-4.5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                  <div className={`relative w-11 h-6 rounded-full transition-colors ${darkMode ? 'bg-maroon-800' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`}></div>
                  </div>
                </button>
              ) : (
                <Link key={j} to={item.path}
                  className="flex items-center space-x-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-b-0">
                  <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                    <item.icon className="w-4.5 h-4.5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </Link>
              )
            ))}
          </div>
        </div>
      ))}

      <button onClick={handleLogout}
        className="w-full flex items-center justify-center space-x-2 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
        <LogOut className="w-5 h-5" />
        <span>Logout</span>
      </button>

    </div>
  );
};

export default Profile;