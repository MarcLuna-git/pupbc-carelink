import { useEffect, useState } from 'react';
import { Loader2, Pill, X } from 'lucide-react';
import api from '../../../services/api';
import { Modal } from '../Students/StudentDetailsModal';
import { focus } from '../Students/directoryOptions';
import { isoDay, unitLabel } from '../Medicine/medicineOptions';

/*
 * Giving a medicine to a faculty member: who, which medicine (only ones in stock that have not expired),
 * how many, and why. The stock comes out of the inventory, first-expiry first. The same form is the
 * "Dispense Medicine" tab (the faculty member is chosen) and the popup from a faculty member's details.
 */
const field = 'h-11 w-full rounded-[10px] border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-maroon-300/30 dark:disabled:bg-gray-800';
const Label = ({ children, required }) => <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">{children}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}</span>;
const dispensable = medicine => medicine.quantity > 0 && !medicine.is_expired;

export default function DispenseForm({ faculty = null, facultyOptions = [], onDone, onCancel }) {
  const [facultyId, setFacultyId] = useState(faculty?.id || '');
  const [medicines, setMedicines] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [medicineId, setMedicineId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    // The server sends at most 100 medicines a page, so read every page.
    (async () => {
      try {
        const all = [];
        for (let page = 1; page <= 20; page += 1) {
          const { data } = await api.get('/nurse/medicines', { params: { per_page: 100, page }, signal: controller.signal });
          all.push(...(data.data?.data || []));
          if (page >= (data.data?.last_page || 1)) break;
        }
        setMedicines(all.filter(dispensable).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') setLoadError('Unable to load the medicines.');
      }
    })();
    return () => controller.abort();
  }, []);

  const medicine = medicines?.find(item => item.id === medicineId);
  const qty = Number(quantity);
  const whole = Number.isInteger(qty) && qty >= 1;
  const tooMany = medicine && whole && qty > medicine.quantity;
  const valid = facultyId && medicine && whole && !tooMany && reason.trim();

  const submit = async event => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true); setError('');
    try {
      const { data } = await api.post(`/nurse/faculty/${facultyId}/dispense`, { medicine_id: medicineId, quantity: qty, reason: reason.trim() });
      onDone(data.message);
    } catch (err) {
      setError((err.response?.data?.errors && Object.values(err.response.data.errors).flat()[0]) || err.response?.data?.message || 'Unable to dispense the medicine.');
      setSaving(false);
    }
  };

  const fixed = faculty ? `${faculty.full_name}${faculty.course ? ` (${faculty.course})` : ''}` : '';

  return <form onSubmit={submit} aria-busy={saving} className="space-y-4">
    <label className="block"><Label>Faculty Member</Label>
      {faculty
        ? <input className={field} value={fixed} readOnly disabled />
        : <select className={`${field} cursor-pointer`} value={facultyId} onChange={event => { setFacultyId(event.target.value); setError(''); }} required>
          <option value="">Select faculty member</option>
          {facultyOptions.map(item => <option key={item.id} value={item.id}>{item.full_name}{item.course ? ` (${item.course})` : ''}</option>)}
        </select>}
    </label>
    <label className="block"><Label required>Medicine</Label>
      <select className={`${field} cursor-pointer`} value={medicineId} onChange={event => { setMedicineId(event.target.value); setError(''); }} required disabled={medicines === null && !loadError}>
        <option value="">{medicines === null && !loadError ? 'Loading medicines…' : 'Select medicine'}</option>
        {(medicines || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {loadError && <span role="alert" className="mt-1 block text-xs text-red-600">{loadError}</span>}
      {medicines?.length === 0 && <span className="mt-1 block text-xs text-gray-500">No medicine is in stock. Restock one on the Medicines page first.</span>}
    </label>
    <div>
      <Label required>Quantity</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
        <input className={field} type="number" min="1" step="1" inputMode="numeric" aria-label="Quantity" value={quantity} onChange={event => { setQuantity(event.target.value); setError(''); }} required />
        <select className={field} aria-label="Unit" value={medicine?.unit || ''} disabled>
          <option value="">{medicine ? `${unitLabel(medicine.unit).toLowerCase()}(s)` : 'unit'}</option>
          {medicine && <option value={medicine.unit}>{`${unitLabel(medicine.unit).toLowerCase()}(s)`}</option>}
        </select>
      </div>
      {medicine && <p className={`mt-1 text-xs ${tooMany ? 'font-semibold text-red-600' : 'text-gray-500 dark:text-gray-400'}`} aria-live="polite">
        {tooMany ? `Only ${medicine.quantity} ${medicine.unit} in stock.` : `${medicine.quantity} ${medicine.unit} available${medicine.next_expiry ? ` · stock expires first on ${isoDay(medicine.next_expiry)}` : ''}`}
      </p>}
    </div>
    <label className="block"><Label required>Reason for Dispensing</Label>
      <textarea className={`${field} h-auto resize-none py-2.5`} rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. Headache, fever, muscle pain..." required />
    </label>
    {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
    <div className="flex justify-end gap-3 pt-1">
      {onCancel && <button type="button" onClick={onCancel} disabled={saving} className={`inline-flex h-10 items-center rounded-[10px] border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700 ${focus}`}>Cancel</button>}
      <button type="submit" disabled={!valid || saving} className={`inline-flex h-10 items-center gap-2 rounded-[10px] bg-maroon-800 px-6 text-sm font-semibold text-white hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`}>
        {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Pill size={16} aria-hidden="true" />}{saving ? 'Dispensing…' : 'Dispense'}
      </button>
    </div>
  </form>;
}

// The popup from a faculty member's details: the faculty member is fixed.
export function DispenseModal({ faculty, onClose, onDone }) {
  return <Modal title="Dispense medicine" onClose={onClose}>
    <header className="flex items-center gap-3 px-5 pb-1 pt-5 sm:px-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300"><Pill size={18} aria-hidden="true" /></span>
      <h2 className="min-w-0 flex-1 text-lg font-bold">Dispense Medicine</h2>
      <button type="button" onClick={onClose} aria-label="Close" className={`rounded-[10px] p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 ${focus}`}><X size={18} /></button>
    </header>
    <div className="px-5 pb-5 pt-3 sm:px-6"><DispenseForm faculty={faculty} onDone={onDone} onCancel={onClose} /></div>
  </Modal>;
}
