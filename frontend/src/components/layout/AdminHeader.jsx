import { Bell, Search, Sun, Moon, Menu } from 'lucide-react';

const AdminHeader = ({ user, darkMode, onToggleDark, onMenuClick }) => {
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center space-x-3">
        <button className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition" onClick={onMenuClick}>
          <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="hidden sm:block">
          <p className="text-sm text-gray-400">{today}</p>
        </div>
      </div>

      <div className="flex items-center space-x-1">
        <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input className="bg-transparent border-none outline-none text-sm ml-2 w-24 lg:w-40 text-gray-600 dark:text-gray-300 placeholder:text-gray-400" placeholder="Search..." />
        </div>
        
        <button className="relative p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">
          <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900"></span>
        </button>
        
        <button onClick={onToggleDark} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">
          {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-500" />}
        </button>

        <div className="w-9 h-9 bg-maroon-100 dark:bg-maroon-900/30 rounded-2xl flex items-center justify-center ml-1">
          <span className="text-sm font-bold text-maroon-800 dark:text-maroon-400">{user.first_name?.[0]}{user.last_name?.[0]}</span>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;