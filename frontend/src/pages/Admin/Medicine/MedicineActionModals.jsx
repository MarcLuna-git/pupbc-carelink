import { useState } from 'react';
import { AlertTriangle, ClipboardList, Loader2, PackagePlus, Trash2, X } from 'lucide-react';
import api from '../../../services/api';
import { Modal } from '../Students/StudentDetailsModal';
import { focus } from '../Students/directoryOptions';
import { formatStudentId } from '../../../utils/inputFilters';

/*
 * The popups for the other things a nurse does to a medicine: Restock (add stock, optionally as a batch
 * with a lot number and expiry date), Record Movement (dispensed, wasted, expired, adjustment), and Delete.
 * They look like the Add Medicine popup.
 */
const field = 'h-11 w-full rounded-[10px] border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-maroon-300/30';
const isWhole = value => /^\d*$/.test(value);
const errorText = (err, fallback) => (err.response?.data?.errors && Object.values(err.response.data.errors).flat()[0]) || err.response?.data?.message || fallback;

const cancelButton = `inline-flex h-10 items-center rounded-[10px] border border-maroon-300 bg-white px-5 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 disabled:opacity-50 dark:border-maroon-700 dark:bg-transparent dark:text-maroon-300 dark:hover:bg-maroon-900/20 ${focus}`;
const confirmButton = `inline-flex h-10 items-center gap-2 rounded-[10px] bg-maroon-800 px-5 text-sm font-semibold text-white hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;

function Header({ icon: Icon, title, subtitle, onClose, tone = 'bg-maroon-800' }) {
  return <header className="flex items-start gap-3 px-5 pb-2 pt-5 sm:px-6">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${tone}`}><Icon size={18} aria-hidden="true" /></span>
    <div className="min-w-0 flex-1"><h2 className="text-lg font-bold">{title}</h2><p className="break-words text-sm text-gray-500 dark:text-gray-400">{subtitle}</p></div>
    <button type="button" onClick={onClose} aria-label="Close" className={`rounded-[10px] p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 ${focus}`}><X size={18} /></button>
  </header>;
}
const Label = ({ children, required }) => <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">{children}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}</span>;
const Footer = ({ children }) => <footer className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:px-6 dark:border-gray-700 dark:bg-gray-900/30">{children}</footer>;

const emptyBatch = { lot_number: '', expiry_date: '', received_at: '', supplier: '', reference: '' };

export function RestockModal({ medicine, timeGuardOff, onClose, onDone }) {
  const [quantity, setQuantity] = useState('1');
  const [byBatch, setByBatch] = useState(false);
  const [batch, setBatch] = useState(emptyBatch);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const valid = Number.isInteger(Number(quantity)) && Number(quantity) >= 1 && (!byBatch || batch.lot_number.trim());
  const close = () => { if (!saving) onClose(); };

  const submit = async event => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true); setError('');
    try {
      if (byBatch) {
        await api.post(`/nurse/medicines/${medicine.id}/batches`, { ...batch, quantity });
        onDone(`Added ${quantity} ${medicine.unit} as batch ${batch.lot_number.trim()}.`);
      } else {
        // The reference (for example a supplier delivery number) is the Reference / Reason in the stock history.
        const { data } = await api.post(`/nurse/medicines/${medicine.id}/add-stock`, { quantity, reason: batch.reference.trim() || undefined });
        onDone(data.message);
      }
    } catch (err) {
      setError(errorText(err, 'Unable to restock this medicine.'));
      setSaving(false);
    }
  };

  return <Modal title="Restock" onClose={close}>
    <form onSubmit={submit} aria-busy={saving}>
      <Header icon={PackagePlus} title="Restock" subtitle={`${medicine.name} · now ${medicine.quantity} ${medicine.unit}`} onClose={close} />
      <div className="space-y-4 px-5 pb-5 pt-3 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><Label required>Quantity to add</Label><input className={field} inputMode="numeric" value={quantity} onChange={event => { if (isWhole(event.target.value)) setQuantity(event.target.value); }} required /></label>
          <label><Label>Reference <span className="font-normal text-gray-400">(Optional)</span></Label><input className={field} value={batch.reference} onChange={event => setBatch({ ...batch, reference: event.target.value })} placeholder="e.g. Supplier Delivery #SD-2026-1015" maxLength={150} /></label>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-gray-200 p-3 dark:border-gray-600">
          <input type="checkbox" className="mt-1 h-4 w-4 cursor-pointer accent-maroon-800" checked={byBatch} onChange={event => setByBatch(event.target.checked)} />
          <span><span className="block text-sm font-semibold">Track this stock by batch</span><span className="block text-xs text-gray-600 dark:text-gray-300">Record the lot number and expiry date. Stock that expires first is used first.</span></span>
        </label>
        {byBatch && <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><Label required>Lot / batch number</Label><input className={field} value={batch.lot_number} onChange={event => setBatch({ ...batch, lot_number: event.target.value })} maxLength={100} required /></label>
          <label><Label>Expiry date</Label><input className={field} type="date" min={timeGuardOff ? undefined : today} value={batch.expiry_date} onChange={event => setBatch({ ...batch, expiry_date: event.target.value })} /></label>
          <label><Label>Received date</Label><input className={field} type="date" value={batch.received_at} onChange={event => setBatch({ ...batch, received_at: event.target.value })} /></label>
          <label className="sm:col-span-2"><Label>Supplier <span className="font-normal text-gray-400">(Optional)</span></Label><input className={field} value={batch.supplier} onChange={event => setBatch({ ...batch, supplier: event.target.value })} maxLength={150} /></label>
        </div>}
        {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
      </div>
      <Footer>
        <button type="button" onClick={close} disabled={saving} className={cancelButton}>Cancel</button>
        <button type="submit" disabled={!valid || saving} className={confirmButton}>{saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <PackagePlus size={16} aria-hidden="true" />}{saving ? 'Saving…' : `Add ${quantity || 0} ${medicine.unit}`}</button>
      </Footer>
    </form>
  </Modal>;
}

const MOVEMENT_TYPES = [['dispensed', 'Dispensed'], ['wasted', 'Wasted'], ['expired', 'Expired'], ['adjustment', 'Adjustment']];

export function MovementModal({ medicine, onClose, onDone }) {
  const [form, setForm] = useState({ movement_type: 'dispensed', quantity: '1', reason: '', student_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dispensing = form.movement_type === 'dispensed';
  const valid = Number.isInteger(Number(form.quantity)) && Number(form.quantity) >= 1 && form.reason.trim() && (!dispensing || form.student_id.trim());
  const close = () => { if (!saving) onClose(); };

  const submit = async event => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true); setError('');
    try {
      const body = { ...form, student_id: dispensing ? form.student_id.trim() : undefined };
      const { data } = await api.post(`/nurse/medicines/${medicine.id}/movements`, body, { headers: { 'If-Match': medicine.sync_version } });
      // Stock goes out first-expiry, first-out; say which batches were used.
      const used = (data.allocations || []).filter(item => item.lot_number).map(item => `${item.lot_number} ×${item.quantity}`).join(', ');
      onDone(used ? `Stock movement recorded. Taken from ${used}.` : 'Stock movement recorded.');
    } catch (err) {
      setError(errorText(err, 'Unable to record the movement.'));
      setSaving(false);
    }
  };

  return <Modal title="Record stock movement" onClose={close}>
    <form onSubmit={submit} aria-busy={saving}>
      <Header icon={ClipboardList} title="Record Stock Movement" subtitle={`${medicine.name} · ${medicine.quantity} ${medicine.unit} in stock`} onClose={close} />
      <div className="space-y-4 px-5 pb-5 pt-3 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><Label required>Movement type</Label>
            <select className={`${field} cursor-pointer`} value={form.movement_type} onChange={event => { setForm({ ...form, movement_type: event.target.value }); setError(''); }}>{MOVEMENT_TYPES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
          </label>
          <label><Label required>Quantity</Label><input className={field} inputMode="numeric" value={form.quantity} onChange={event => { if (isWhole(event.target.value)) setForm({ ...form, quantity: event.target.value }); }} required /></label>
        </div>
        {dispensing && <label className="block"><Label required>Student ID</Label><input className={field} value={form.student_id} onChange={event => { setForm({ ...form, student_id: formatStudentId(event.target.value) }); setError(''); }} placeholder="2023-00000-BN-0" required /></label>}
        <label className="block"><Label required>Reason</Label><textarea className={`${field} h-auto resize-none py-2.5`} rows={3} maxLength={500} value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} placeholder="e.g. Damaged stock" required /></label>
        {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
      </div>
      <Footer>
        <button type="button" onClick={close} disabled={saving} className={cancelButton}>Cancel</button>
        <button type="submit" disabled={!valid || saving} className={confirmButton}>{saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{saving ? 'Saving…' : 'Record Movement'}</button>
      </Footer>
    </form>
  </Modal>;
}

export function DeleteModal({ medicine, onClose, onDone }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!saving) onClose(); };

  const remove = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      await api.delete(`/nurse/medicines/${medicine.id}`, { headers: { 'If-Match': medicine.sync_version } });
      onDone('Medicine deleted.');
    } catch (err) {
      setError(errorText(err, 'Unable to delete the medicine.'));
      setSaving(false);
    }
  };

  return <Modal title="Delete medicine" onClose={close}>
    <Header icon={Trash2} tone="bg-red-600" title="Delete Medicine?" subtitle="This removes it from the inventory. It cannot be undone." onClose={close} />
    <div className="space-y-3 px-5 pb-5 pt-3 sm:px-6">
      <p className="flex items-start gap-2 rounded-[10px] bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><span>Delete <strong>{medicine.name}</strong>{medicine.quantity > 0 ? ` (${medicine.quantity} ${medicine.unit} still in stock)` : ''}?</span></p>
      {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
    </div>
    <Footer>
      <button type="button" onClick={close} disabled={saving} className={cancelButton}>Cancel</button>
      <button type="button" onClick={remove} disabled={saving} className={`inline-flex h-10 items-center gap-2 rounded-[10px] bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 ${focus}`}>{saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{saving ? 'Deleting…' : 'Delete'}</button>
    </Footer>
  </Modal>;
}
