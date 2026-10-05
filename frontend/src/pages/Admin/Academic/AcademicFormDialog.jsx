import { useEffect, useRef } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { inputStyle, primary, secondary, focus } from '../Students/directoryOptions';

import { periodLabel, academicNames } from './academicOptions';

function Field({ name, label, error, hint, children }) {
  return <div><label htmlFor={`academic-${name}`} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>{children}
    {error ? <p id={`academic-${name}-help`} role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-300">{Array.isArray(error) ? error.join(' ') : error}</p> : hint && <p id={`academic-${name}-help`} className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>}
  </div>;
}

export default function AcademicFormDialog({ type, editing, form, onChange, onClose, onSubmit, saving, errors, error, courses, periods }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  const props = name => ({ id: `academic-${name}`, name, value: form[name], onChange: event => onChange(name, event.target.value), disabled: saving,
    'aria-invalid': Boolean(errors[name]), 'aria-describedby': `academic-${name}-help`,
    className: `${inputStyle} min-h-11 disabled:opacity-60 ${errors[name] ? 'border-red-400 dark:border-red-400' : ''}` });
  const visibleCourses = courses.filter(item => item.is_active || item.id === form.course_id);
  return <dialog ref={ref} aria-labelledby="academic-form-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100vw_-_1.5rem)] max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-gray-950/60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
    <header className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 sm:p-6 dark:border-gray-700"><div><p className="text-xs font-medium uppercase tracking-wider text-maroon-800 dark:text-maroon-300">Academic management</p><h2 id="academic-form-title" className="mt-1 text-xl font-semibold">{editing ? 'Edit' : 'Add'} {academicNames[type]}</h2><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{type === 'course' ? 'Use the course abbreviation and its full official name.' : type === 'section' ? 'Connect a section to its course and academic period.' : 'Define the academic year and semester for your sections.'}</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close form" className={`shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700 ${focus}`}><X size={20} /></button></header>
    <form onSubmit={onSubmit} aria-busy={saving}>
      <div className="space-y-5 p-5 sm:p-6">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">{error}</p>}
        {type === 'course' && <>
          <Field name="code" label="Course abbreviation" error={errors.code} hint="For example, BSIT or BSCpE."><input {...props('code')} required maxLength={50} autoComplete="off" placeholder="BSIT" /></Field>
          <Field name="name" label="Full course name" error={errors.name} hint="Use the complete course title."><textarea {...props('name')} required maxLength={150} rows={3} placeholder="Bachelor of Science in Information Technology" className={`${props('name').className} resize-y`} /></Field>
        </>}
        {type === 'period' && <>
          <div className="grid grid-cols-2 gap-3">
            <Field name="academic_year_start" label="Starting year" error={errors.academic_year_start} hint="First year of the academic period."><input {...props('academic_year_start')} required type="number" min="2000" max="2100" step="1" placeholder="2026" /></Field>
            <Field name="academic_year_end" label="Ending year" error={errors.academic_year_end} hint="Same as or later than the starting year."><input {...props('academic_year_end')} required type="number" min={form.academic_year_start || 2000} max="2101" step="1" placeholder="2027" /></Field>
          </div>
          <Field name="semester" label="Semester" error={errors.semester} hint="Select the term for this academic period."><select {...props('semester')}>{['1st Semester', '2nd Semester', 'Summer', ...(!['1st Semester', '2nd Semester', 'Summer'].includes(form.semester) ? [form.semester] : [])].map(value => <option key={value}>{value}</option>)}</select></Field>
        </>}
        {type === 'section' && <>
          <Field name="course_id" label="Course" error={errors.course_id} hint="Select the course this section belongs to."><select {...props('course_id')} required><option value="">Select a course</option>{visibleCourses.map(item => <option key={item.id} value={item.id}>{item.code} — {item.name}{!item.is_active ? ' (inactive)' : ''}</option>)}</select></Field>
          <Field name="academic_period_id" label="Academic period" error={errors.academic_period_id} hint="The academic year and semester for this section."><select {...props('academic_period_id')} required><option value="">Select an academic period</option>{periods.map(item => <option key={item.id} value={item.id}>{periodLabel(item)}{!item.is_active ? ' (inactive)' : ''}</option>)}</select></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="year_level" label="Year level" error={errors.year_level} hint="The student's academic year level."><select {...props('year_level')}>{['1st Year', '2nd Year', '3rd Year', '4th Year', ...(!['1st Year', '2nd Year', '3rd Year', '4th Year'].includes(form.year_level) ? [form.year_level] : [])].map(value => <option key={value}>{value}</option>)}</select></Field>
            <Field name="section_code" label="Section code" error={errors.section_code} hint="For example, 1-1 or 4-1."><input {...props('section_code')} required maxLength={30} placeholder="1-1" autoComplete="off" /></Field>
          </div>
        </>}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-900/40"><input type="checkbox" checked={form.is_active} onChange={event => onChange('is_active', event.target.checked)} disabled={saving} className="mt-0.5 h-5 w-5 shrink-0 accent-maroon-800 dark:accent-maroon-300" /><span><span className="block text-sm font-semibold">Active {academicNames[type]}</span><span className="mt-1 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">{type === 'course' ? 'Active courses are available when adding sections.' : 'Keep active while this record is in use.'}</span></span></label>
      </div>
      <footer className="flex flex-wrap justify-end gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/30"><button type="button" onClick={onClose} disabled={saving} className={`${secondary} min-h-11`}>Cancel</button><button type="submit" disabled={saving} className={`${primary} min-h-11`}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{saving ? 'Saving…' : editing ? 'Save changes' : `Add ${academicNames[type]}`}</button></footer>
    </form>
  </dialog>;
}
