import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarRange, ChevronDown, FilePenLine, LibraryBig, Loader2, Rows3, Save, Trash2, X } from 'lucide-react';
import { inputStyle, primary, focus } from '../Students/directoryOptions';
import { periodLabel, academicNames } from './academicOptions';
import { codeOnly, digitsOnly, wordsOnly } from '../../../utils/inputFilters';

const icons = { course: LibraryBig, section: Rows3, period: CalendarRange };
const descriptions = {
  course: 'Use the course abbreviation and its full official name.',
  section: 'Connect a section to its course and academic period.',
  period: 'Define the academic year and semester for your sections.',
};
export const cancelButton = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50 ${focus}`;

// Centered popup with a dimmed backdrop. Escape or a backdrop click closes it unless `busy`.
export function ModalShell({ labelledBy, onClose, busy, width, children }) {
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-900/50 px-4 py-6 backdrop-blur-sm"
    >
      <motion.div
        role="dialog" aria-modal="true" aria-labelledby={labelledBy}
        initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}
        className={`relative flex max-h-full w-full ${width} flex-col overflow-hidden rounded-[10px] bg-white text-gray-900 shadow-2xl dark:bg-gray-800 dark:text-gray-100`}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
}

function Field({ name, label, error, hint, children }) {
  return <div><label htmlFor={`academic-${name}`} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>{children}
    {error ? <p id={`academic-${name}-help`} role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-300">{Array.isArray(error) ? error.join(' ') : error}</p> : hint && <p id={`academic-${name}-help`} className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>}
  </div>;
}

const Select = ({ children, ...props }) => <div className="relative">
  <select {...props} className={`${props.className} cursor-pointer appearance-none pr-10`}>{children}</select>
  <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
</div>;

// Add / edit popup for courses, sections and academic periods.
// Codes take letters, digits and hyphens; years take 4 digits; a course name takes words only.
const filterAcademic = (type, name, value) => {
  if (name === 'code' || name === 'section_code') return codeOnly(value);
  if (name === 'academic_year_start' || name === 'academic_year_end') return digitsOnly(value, 4);
  if (name === 'name' && type === 'course') return wordsOnly(value);
  return value;
};

export default function AcademicFormModal({ type, editing, form, onChange, onClose, onSubmit, saving, errors, error, courses, periods, disabled = false }) {
  const locked = saving || disabled;
  const props = name => ({ id: `academic-${name}`, name, value: form[name] ?? '', onChange: event => onChange(name, filterAcademic(type, name, event.target.value)), disabled: locked,
    'aria-invalid': Boolean(errors[name]), 'aria-describedby': `academic-${name}-help`,
    className: `${inputStyle} min-h-11 disabled:opacity-60 ${errors[name] ? 'border-red-400 dark:border-red-400' : ''}` });
  const visibleCourses = courses.filter(item => item.is_active || item.id === form.course_id);
  const Icon = editing ? FilePenLine : icons[type];

  return <ModalShell labelledBy="academic-form-title" onClose={onClose} busy={saving} width="max-w-2xl">
    <header className="flex items-start gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700 sm:px-6">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-400"><Icon size={20} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <h2 id="academic-form-title" className="font-bold text-gray-900 dark:text-white">{editing ? 'Edit' : 'Add'} {academicNames[type]}</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{descriptions[type]}</p>
      </div>
      <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className={`rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-700 ${focus}`}><X size={20} /></button>
    </header>
    <form onSubmit={onSubmit} aria-busy={saving} className="flex min-h-0 flex-col">
      <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">{error}</p>}
        {type === 'course' && <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <Field name="code" label="Course abbreviation" error={errors.code} hint="For example, BSIT or BSCpE."><input {...props('code')} autoFocus required maxLength={50} autoComplete="off" placeholder="BSIT" /></Field>
          <Field name="name" label="Full course name" error={errors.name} hint="Use the complete course title."><input {...props('name')} required maxLength={150} placeholder="Bachelor of Science in Information Technology" /></Field>
        </div>}
        {type === 'period' && <div className="grid gap-4 sm:grid-cols-3">
          <Field name="academic_year_start" label="Starting year" error={errors.academic_year_start} hint="First year of the period."><input {...props('academic_year_start')} autoFocus required inputMode="numeric" maxLength={4} placeholder="2026" /></Field>
          <Field name="academic_year_end" label="Ending year" error={errors.academic_year_end} hint="Same as or later than the start."><input {...props('academic_year_end')} required inputMode="numeric" maxLength={4} placeholder="2027" /></Field>
          <Field name="semester" label="Semester" error={errors.semester} hint="The term of this period."><Select {...props('semester')}>{['1st Semester', '2nd Semester', 'Summer', ...(!['1st Semester', '2nd Semester', 'Summer'].includes(form.semester) ? [form.semester] : [])].map(value => <option key={value}>{value}</option>)}</Select></Field>
        </div>}
        {type === 'section' && <div className="grid gap-4 sm:grid-cols-2">
          <Field name="course_id" label="Course" error={errors.course_id} hint="The course this section belongs to."><Select {...props('course_id')} autoFocus required><option value="">Select a course</option>{visibleCourses.map(item => <option key={item.id} value={item.id}>{item.code} ({item.name}){!item.is_active ? ' (inactive)' : ''}</option>)}</Select></Field>
          <Field name="academic_period_id" label="Academic period" error={errors.academic_period_id} hint="The year and semester for this section."><Select {...props('academic_period_id')} required><option value="">Select an academic period</option>{periods.map(item => <option key={item.id} value={item.id}>{periodLabel(item)}{!item.is_active ? ' (inactive)' : ''}</option>)}</Select></Field>
          <Field name="year_level" label="Year level" error={errors.year_level} hint="The student's academic year level."><Select {...props('year_level')}>{['1st Year', '2nd Year', '3rd Year', '4th Year', ...(!['1st Year', '2nd Year', '3rd Year', '4th Year'].includes(form.year_level) ? [form.year_level] : [])].map(value => <option key={value}>{value}</option>)}</Select></Field>
          <Field name="section_code" label="Section code" error={errors.section_code} hint="For example, 1-1 or 4-1."><input {...props('section_code')} required maxLength={10} placeholder="1-1" autoComplete="off" /></Field>
        </div>}
        <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-gray-100 p-3 dark:border-gray-700"><input type="checkbox" checked={Boolean(form.is_active)} onChange={event => onChange('is_active', event.target.checked)} disabled={locked} className="mt-0.5 h-5 w-5 shrink-0 accent-maroon-800 dark:accent-maroon-300" /><span><span className="block text-sm font-semibold">Active {academicNames[type]}</span><span className="mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">{type === 'course' ? 'Active courses can be chosen on the registration form and when adding sections.' : type === 'section' ? 'Active sections in an active period appear on the registration form.' : 'Sections in an active period appear on the registration form.'}</span></span></label>
      </div>
      <footer className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700 sm:px-6">
        <button type="button" onClick={onClose} disabled={saving} className={cancelButton}>Cancel</button>
        <button type="submit" disabled={locked} className={`${primary} min-h-11`}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{saving ? 'Saving…' : editing ? 'Save changes' : `Add ${academicNames[type]}`}</button>
      </footer>
    </form>
  </ModalShell>;
}

// Confirmation popup before a course, section or academic period is deleted.
export function AcademicDeleteModal({ type, label, onClose, onConfirm, deleting, error }) {
  return <ModalShell labelledBy="academic-delete-title" onClose={onClose} busy={deleting} width="max-w-md">
    <div className="p-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300"><AlertTriangle size={24} aria-hidden="true" /></span>
      <h2 id="academic-delete-title" className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Delete {academicNames[type]}?</h2>
      <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300"><strong className="font-semibold text-gray-900 dark:text-white">{label}</strong> will be removed permanently. It will no longer appear on the registration form.</p>
      {error && <p role="alert" className="mt-4 rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={deleting} className={cancelButton}>Cancel</button>
        <button type="button" onClick={onConfirm} disabled={deleting} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 ${focus}`}>
          {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}{deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </ModalShell>;
}
