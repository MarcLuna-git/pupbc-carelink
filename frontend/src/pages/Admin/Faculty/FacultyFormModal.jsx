import { useState } from 'react';
import { Loader2, Save, Users, X } from 'lucide-react';
import api from '../../../services/api';
import academics from '../../../data/registration-academics.json';
import { Modal } from '../Students/StudentDetailsModal';
import { focus } from '../Students/directoryOptions';
import { DEPARTMENTS, DESIGNATIONS, FACULTY_TYPES } from './facultyOptions';

/*
 * Add Faculty Member / Edit Faculty Member popup. Course is the program the faculty member teaches under
 * (the same programs as the Courses page). Email and contact number are optional and show on their details.
 */
const field = 'h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-maroon-300/30';
const blank = { full_name: '', faculty_type: 'full_time', course: '', designation: '', department: '', email: '', phone: '', notes: '', status: 'active' };
const fromMember = member => ({
  full_name: member.full_name || '', faculty_type: member.faculty_type || 'full_time', course: member.course || '', designation: member.designation || '',
  department: member.department || '', email: member.email || '', phone: member.phone || '', notes: member.notes || '', status: member.status || 'active',
});

function Label({ children, required }) {
  return <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">{children}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}</span>;
}
// A saved value that is not in the standard list (typed in before, or from an older list) stays selectable.
const withCurrent = (list, value) => (value && !list.includes(value) ? [value, ...list] : list);

export default function FacultyFormModal({ member = null, onClose, onSaved }) {
  const editing = Boolean(member);
  const [form, setForm] = useState(editing ? fromMember(member) : blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }));
  const courses = academics.map(course => course.abbreviation);

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    const body = { ...form, designation: form.designation || null, department: form.department || null, email: form.email.trim() || null, phone: form.phone.trim() || null, notes: form.notes.trim() || null };
    try {
      if (editing) await api.put(`/nurse/faculty/${member.id}`, body, { headers: { 'If-Match': member.sync_version } });
      else await api.post('/nurse/faculty', body);
      onSaved(editing ? 'Faculty member updated.' : 'Faculty member added.');
    } catch (err) {
      setError((err.response?.data?.errors && Object.values(err.response.data.errors).flat()[0]) || err.response?.data?.message || 'Unable to save the faculty member.');
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };

  return <Modal title={editing ? 'Edit faculty member' : 'Add faculty member'} onClose={close}>
    <form onSubmit={submit} aria-busy={saving}>
      <header className="flex items-center gap-3 px-5 pb-1 pt-5 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300"><Users size={18} aria-hidden="true" /></span>
        <h2 className="min-w-0 flex-1 text-lg font-bold">{editing ? 'Edit Faculty Member' : 'Add Faculty Member'}</h2>
        <button type="button" onClick={close} aria-label="Close" className={`rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 ${focus}`}><X size={18} /></button>
      </header>

      <div className="space-y-4 px-5 pb-5 pt-3 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><Label required>Full Name</Label><input className={field} value={form.full_name} onChange={set('full_name')} placeholder="e.g. Maria Santos" maxLength={150} required /></label>
          <label><Label required>Faculty Type</Label>
            <select className={`${field} cursor-pointer`} value={form.faculty_type} onChange={set('faculty_type')} required>{FACULTY_TYPES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><Label required>Course</Label>
            <select className={`${field} cursor-pointer`} value={form.course} onChange={set('course')} required>
              <option value="">Select course</option>
              {withCurrent(courses, form.course).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label><Label>Designation</Label>
            <select className={`${field} cursor-pointer`} value={form.designation} onChange={set('designation')}>
              <option value="">Select designation</option>
              {withCurrent(DESIGNATIONS, form.designation).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>
        <label className="block"><Label>Organization / Department</Label>
          <select className={`${field} cursor-pointer`} value={form.department} onChange={set('department')}>
            <option value="">Select department</option>
            {withCurrent(DEPARTMENTS, form.department).map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><Label>Email <span className="font-normal text-gray-400">(optional)</span></Label><input className={field} type="email" value={form.email} onChange={set('email')} placeholder="e.g. maria.santos@school.edu" maxLength={150} /></label>
          <label><Label>Contact Number <span className="font-normal text-gray-400">(optional)</span></Label><input className={field} type="tel" value={form.phone} onChange={set('phone')} placeholder="e.g. +63 912 345 6789" maxLength={50} /></label>
        </div>
        {editing && <label className="block sm:max-w-xs"><Label required>Status</Label>
          <select className={`${field} cursor-pointer`} value={form.status} onChange={set('status')}><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </label>}
        <label className="block"><Label>Notes <span className="font-normal text-gray-400">(optional)</span></Label>
          <textarea className={`${field} h-auto resize-none py-2.5`} rows={3} maxLength={500} value={form.notes} onChange={set('notes')} placeholder="Additional notes about the faculty member..." />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
      </div>

      <footer className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6 dark:border-gray-700 dark:bg-gray-900/30">
        <button type="button" onClick={close} disabled={saving} className={`inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700 ${focus}`}>Cancel</button>
        <button type="submit" disabled={saving} className={`inline-flex h-10 items-center gap-2 rounded-lg bg-maroon-800 px-6 text-sm font-semibold text-white hover:bg-maroon-900 disabled:opacity-60 ${focus}`}>
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}{saving ? 'Saving…' : 'Save'}
        </button>
      </footer>
    </form>
  </Modal>;
}
