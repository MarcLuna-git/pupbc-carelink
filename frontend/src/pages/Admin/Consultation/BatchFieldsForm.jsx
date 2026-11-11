import { inputStyle } from '../Students/directoryOptions';
import BatchSectionField from './BatchSectionField';

/* Batch Release → the selected document's own details, drawn from its `fields` in batchDocuments.js. */
export const fieldLabel = 'mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300';

export default function BatchFieldsForm({ doc, values, errors, onChange }) {
  const change = (e) => onChange(e.target.name, e.target.value);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {doc.fields.map((field) => {
        const id = `batch-${doc.key}-${field.name}`;
        const error = errors[field.name];
        const props = {
          id,
          name: field.name,
          value: values[field.name] ?? '',
          onChange: change,
          className: `${inputStyle} ${error ? 'border-red-400 dark:border-red-500' : ''}`,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? `${id}-error` : undefined,
        };
        return (
          <div key={field.name} className={field.span === 2 || field.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label htmlFor={id} className={fieldLabel}>
              {field.label}
              {field.required ? <span className="text-red-600" aria-hidden="true"> *</span> : <span className="font-normal text-gray-400"> (optional)</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea {...props} rows={3} maxLength={field.max} placeholder={field.placeholder} />
            ) : field.type === 'select' ? (
              <select {...props}>
                <option value="">Select…</option>
                {(field.options || []).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            ) : field.type === 'section' ? (
              <BatchSectionField {...props} onChange={onChange} maxLength={field.max} placeholder={field.placeholder} />
            ) : (
              <input {...props} type={field.type || 'text'} maxLength={field.max} placeholder={field.placeholder} />
            )}
            {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-semibold text-red-700 dark:text-red-400">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
