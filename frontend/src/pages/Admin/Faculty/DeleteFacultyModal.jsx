import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import api from '../../../services/api';
import { Modal } from '../Students/StudentDetailsModal';
import { focus } from '../Students/directoryOptions';

// Confirm before removing a faculty member. Their past dispensing records stay in the Dispensing History.
export default function DeleteFacultyModal({ member, onClose, onDone }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!saving) onClose(); };

  const remove = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      await api.delete(`/nurse/faculty/${member.id}`, { headers: { 'If-Match': member.sync_version } });
      onDone('Faculty member deleted.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete the faculty member.');
      setSaving(false);
    }
  };

  return <Modal title="Delete faculty member" onClose={close}>
    <header className="flex items-start gap-3 px-5 pb-2 pt-5 sm:px-6">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"><Trash2 size={18} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h2 className="text-lg font-bold">Delete Faculty Member?</h2><p className="text-sm text-gray-500 dark:text-gray-400">They leave the directory. Their dispensing records stay in the history.</p></div>
      <button type="button" onClick={close} aria-label="Close" className={`rounded-[10px] p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 ${focus}`}><X size={18} /></button>
    </header>
    <div className="space-y-3 px-5 pb-5 pt-3 sm:px-6">
      <p className="flex items-start gap-2 rounded-[10px] bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><span>Delete <strong>{member.full_name}</strong>{member.course ? ` (${member.course})` : ''}?</span></p>
      {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
    </div>
    <footer className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6 dark:border-gray-700 dark:bg-gray-900/30">
      <button type="button" onClick={close} disabled={saving} className={`inline-flex h-10 items-center rounded-[10px] border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700 ${focus}`}>Cancel</button>
      <button type="button" onClick={remove} disabled={saving} className={`inline-flex h-10 items-center gap-2 rounded-[10px] bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 ${focus}`}>{saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{saving ? 'Deleting…' : 'Delete'}</button>
    </footer>
  </Modal>;
}
