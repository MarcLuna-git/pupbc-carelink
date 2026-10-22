import { forwardRef } from 'react';
import { CalendarRange, ChevronDown, FilePenLine, LibraryBig, Loader2, Rows3, Save, X } from 'lucide-react';
import { inputStyle, primary, focus } from '../Students/directoryOptions';

import { periodLabel, academicNames } from './academicOptions';

const icons = { course: LibraryBig, section: Rows3, period: CalendarRange };
const descriptions = {
  course: 'Use the course abbreviation and its full official name.',
  section: 'Connect a section to its course and academic period.',
  period: 'Define the academic year and semester for your sections.',
};

function Field({ name, label, error, hint, children }) {
  return <div><label htmlFor={`academic-${name}`} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>{children}
    {error ? <p id={`academic-${name}-help`} role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-300">{Array.isArray(error) ? error.join(' ') : error}</p> : hint && <p id={`academic-${name}-help`} className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>}
  </div>;
}

const Select = ({ children, ...props }) => <div className="relative">
  <select {...props} className={`${props.className} cursor-pointer appearance-none pr-10`}>{children}</select>
  <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
</div>;

/*
 * Permanent add / edit card for courses, sections and academic periods. It
 * follows the selected tab; `onClose` resets it (Clear / Cancel edit).
 */
const AcademicFormCard = forwardRef(function AcademicFormCard({ type, editing, form, onChange, onClose, onSubmit, saving, errors, error, courses, periods, disabled = false, dirty = false }, ref) {
  const locked = saving || disabled;
  const props = name => ({ id: `academic-${name}`, name, value: form[name] ?? '', onChange: event => onChange(name, event.target.value), disabled: locked,
    'aria-invalid': Boolean(errors[name]), 'aria-describedby': `academic-${name}-help`,
    className: `${inputStyle} min-h-11 disabled:opacity-60 ${errors[name] ? 'border-red-400 dark:border-red-400' : ''}` });
  const visibleCourses = courses.filter(item => item.is_active || item.id === form.course_id);
  const Icon = editing ? FilePenLine : icons[type];

  return <section ref={ref} aria-labelledby="academic-form-title" className={`scroll-mt-4 overflow-hidden rounded-lg border bg-white dark:bg-gray-800 ${editing ? 'border-maroon-200 dark:border-maroon-900/50' : 'border-gray-100 dark:border-gray-700'}`}>
    <header className="flex items-start gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-700 lg:px-6">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-400"><Icon size={20} aria-hidden="true" /></span>
      <div className="min-w-0">
        <h2 id="academic-form-title" className="font-bold text-gray-900 dark:text-white">{editing ? 'Edit' : 'Add'} {academicNames[type]}</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{descriptions[type]}</p>
      </div>
    </header>
    <form onSubmit={onSubmit} aria-busy={saving}>
      <div className="space-y-5 p-4 lg:p-6">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">{error}</p>}
        {type === 'course' && <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <Field name="code" label="Course abbreviation" error={errors.code} hint="For example, BSIT or BSCpE."><input {...props('code')} required maxLength={50} autoComplete="off" placeholder="BSIT" /></Field>
          <Field name="name" label="Full course name" error={errors.name} hint="Use the complete course title."><input {...props('name')} required maxLength={150} placeholder="Bachelor of Science in Information Technology" /></Field>
        </div>}
        {type === 'period' && <div className="grid gap-4 sm:grid-cols-3">
          <Field name="academic_year_start" label="Starting year" error={errors.academic_year_start} hint="First year of the academic period."><input {...props('academic_year_start')} required type="number" min="2000" max="2100" step="1" placeholder="2026" /></Field>
          <Field name="academic_year_end" label="Ending year" error={errors.academic_year_end} hint="Same as or later than the starting year."><input {...props('academic_year_end')} required type="number" min={form.academic_year_start || 2000} max="2101" step="1" placeholder="2027" /></Field>
          <Field name="semester" label="Semester" error={errors.semester} hint="Select the term for this academic period."><Select {...props('semester')}>{['1st Semester', '2nd Semester', 'Summer', ...(!['1st Semester', '2nd Semester', 'Summer'].includes(form.semester) ? [form.semester] : [])].map(value => <option key={value}>{value}</option>)}</Select></Field>
        </div>}
        {type === 'section' && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field name="course_id" label="Course" error={errors.course_id} hint="The course this section belongs to."><Select {...props('course_id')} required><option value="">Select a course</option>{visibleCourses.map(item => <option key={item.id} value={item.id}>{item.code} — {item.name}{!item.is_active ? ' (inactive)' : ''}</option>)}</Select></Field>
          <Field name="academic_period_id" label="Academic period" error={errors.academic_period_id} hint="The year and semester for this section."><Select {...props('academic_period_id')} required><option value="">Select an academic period</option>{periods.map(item => <option key={item.id} value={item.id}>{periodLabel(item)}{!item.is_active ? ' (inactive)' : ''}</option>)}</Select></Field>
          <Field name="year_level" label="Year level" error={errors.year_level} hint="The student's academic year level."><Select {...props('year_level')}>{['1st Year', '2nd Year', '3rd Year', '4th Year', ...(!['1st Year', '2nd Year', '3rd Year', '4th Year'].includes(form.year_level) ? [form.year_level] : [])].map(value => <option key={value}>{value}</option>)}</Select></Field>
          <Field name="section_code" label="Section code" error={errors.section_code} hint="For example, 1-1 or 4-1."><input {...props('section_code')} required maxLength={30} placeholder="1-1" autoComplete="off" /></Field>
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={Boolean(form.is_active)} onChange={event => onChange('is_active', event.target.checked)} disabled={locked} className="mt-0.5 h-5 w-5 shrink-0 accent-maroon-800 dark:accent-maroon-300" /><span><span className="block text-sm font-semibold">Active {academicNames[type]}</span><span className="mt-0.5 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">{type === 'course' ? 'Active courses are available when adding sections.' : 'Keep active while this record is in use.'}</span></span></label>
          <div className="flex flex-wrap gap-2">
            {(editing || dirty) && <button type="button" onClick={onClose} disabled={saving} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700/50 ${focus}`}><X size={16} />{editing ? 'Cancel edit' : 'Clear'}</button>}
            <button type="submit" disabled={locked} className={`${primary} min-h-11`}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{saving ? 'Saving…' : editing ? 'Save changes' : `Add ${academicNames[type]}`}</button>
          </div>
        </div>
      </div>
    </form>
  </section>;
});

export default AcademicFormCard;
