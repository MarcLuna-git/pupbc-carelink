import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Plus, Trash2, Edit2, Loader2, X, Send, Search } from 'lucide-react';
import api from '../../../services/api';

const NurseAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'General', target_audience: 'all' });
  const [search, setSearch] = useState('');

  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await api.get('/nurse/announcements', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        const data = res.data.data;
        setAnnouncements(Array.isArray(data) ? data : (data?.data || []));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const getErrorDetail = (err, fallback) => {
    const res = err?.response;
    if (res?.data?.errors) {
      const first = Object.values(res.data.errors)[0];
      if (Array.isArray(first) && first.length) return first[0];
    }
    return res?.data?.message || err?.message || fallback;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;

    try {
      const token = localStorage.getItem('token');
      if (editingId) {
        await api.put(`/nurse/announcements/${editingId}`, form, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 120000
        });
        setMessage('Announcement updated!');
      } else {
        await api.post('/nurse/announcements', form, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 120000
        });
        setMessage('Announcement posted!');
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ title: '', content: '', category: 'General', target_audience: 'all' });
      fetchAnnouncements();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Save announcement failed:', err?.response?.status, err?.response?.data || err);
      setMessage(`Failed to save announcement. ${getErrorDetail(err, 'Please try again.')}`);
    }
  };

  const handleEdit = (ann) => {
    setForm({ title: ann.title, content: ann.content, category: ann.category || 'General', target_audience: ann.target_audience || 'all' });
    setEditingId(ann.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      const token = localStorage.getItem('token');
      await api.delete(`/nurse/announcements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Announcement deleted.');
      fetchAnnouncements();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to delete.');
    }
  };

  const filtered = announcements.filter(a =>
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.content?.toLowerCase().includes(search.toLowerCase())
  );

  const categories = ['General', 'Clinic Advisory', 'Health Advisory', 'School Events', 'Emergency'];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-maroon-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Announcements</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Post clinic and school announcements</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ title: '', content: '', category: 'General', target_audience: 'all' }); }}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition ${
            showForm ? 'bg-gray-200 dark:bg-gray-700' : 'bg-maroon-800 text-white shadow-lg hover:bg-maroon-900'
          }`}>
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm ? 'Cancel' : 'New Post'}</span>
        </button>
      </div>

      {message && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-2xl text-sm text-center">{message}</div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 overflow-hidden">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">{editingId ? 'Edit Announcement' : 'New Announcement'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Title *</label>
                <input className="w-full border rounded-2xl px-4 py-3 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-maroon-500"
                  value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Content *</label>
                <textarea className="w-full border rounded-2xl px-4 py-3 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-maroon-500" rows={4}
                  value={form.content} onChange={(e) => setForm({...form, content: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5">Category</label>
                  <select className="w-full border rounded-2xl px-4 py-3 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5">Audience</label>
                  <select className="w-full border rounded-2xl px-4 py-3 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    value={form.target_audience} onChange={(e) => setForm({...form, target_audience: e.target.value})}>
                    <option value="all">All</option>
                    <option value="students">Students</option>
                    <option value="nurses">Nurses</option>
                  </select>
                </div>
              </div>
              <button type="submit"
                className="w-full py-3 bg-maroon-800 text-white font-semibold rounded-2xl hover:bg-maroon-900 transition flex items-center justify-center space-x-2">
                <Send className="w-4 h-4" />
                <span>{editingId ? 'Update' : 'Post'} Announcement</span>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full border rounded-2xl pl-10 pr-4 py-2.5 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search announcements..." />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Megaphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No announcements yet.</p>
          </div>
        ) : (
          filtered.map(ann => (
            <div key={ann.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{ann.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ann.content}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{ann.category}</span>
                    <span className="text-xs text-gray-400">{ann.target_audience || 'all'}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 ml-4">
                  <button onClick={() => handleEdit(ann)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-blue-500">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(ann.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NurseAnnouncements;