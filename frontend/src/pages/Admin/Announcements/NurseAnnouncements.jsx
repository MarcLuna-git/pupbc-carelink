import { useState, useEffect, useRef } from 'react';
import { SquarePen, FilePenLine, Newspaper, ScrollText, Trash2, Edit2, Loader2, X, Send, Search, ChevronDown } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageTitle from '../../../components/NursePageTitle';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import useNurseSync from '../../../hooks/useNurseSync';
import { NurseToast } from '../../../components/NurseFeedback';

const NurseAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'General' });
  const [search, setSearch] = useState('');
  const [editVersion, setEditVersion] = useState(null);
  const requestId = useRef(0);
  const composerRef = useRef(null);
  useNurseSync(['announcements'], () => fetchAnnouncements());

  const fetchAnnouncements = async () => {
    const request = ++requestId.current;
    try {
      const res = await api.get('/nurse/announcements');
      if (request !== requestId.current) return;
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
    if (saving || !form.title.trim() || !form.content.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        const response = await api.put(`/nurse/announcements/${editingId}`, form, {
          headers: { 'If-Match': editVersion },
          timeout: 120000
        });
        setAnnouncements((current) => current.map((announcement) => announcement.id === editingId
          ? { ...announcement, ...response.data.data } : announcement));
        setMessageType('success');
        setMessage('Announcement updated!');
      } else {
        const response = await api.post('/nurse/announcements', form, {
          timeout: 120000
        });
        setAnnouncements((current) => [response.data.data, ...current]);
        setMessageType('success');
        setMessage('Announcement posted!');
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ title: '', content: '', category: 'General' });
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Save announcement failed:', err?.response?.status, err?.response?.data || err);
      setMessageType('error');
      setMessage(`Failed to save announcement. ${getErrorDetail(err, 'Please try again.')}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ann) => {
    setEditVersion(ann.sync_version);
    setForm({ title: ann.title, content: ann.content, category: ann.category || 'General' });
    setEditingId(ann.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (deletingId !== null) return;
    if (!confirm('Delete this announcement?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/nurse/announcements/${id}`, {
        headers: { 'If-Match': announcements.find(item => item.id === id)?.sync_version }
      });
      setAnnouncements((current) => current.filter((announcement) => announcement.id !== id));
      setMessage('Announcement deleted.');
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.message || 'Failed to delete.');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = announcements.filter(a =>
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.content?.toLowerCase().includes(search.toLowerCase())
  );

  const categories = ['General', 'Clinic Advisory', 'Health Advisory', 'School Events', 'Emergency'];

  // Editing a post lower in the list brings the composer card into view.
  useEffect(() => {
    if (editingId) composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingId]);

  if (loading) {
    return <NursePageSkeleton label="Loading announcements" />;
  }

  const resetComposer = () => { setEditingId(null); setForm({ title: '', content: '', category: 'General' }); };
  const hasDraft = Boolean(form.title || form.content);
  const inputClass = 'w-full rounded-[10px] border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-gray-500 dark:text-gray-400';
  const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <NursePageTitle path="/nurse/announcements" />

      {/* Action results show as a floating toast */}
      <NurseToast message={message} type={messageType} onClose={() => setMessage('')} />

      {/* Composer: a permanent card with its own heading. */}
      <section
        ref={composerRef}
        aria-labelledby="announcement-composer-title"
        className={`scroll-mt-4 overflow-hidden rounded-[10px] border bg-white dark:bg-gray-800 ${
          editingId ? 'border-maroon-200 dark:border-maroon-900/50' : 'border-gray-100 dark:border-gray-700'
        }`}
      >
        <header className="flex items-start gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-700 lg:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-400">
            {editingId ? <FilePenLine className="h-5 w-5" /> : <SquarePen className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h2 id="announcement-composer-title" className="font-bold text-gray-900 dark:text-white">
              {editingId ? 'Edit Announcement' : 'Create Announcement'}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {editingId
                ? 'Update the details below, then save. Students will see the new version.'
                : 'Write a clinic or school update. Posted announcements are shown to all students.'}
            </p>
          </div>
        </header>
          <form onSubmit={handleSubmit} className="space-y-4 p-4 lg:p-6">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
              <div>
                <label className={labelClass}>Title *</label>
                <input className={inputClass} value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required />
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <div className="relative">
                  <select className={`${inputClass} cursor-pointer appearance-none pr-10`} value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass}>Content *</label>
              <textarea className={inputClass} rows={4} value={form.content} onChange={(e) => setForm({...form, content: e.target.value})} required />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {(editingId || hasDraft) && (
                <button type="button" onClick={resetComposer}
                  className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50">
                  <X className="h-4 w-4" />
                  {editingId ? 'Cancel edit' : 'Clear'}
                </button>
              )}
              <button type="submit" disabled={saving}
                className="inline-flex items-center gap-2 rounded-[10px] bg-maroon-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-900 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>{saving ? 'Saving...' : editingId ? 'Update' : 'Post'} Announcement</span>
              </button>
            </div>
          </form>
      </section>

      {/* List card: its own heading, search, and the posts in a nested panel. */}
      <NurseListCard
        aria-label="Announcement list"
        icon={Newspaper}
        title={<>Posted announcements<CountChip>{announcements.length}</CountChip></>}
        description="Everything students can currently see. Edit a post to update it, or remove it."
        toolbar={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              className="w-full rounded-[10px] border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search announcements..."
              aria-label="Search announcements"
            />
          </div>
        }
      >
        <div className="p-3 sm:p-4">
          {filtered.length === 0 ? (
            <div className="py-14 text-center">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[10px] bg-gray-50 dark:bg-gray-700/50">
                <Newspaper className="h-8 w-8 text-gray-300 dark:text-gray-500" />
              </span>
              <h3 className="text-base font-semibold text-gray-600 dark:text-gray-300">{search ? 'No announcements match your search.' : 'No announcements yet.'}</h3>
              <p className="mt-1 text-sm text-gray-400">{search ? 'Try a different keyword.' : 'Posts you create will appear here.'}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map(ann => (
                <li key={ann.id} className={`flex items-start gap-3 rounded-[10px] border p-4 transition-colors ${
                  editingId === ann.id
                    ? 'border-maroon-200 bg-maroon-50/50 dark:border-maroon-900/40 dark:bg-maroon-900/10'
                    : 'border-gray-100 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/40'
                }`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-400">
                    <ScrollText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-semibold text-gray-900 dark:text-white">{ann.title}</h3>
                    <p className="mt-1 line-clamp-2 break-words text-sm text-gray-500 dark:text-gray-400">{ann.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">{ann.category || 'General'}</span>
                      {ann.created_at && <span className="text-gray-400">{formatDate(ann.created_at)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => handleEdit(ann)} aria-label="Edit announcement"
                      className="rounded-[10px] p-2 text-gray-400 hover:bg-gray-100 hover:text-maroon-700 dark:hover:bg-gray-700 dark:hover:text-maroon-400">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(ann.id)} disabled={deletingId === ann.id} aria-label="Delete announcement"
                      className="rounded-[10px] p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20">
                      {deletingId === ann.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </NurseListCard>
    </div>
  );
};

export default NurseAnnouncements;
