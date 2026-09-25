import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, Calendar, ChevronDown, Megaphone, AlertTriangle, Heart, GraduationCap, Siren, Loader2, RefreshCw } from 'lucide-react';
import api from '../../../services/api';

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl ${className}`} />
);

const getCachedAnnouncements = () => {
  try {
    const cached = JSON.parse(localStorage.getItem('carelink.student.announcements') || '[]');
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
};

const Announcements = () => {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [announcements, setAnnouncements] = useState(getCachedAnnouncements);
  const [loading, setLoading] = useState(() => getCachedAnnouncements().length === 0);
  const [error, setError] = useState('');

  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get('/announcements?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const data = response.data.data;
        const items = Array.isArray(data) ? data : (data?.data || []);
        const normalizedAnnouncements = items.map(a => ({
          id: a.id,
          title: a.title || 'Announcement',
          content: a.content || a.description || '',
          category: a.category || 'General',
          date: a.created_at || new Date().toISOString(),
          author: typeof a.author === 'string'
            ? a.author
            : a.author
              ? [a.author.first_name, a.author.last_name].filter(Boolean).join(' ') || 'PUPBC Clinic'
              : 'PUPBC Clinic',
        }));
        setAnnouncements(normalizedAnnouncements);
        localStorage.setItem('carelink.student.announcements', JSON.stringify(normalizedAnnouncements));
      }
    } catch (err) {
      console.log('Announcements error:', err);
      setError('Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 60000);
    const handleFocus = () => fetchAnnouncements();
    window.addEventListener('focus', handleFocus);
    return () => { 
      clearInterval(interval); 
      window.removeEventListener('focus', handleFocus); 
    };
  }, []);

  const categories = ['all', ...new Set(announcements.map(a => a.category))];

  const categoryIcons = {
    'General': Megaphone,
    'Clinic Advisory': Heart,
    'Health Advisory': Heart,
    'School Events': GraduationCap,
    'Emergency': Siren,
  };

  const categoryConfig = {
    'General': { bg: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', iconColor: 'text-gray-500' },
    'Clinic Advisory': { bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400', iconColor: 'text-blue-500' },
    'Health Advisory': { bg: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', iconColor: 'text-green-500' },
    'School Events': { bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400', iconColor: 'text-purple-500' },
    'Emergency': { bg: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400', iconColor: 'text-red-500' },
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const filteredAnnouncements = announcements.filter(a => {
    const matchesSearch = search === '' || 
      a.title.toLowerCase().includes(search.toLowerCase()) || 
      a.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'all' || a.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-40 mb-1.5" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-10 flex-1 rounded-2xl" />
          <Skeleton className="h-10 w-40 rounded-2xl" />
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-20 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 sm:gap-4 flex-1">
                  <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-56" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  </div>
                </div>
                <Skeleton className="w-5 h-5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-5 pb-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Announcements</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button 
          onClick={fetchAnnouncements} 
          className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl text-sm text-center border border-red-200 dark:border-red-800/20">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-500"
            type="text" value={search} onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search announcements..." />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-500">
          <option value="all">All Categories</option>
          {categories.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilterCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all flex-shrink-0 ${
              filterCategory === cat 
                ? 'bg-maroon-800 text-white shadow-md' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}>
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredAnnouncements.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 py-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
              {search || filterCategory !== 'all' ? 'No announcements match your filters.' : 'No announcements yet.'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Check back later for updates.
            </p>
          </div>
        ) : (
          filteredAnnouncements.map(ann => {
            const config = categoryConfig[ann.category] || categoryConfig['General'];
            const IconComponent = categoryIcons[ann.category] || Megaphone;
            return (
              <motion.div key={ann.id} layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all">
                <button 
                  className="w-full p-4 sm:p-5 text-left"
                  onClick={() => setExpandedId(expandedId === ann.id ? null : ann.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                      <div className="w-10 h-10 bg-maroon-50 dark:bg-maroon-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                          {ann.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.bg}`}>
                            {ann.category}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(ann.date)}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
                            {typeof ann.author === 'string' ? ann.author : 'PUPBC Clinic'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${expandedId === ann.id ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedId === ann.id && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden">
                      <div className="px-4 sm:px-5 pb-5 border-t border-gray-100 dark:border-gray-700/50 pt-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                          {ann.content}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default Announcements;