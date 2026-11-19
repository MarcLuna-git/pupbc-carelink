import { useState } from 'react';
import { BriefcaseMedical, FilePenLine, Loader2, Save, X } from 'lucide-react';
import api from '../../../services/api';
import { Modal } from '../Students/StudentDetailsModal';
import { focus } from '../Students/directoryOptions';
import { UNITS } from './medicineOptions';

/*
 * Add Medicine / Edit Medicine popup. A new medicine starts with its quantity (which becomes the first
 * line of its stock history); after that, stock changes through Restock and stock movements, so the
 * quantity is not editable here.
 */
const NOTES_MAX = 200;
const field = 'h-11 w-full rounded-[10px] border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-maroon-300/30';
const isWhole = value => /^\d*$/.test(value);

const blank = { name: '', generic_name: '', category: '', unit: '', quantity: '', minimum_stock: '', dosage: '', expiry_date: '', manufacturer: '', description: '' };
const fromMedicine = medicine => ({
  name: medicine.name || '', generic_name: medicine.generic_name || '', category: medicine.category || '', unit: medicine.unit || '',
  quantity: '', minimum_stock: String(medicine.minimum_stock ?? ''), dosage: medicine.dosage || '',
  expiry_date: medicine.expiry_date ? String(medicine.expiry_date).slice(0, 10) : '', manufacturer: medicine.manufacturer || '', description: medicine.description || '',
});

function Label({ children, required }) {
  return <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">{children}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}</span>;
}

export default function MedicineFormModal({ medicine = null, categories, timeGuardOff, onClose, onSaved }) {
  const editing = Boolean(medicine);
  const [form, setForm] = useState(editing ? fromMedicine(medicine) : blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const categoryOptions = form.category && !categories.includes(form.category) ? [form.category, ...categories] : categories;
  const unitOptions = form.unit && !UNITS.some(([key]) => key === form.unit) ? [[form.unit, form.unit], ...UNITS] : UNITS;

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    if (!editing && !(Number.isInteger(Number(form.quantity)) && Number(form.quantity) >= 1)) { setError('Quantity must be a whole number greater than zero.'); return; }
    const body = {
      name: form.name.trim(), generic_name: form.generic_name.trim() || null, manufacturer: form.manufacturer.trim() || null,
      category: form.category || null, unit: form.unit, dosage: form.dosage.trim() || null,
      expiry_date: form.expiry_date || null, description: form.description.trim() || null,
    };
    if (form.minimum_stock !== '') body.minimum_stock = Number(form.minimum_stock);
    if (!editing) body.quantity = Number(form.quantity);
    setSaving(true); setError('');
    try {
      if (editing) await api.put(`/nurse/medicines/${medicine.id}`, body, { headers: { 'If-Match': medicine.sync_version } });
      else await api.post('/nurse/medicines', body);
      onSaved(editing ? 'Medicine updated.' : 'Medicine added.');
    } catch (err) {
      setError((err.response?.data?.errors && Object.values(err.response.data.errors).flat()[0]) || err.response?.data?.message || 'Unable to save the medicine.');
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };
  const Icon = editing ? FilePenLine : BriefcaseMedical;

  return <Modal title={editing ? 'Edit medicine' : 'Add medicine'} onClose={close}>
    <form onSubmit={submit} aria-busy={saving}>
      <header className="flex items-start gap-3 px-5 pb-2 pt-5 sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon-800 text-white"><Icon size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">{editing ? 'Edit Medicine' : 'Add Medicine'}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{editing ? 'Update the details of this medicine. Change the stock with Restock.' : 'Enter the details below to add a new medicine to the inventory.'}</p>
        </div>
        <button type="button" onClick={close} aria-label="Close" className={`rounded-[10px] p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 ${focus}`}><X size={18} /></button>
      </header>

      <div className="space-y-4 px-5 pb-5 pt-3 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><Label required>Medicine Name</Label><input className={field} value={form.name} onChange={set('name')} placeholder="e.g. Paracetamol 500 mg" maxLength={255} required /></label>
          <label><Label required>Generic Name</Label><input className={field} value={form.generic_name} onChange={set('generic_name')} placeholder="e.g. Acetaminophen" maxLength={255} required /></label>
        </div>
        <div className={`grid gap-4 ${editing ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          <label><Label required>Category</Label>
            <select className={`${field} cursor-pointer`} value={form.category} onChange={set('category')} required>
              <option value="">Select category</option>
              {categoryOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label><Label required>Unit</Label>
            <select className={`${field} cursor-pointer`} value={form.unit} onChange={set('unit')} required>
              <option value="">Select unit</option>
              {unitOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
          {!editing && <label><Label required>Quantity</Label><input className={field} inputMode="numeric" value={form.quantity} onChange={event => { if (isWhole(event.target.value)) setForm(current => ({ ...current, quantity: event.target.value })); }} placeholder="e.g. 100" required /></label>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><Label>Min Stock Alert</Label><input className={field} inputMode="numeric" value={form.minimum_stock} onChange={event => { if (isWhole(event.target.value)) setForm(current => ({ ...current, minimum_stock: event.target.value })); }} placeholder="e.g. 10" /></label>
          <label><Label>Dosage</Label><input className={field} value={form.dosage} onChange={set('dosage')} placeholder="e.g. 1 tablet 3x a day" maxLength={100} /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><Label required={!editing}>Expiry Date</Label><input className={field} type="date" min={timeGuardOff ? undefined : today} value={form.expiry_date} onChange={set('expiry_date')} required={!editing} /></label>
          <label><Label>Brand/Manufacturer <span className="font-normal text-gray-400">(Optional)</span></Label><input className={field} value={form.manufacturer} onChange={set('manufacturer')} placeholder="e.g. Biogesic" maxLength={150} /></label>
        </div>
        <label className="block"><Label>Notes <span className="font-normal text-gray-400">(Optional)</span></Label>
          <textarea className={`${field} h-auto resize-none py-2.5`} rows={3} maxLength={NOTES_MAX} value={form.description} onChange={set('description')} placeholder="Additional notes (e.g. special storage instructions)" />
          <span className="mt-1 block text-right text-xs text-gray-400" aria-live="polite">{form.description.length}/{NOTES_MAX}</span>
        </label>
        {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
      </div>

      <footer className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6 dark:border-gray-700 dark:bg-gray-900/30">
        <button type="button" onClick={close} disabled={saving} className={`inline-flex h-10 items-center rounded-[10px] border border-maroon-300 bg-white px-5 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 disabled:opacity-50 dark:border-maroon-700 dark:bg-transparent dark:text-maroon-300 dark:hover:bg-maroon-900/20 ${focus}`}>Cancel</button>
        <button type="submit" disabled={saving} className={`inline-flex h-10 items-center gap-2 rounded-[10px] bg-maroon-800 px-5 text-sm font-semibold text-white hover:bg-maroon-900 disabled:opacity-60 ${focus}`}>
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}{saving ? 'Saving…' : editing ? 'Save Changes' : 'Save Medicine'}
        </button>
      </footer>
    </form>
  </Modal>;
}
