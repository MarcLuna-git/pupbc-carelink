import { getToken } from '../../../services/session';
import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, Loader2, AlertTriangle, Clock, Package, Filter, ChevronDown, ClipboardList, X, History, Save, FilePenLine, BriefcaseMedical, Boxes, Tablets, PackagePlus } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageTitle from '../../../components/NursePageTitle';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import useNurseSync from '../../../hooks/useNurseSync';
import { useNurseTimeGuardBypass } from '../../../services/devTools';
import { NurseToast } from '../../../components/NurseFeedback';

const EMPTY_BATCH = { lot_number: '', expiry_date: '', received_at: '', supplier: '', reference: '' };

const formatDate = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const isWholeNumberInput = (value) => /^\d*$/.test(value);
const isPositiveWholeNumberInput = (value) => value === '' || /^[1-9]\d*$/.test(value);

const NurseMedicine = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const [showModal, setShowModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', generic_name: '', category: '', quantity: '',
    minimum_stock: 10, unit: 'tablet', dosage: '', expiry_date: '', description: ''
  });

  const [showStockModal, setShowStockModal] = useState(false);
  const [stockMedicine, setStockMedicine] = useState(null);
  const [stockQuantity, setStockQuantity] = useState('1');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMedicine, setDeleteMedicine] = useState(null);
  // One "Add stock" dialog: with `stockByBatch` the stock is received as a batch (lot number, expiry date),
  // so the clinic can use the earliest-expiring stock first; otherwise only the quantity is added.
  const [stockByBatch, setStockByBatch] = useState(false);
  const [batchForm, setBatchForm] = useState(EMPTY_BATCH);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementMedicine, setMovementMedicine] = useState(null);
  const [movementForm, setMovementForm] = useState({ movement_type: 'dispensed', quantity: '1', batch_id: '', reason: '', student_id: '' });
  const [movementError, setMovementError] = useState('');
  const [historyMedicine, setHistoryMedicine] = useState(null);
  const [movementHistory, setMovementHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const medicineRequest = useRef(0);
  const composerRef = useRef(null);
  // Developer Tools → Remove time Guard: past expiry dates become selectable.
  const timeGuardOff = useNurseTimeGuardBypass();

  useNurseSync(['medicines'], async signal => {
    await fetchMedicines(search, true, signal);
    if (historyMedicine) {
      const response = await api.get(`/nurse/medicines/${historyMedicine.id}/movements`, { signal });
      setMovementHistory(response.data.data?.data || []);
    }
  }, JSON.stringify([filter, search, historyMedicine?.id]));

  useEffect(() => {
    fetchMedicines();
  }, [filter]);

  const fetchMedicines = async (searchValue = search, silent = false, signal) => {
    const request = ++medicineRequest.current;
    try {
      setError('');
      if (!silent) setLoading(medicines.length === 0);
      const token = getToken('nurse');
      const params = { search: searchValue };
      if (filter === 'low_stock') params.low_stock = true;
      if (filter === 'expiring_soon') params.expiring_soon = true;
      if (filter === 'expired') params.expired = true;

      const response = await api.get('/nurse/medicines', {
        headers: { Authorization: `Bearer ${token}` },
        params, signal
      });

      if (request !== medicineRequest.current || signal?.aborted) return;
      if (response.data.success) {
        const data = response.data.data;
        setMedicines(Array.isArray(data) ? data : (data?.data || []));
      }
    } catch (err) {
      if (signal?.aborted) return;
      if (silent) throw err;
      setError('Failed to load medicines.');
    } finally {
      if (request === medicineRequest.current) { setLoading(false); }
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchMedicines();
  };

  const openAddModal = () => {
    setMessage('');
    setEditingMedicine(null);
    setForm({ name: '', generic_name: '', category: '', quantity: '', minimum_stock: 10, unit: 'tablet', dosage: '', expiry_date: '', description: '' });
    setShowModal(true);
  };

  const openEditModal = (medicine) => {
    setMessage('');
    setEditingMedicine(medicine);
    setForm({
      name: medicine.name || '',
      generic_name: medicine.generic_name || '',
      category: medicine.category || '',
      minimum_stock: medicine.minimum_stock ?? 10,
      unit: medicine.unit || 'tablet',
      dosage: medicine.dosage || '',
      expiry_date: medicine.expiry_date ? medicine.expiry_date.split('T')[0] : '',
      description: medicine.description || ''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingMedicine && (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 1)) {
      setMessageType('error');
      setMessage('Quantity must be a whole number greater than zero.');
      return;
    }
    setFormLoading(true);

    try {
      const token = getToken('nurse');
      let response;

      if (editingMedicine) {
        const editableFields = { ...form };
        delete editableFields.quantity;
        response = await api.put(`/nurse/medicines/${editingMedicine.id}`, editableFields, {
          headers: { Authorization: `Bearer ${token}`, 'If-Match': editingMedicine.sync_version }
        });
      } else {
        response = await api.post('/nurse/medicines', form, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (response.data.success) {
        setMessageType('success');
        setMessage(editingMedicine ? 'Medicine updated!' : 'Medicine added!');
        setShowModal(false);
        fetchMedicines();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessageType('error');
      const errors = err.response?.data?.errors;
      const fieldError = errors ? Object.values(errors).flat()[0] : null;
      setMessage(fieldError || err.response?.data?.message || 'Failed to save medicine.');
    } finally {
      setFormLoading(false);
    }
  };

  const openStockModal = (medicine) => {
    setStockMedicine(medicine);
    setStockQuantity('1');
    setStockByBatch(false);
    setBatchForm(EMPTY_BATCH);
    setShowStockModal(true);
  };

  const handleStockUpdate = async () => {
    if (!stockMedicine) return;
    if (!Number.isInteger(Number(stockQuantity)) || Number(stockQuantity) < 1) return;
    if (stockByBatch && !batchForm.lot_number.trim()) return;
    setFormLoading(true);

    try {
      const token = getToken('nurse');
      const headers = { Authorization: `Bearer ${token}` };
      let response;

      if (stockByBatch) {
        response = await api.post(`/nurse/medicines/${stockMedicine.id}/batches`, { ...batchForm, quantity: stockQuantity }, { headers });
        setMessage(`Added ${stockQuantity} ${stockMedicine.unit} as batch ${batchForm.lot_number.trim()}.`);
      } else {
        response = await api.post(`/nurse/medicines/${stockMedicine.id}/add-stock`, { quantity: stockQuantity }, { headers });
        setMessage(response.data.message);
      }

      if (response.data.success) {
        setMessageType('success');
        setShowStockModal(false);
        fetchMedicines();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessageType('error');
      const errors = err.response?.data?.errors;
      setMessage((errors && Object.values(errors).flat()[0]) || err.response?.data?.message || 'Failed to update stock.');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setFormLoading(false);
    }
  };

  const openMovementHistory = async (medicine) => {
    setHistoryMedicine(medicine);
    setMovementHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const response = await api.get(`/nurse/medicines/${medicine.id}/movements`);
      const data = response.data?.data;
      setMovementHistory(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
      setHistoryError(err.response?.data?.message || 'Failed to load stock movement history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openMovementModal = (medicine) => {
    setMovementMedicine(medicine);
    setMovementForm({ movement_type: 'dispensed', quantity: '1', batch_id: '', reason: '', student_id: '' });
    setMovementError('');
    setShowMovementModal(true);
  };

  const handleMovement = async () => {
    if (!movementMedicine || !movementForm.reason.trim() || !Number.isInteger(Number(movementForm.quantity)) || Number(movementForm.quantity) < 1) return;
    if (movementForm.movement_type === 'dispensed' && !movementForm.student_id.trim()) {
      setMovementError('Enter the Student ID to record who received the medicine.');
      return;
    }
    setFormLoading(true);
    setMovementError('');
    try {
      const response = await api.post(`/nurse/medicines/${movementMedicine.id}/movements`, movementForm, { headers: { 'If-Match': movementMedicine.sync_version } });
      // Stock goes out first-expiry, first-out; say which batches were used.
      const used = (response.data.allocations || []).filter((item) => item.lot_number)
        .map((item) => `${item.lot_number} ×${item.quantity}`).join(', ');
      setMessageType('success'); setMessage(used ? `Stock movement recorded. Taken from ${used}.` : 'Stock movement recorded.'); setShowMovementModal(false); fetchMedicines();
    } catch (err) {
      setMovementError(err.response?.data?.message || 'Failed to record movement.');
    } finally { setFormLoading(false); setTimeout(() => setMessage(''), 4000); }
  };

  const handleDelete = async () => {
    if (!deleteMedicine) return;
    setFormLoading(true);
    try {
      const token = getToken('nurse');
      await api.delete(`/nurse/medicines/${deleteMedicine.id}`, {
        headers: { Authorization: `Bearer ${token}`, 'If-Match': deleteMedicine.sync_version }
      });

      setMessageType('success');
      setMessage('Medicine deleted.');
      setShowDeleteConfirm(false);
      setDeleteMedicine(null);
      fetchMedicines();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.message || 'Failed to delete medicine.');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setFormLoading(false);
    }
  };

  const getStatusBadge = (medicine) => {
    if (medicine.is_expired) return { color: 'bg-red-100 text-red-700', text: 'Expired', icon: AlertTriangle };
    if (medicine.is_low_stock) return { color: 'bg-orange-100 text-orange-700', text: 'Low Stock', icon: AlertTriangle };
    if (medicine.is_expiring_soon) return { color: 'bg-yellow-100 text-yellow-700', text: 'Expiring Soon', icon: Clock };
    return { color: 'bg-green-100 text-green-700', text: 'OK', icon: Package };
  };

  const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-maroon-300/30 dark:focus:border-maroon-300";
  const labelClass = "text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5";
  const today = new Date();
  const minimumExpiryDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // The add / edit form is a permanent card. Closing it (Cancel, or a
  // successful save) resets it to an empty "add" form and keeps it open.
  useEffect(() => {
    if (showModal) return;
    setEditingMedicine(null);
    setForm({ name: '', generic_name: '', category: '', quantity: '', minimum_stock: 10, unit: 'tablet', dosage: '', expiry_date: '', description: '' });
    setShowModal(true);
  }, [showModal]);

  // Editing a medicine lower in the list brings the form card into view.
  useEffect(() => {
    if (editingMedicine) composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingMedicine?.id]);

  if (loading) {
    return <NursePageSkeleton variant="cards" label="Loading medicine inventory" />;
  }

  const selectClass = `${inputClass} cursor-pointer appearance-none pr-10`;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <NursePageTitle path="/nurse/medicines" />

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-center text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

      {/* Action results show as a floating toast */}
      <NurseToast message={message} type={messageType} onClose={() => setMessage('')} />

      {historyMedicine && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Stock Movement History</h2>
                <p className="mt-1 text-sm text-gray-500">{historyMedicine.name}</p>
              </div>
              <button type="button" onClick={() => setHistoryMedicine(null)} aria-label="Close history" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {historyLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-maroon-600" /></div>
            ) : historyError ? (
              <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{historyError}</p>
            ) : movementHistory.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">No stock movements recorded yet.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {movementHistory.map((movement) => (
                  <article key={movement.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold capitalize text-gray-900 dark:text-white">{movement.movement_type.replaceAll('_', ' ')} · {movement.quantity} {historyMedicine.unit}</p>
                      <time className="text-xs text-gray-400">{new Date(movement.created_at).toLocaleString()}</time>
                    </div>
                    {movement.student && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Student: {movement.student.first_name} {movement.student.last_name} ({movement.student.student_id})</p>}
                    {movement.reason && <p className="mt-1 text-xs text-gray-500">{movement.reason}</p>}
                    {movement.performer && <p className="mt-1 text-xs text-gray-400">Recorded by {movement.performer.first_name} {movement.performer.last_name}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / edit form: a permanent card with its own heading. */}
      <section
        ref={composerRef}
        aria-labelledby="medicine-form-title"
        className={`scroll-mt-4 overflow-hidden rounded-lg border bg-white dark:bg-gray-800 ${
          editingMedicine ? 'border-maroon-200 dark:border-maroon-900/50' : 'border-gray-100 dark:border-gray-700'
        }`}
      >
        <header className="flex items-start gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-700 lg:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-400">
            {editingMedicine ? <FilePenLine className="h-5 w-5" /> : <BriefcaseMedical className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h2 id="medicine-form-title" className="font-bold text-gray-900 dark:text-white">
              {editingMedicine ? `Edit ${editingMedicine.name}` : 'Register a Medicine'}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {editingMedicine
                ? 'Update the medicine details. Stock levels change through Add stock, batches, and movements.'
                : 'Add a new medicine or supply to the clinic inventory with its starting stock.'}
            </p>
          </div>
        </header>

        <form onSubmit={handleSave} className="space-y-4 p-4 lg:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Medicine Name *</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Generic Name</label>
              <input className={inputClass} value={form.generic_name} onChange={(e) => setForm({...form, generic_name: e.target.value})} />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <input className={inputClass} value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} placeholder="e.g. Pain Relief" />
            </div>
            <div>
              <label className={labelClass}>Unit</label>
              <div className="relative">
                <select className={selectClass} value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})}>
                  <option value="tablet">Tablet</option>
                  <option value="capsule">Capsule</option>
                  <option value="ml">ML</option>
                  <option value="bottle">Bottle</option>
                  <option value="box">Box</option>
                  <option value="piece">Piece</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            {!editingMedicine && (
              <div>
                <label className={labelClass}>Quantity *</label>
                <input className={inputClass} type="text" inputMode="numeric" pattern="[1-9][0-9]*" value={form.quantity} onChange={(e) => { if (isPositiveWholeNumberInput(e.target.value)) setForm({...form, quantity: e.target.value}); }} required />
              </div>
            )}
            <div>
              <label className={labelClass}>Min Stock Alert</label>
              <input className={inputClass} type="number" min="0" step="1" inputMode="numeric" value={form.minimum_stock} onChange={(e) => { if (isWholeNumberInput(e.target.value)) setForm({...form, minimum_stock: e.target.value}); }} />
            </div>
            <div>
              <label className={labelClass}>Dosage</label>
              <input className={inputClass} value={form.dosage} onChange={(e) => setForm({...form, dosage: e.target.value})} placeholder="e.g. 500mg" />
            </div>
            <div>
              <label className={labelClass}>Expiry Date</label>
              <input className={inputClass} type="date" min={timeGuardOff ? undefined : minimumExpiryDate} value={form.expiry_date} onChange={(e) => setForm({...form, expiry_date: e.target.value})} />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {(editingMedicine || form.name || form.generic_name || form.quantity) && (
              <button type="button" onClick={() => setShowModal(false)}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50">
                <X className="h-4 w-4" />
                {editingMedicine ? 'Cancel edit' : 'Clear'}
              </button>
            )}
            <button type="submit" disabled={formLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-maroon-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-900 disabled:opacity-50">
              {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{editingMedicine ? 'Update Medicine' : 'Save Medicine'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Inventory card: its own heading, search and filter, and the medicines in a nested panel. */}
      <NurseListCard
        aria-label="Medicine inventory"
        icon={Boxes}
        title={<>Inventory<CountChip>{medicines.length}</CountChip></>}
        description="Stock levels and expiry for every medicine, with stock actions on each row."
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row">
            <form onSubmit={handleSearch} className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input className={`${inputClass} py-2.5 pl-10 pr-10`}
                value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medicines..." aria-label="Search medicines" />
              {search && <button type="button" onClick={() => { setSearch(''); fetchMedicines(''); }} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X className="h-4 w-4" /></button>}
            </form>
            <div className="relative sm:w-48">
              <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select aria-label="Filter medicines" className={`${selectClass} py-2.5 pl-10`}
                value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Medicines</option>
                <option value="low_stock">Low Stock</option>
                <option value="expiring_soon">Expiring Soon</option>
                <option value="expired">Expired</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        }
      >
        <div className="p-3 sm:p-4">
          {medicines.length === 0 ? (
            <div className="py-14 text-center">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50">
                <Boxes className="h-8 w-8 text-gray-300 dark:text-gray-500" />
              </span>
              <h3 className="text-base font-semibold text-gray-600 dark:text-gray-300">No Medicines Found</h3>
              <p className="mt-1 text-sm text-gray-400">{search || filter !== 'all' ? 'Try a different search or filter.' : 'Use the form above to register the first medicine.'}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-700">
              <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_17rem] items-center gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300 md:grid">
                <span>Medicine</span>
                <span>Stock</span>
                <span>Next expiry</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {medicines.map((med) => {
                  const status = getStatusBadge(med);
                  return (
                    <li key={med.id}
                      className={`grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 transition-colors md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_17rem] md:items-center ${
                        editingMedicine?.id === med.id
                          ? 'bg-maroon-50/60 dark:bg-maroon-900/10'
                          : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700/40'
                      }`}>
                      <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300">
                          <Tablets className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{med.name}</h3>
                          {(med.generic_name || med.dosage) && (
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{[med.generic_name, med.dosage].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-sm">
                        <span className="block text-xs text-gray-500 md:hidden">Stock</span>
                        <span className={`font-semibold ${med.is_low_stock ? 'text-orange-700 dark:text-orange-300' : 'text-gray-800 dark:text-gray-100'}`}>{med.quantity} {med.unit}</span>
                      </div>

                      <div className="text-sm">
                        <span className="block text-xs text-gray-500 md:hidden">Next expiry</span>
                        {med.next_expiry ? (
                          <span className={med.is_expired ? 'font-semibold text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-200'}>{formatDate(med.next_expiry)}</span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">No expiry set</span>
                        )}
                        {med.batch_count > 0 && <span className="block text-xs text-gray-500 dark:text-gray-400">{med.batch_count} {med.batch_count === 1 ? 'batch' : 'batches'} in stock</span>}
                      </div>

                      <div>
                        <span className="block text-xs text-gray-500 md:hidden">Status</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}>
                          <status.icon className="h-3 w-3" aria-hidden="true" />{status.text}
                        </span>
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-1 md:col-span-1">
                        <button onClick={() => openStockModal(med)}
                          className="mr-auto inline-flex cursor-pointer items-center gap-1 rounded-lg bg-maroon-50 px-3 py-2 text-xs font-semibold text-maroon-800 transition hover:bg-maroon-100 dark:bg-maroon-900/30 dark:text-maroon-300 dark:hover:bg-maroon-900/50 md:mr-0">
                          <PackagePlus className="h-3.5 w-3.5" aria-hidden="true" /><span>Add stock</span>
                        </button>
                        <button onClick={() => openMovementModal(med)} title="Record stock movement" aria-label="Record stock movement" className="cursor-pointer rounded-lg p-2 text-gray-500 transition hover:bg-maroon-50 hover:text-maroon-800 dark:text-gray-400 dark:hover:bg-maroon-900/30 dark:hover:text-maroon-300"><ClipboardList className="h-4 w-4" /></button>
                        <button onClick={() => openMovementHistory(med)} title="View stock movement history" aria-label="View stock movement history" className="cursor-pointer rounded-lg p-2 text-gray-500 transition hover:bg-maroon-50 hover:text-maroon-800 dark:text-gray-400 dark:hover:bg-maroon-900/30 dark:hover:text-maroon-300"><History className="h-4 w-4" /></button>
                        <button onClick={() => openEditModal(med)} title="Edit medicine" aria-label="Edit medicine" className="cursor-pointer rounded-lg p-2 text-gray-500 transition hover:bg-maroon-50 hover:text-maroon-800 dark:text-gray-400 dark:hover:bg-maroon-900/30 dark:hover:text-maroon-300"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => { setDeleteMedicine(med); setShowDeleteConfirm(true); }} title="Delete medicine" aria-label="Delete medicine" className="cursor-pointer rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-700 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </NurseListCard>

      {showStockModal && stockMedicine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="add-stock-title">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 dark:bg-gray-800">
            <h2 id="add-stock-title" className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Add Stock</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{stockMedicine.name} (Current: {stockMedicine.quantity} {stockMedicine.unit})</p>
            <div className="space-y-4">
              <label className="block">
                <span className={labelClass}>Quantity *</span>
                <input className={inputClass} type="number" min="1" step="1" inputMode="numeric" value={stockQuantity} onChange={(e) => { if (isWholeNumberInput(e.target.value)) setStockQuantity(e.target.value); }} />
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                <input type="checkbox" className="mt-1 h-4 w-4 cursor-pointer accent-maroon-800" checked={stockByBatch} onChange={(e) => setStockByBatch(e.target.checked)} />
                <span>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white">Track this stock by batch</span>
                  <span className="block text-xs text-gray-600 dark:text-gray-300">Record the lot number and expiry date. Stock that expires first is used first.</span>
                </span>
              </label>

              {stockByBatch && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2"><span className={labelClass}>Lot/batch number *</span><input className={inputClass} value={batchForm.lot_number} onChange={(e) => setBatchForm({ ...batchForm, lot_number: e.target.value })} required /></label>
                  <label><span className={labelClass}>Expiry date</span><input className={inputClass} type="date" min={timeGuardOff ? undefined : minimumExpiryDate} value={batchForm.expiry_date} onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })} /></label>
                  <label><span className={labelClass}>Received date</span><input className={inputClass} type="date" value={batchForm.received_at} onChange={(e) => setBatchForm({ ...batchForm, received_at: e.target.value })} /></label>
                  <label><span className={labelClass}>Supplier (optional)</span><input className={inputClass} value={batchForm.supplier} onChange={(e) => setBatchForm({ ...batchForm, supplier: e.target.value })} /></label>
                  <label><span className={labelClass}>Reference (optional)</span><input className={inputClass} value={batchForm.reference} onChange={(e) => setBatchForm({ ...batchForm, reference: e.target.value })} /></label>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowStockModal(false)} className="flex-1 cursor-pointer rounded-xl bg-gray-100 py-3 font-semibold text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600">Cancel</button>
                <button onClick={handleStockUpdate} disabled={formLoading || !Number.isInteger(Number(stockQuantity)) || Number(stockQuantity) < 1 || (stockByBatch && !batchForm.lot_number.trim())}
                  className="flex flex-1 cursor-pointer items-center justify-center rounded-xl bg-maroon-800 py-3 font-semibold text-white hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-50">
                  {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span className="ml-2">Add {stockQuantity || 0} {stockMedicine.unit}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMovementModal && movementMedicine && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Record Stock Movement</h2>
            <p className="text-sm text-gray-500 mb-4">{movementMedicine.name}</p>
            <div className="space-y-3">
              <label><span className={labelClass}>Movement Type</span><select className={inputClass} value={movementForm.movement_type} onChange={e => { setMovementForm({ ...movementForm, movement_type: e.target.value }); setMovementError(''); }}><option value="dispensed">Dispensed</option><option value="wasted">Wasted</option><option value="expired">Expired</option><option value="adjustment">Adjustment</option></select></label>
              <label><span className={labelClass}>Quantity *</span><input className={inputClass} type="number" min="1" step="1" inputMode="numeric" value={movementForm.quantity} onChange={e => { if (isWholeNumberInput(e.target.value)) setMovementForm({ ...movementForm, quantity: e.target.value }); }} required /></label>
              {movementForm.movement_type === 'dispensed' && <label><span className={labelClass}>Student ID *</span><input className={inputClass} value={movementForm.student_id} onChange={e => { setMovementForm({ ...movementForm, student_id: e.target.value }); setMovementError(''); }} placeholder="2023-00000-BN-0" required /></label>}
              <textarea className={inputClass} rows={3} placeholder="Reason *" value={movementForm.reason} onChange={e => setMovementForm({ ...movementForm, reason: e.target.value })} required />
            </div>
            {movementError && <p role="alert" className="mt-3 text-sm text-red-600">{movementError}</p>}
            <div className="flex gap-3 mt-5"><button onClick={() => setShowMovementModal(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-2xl font-semibold">Cancel</button><button onClick={handleMovement} disabled={formLoading || !movementForm.reason.trim() || !Number.isInteger(Number(movementForm.quantity)) || Number(movementForm.quantity) < 1 || (movementForm.movement_type === 'dispensed' && !movementForm.student_id.trim())} className="flex-1 py-3 bg-maroon-800 text-white rounded-2xl font-semibold disabled:opacity-50">{formLoading ? 'Saving...' : 'Record Movement'}</button></div>
          </div>
        </div>
      )}

      {showDeleteConfirm && deleteMedicine && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Medicine?</h2>
            <p className="text-sm text-gray-500 mb-4">Are you sure you want to delete <strong>{deleteMedicine.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteMedicine(null); }} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-2xl font-semibold">Cancel</button>
              <button onClick={handleDelete} disabled={formLoading} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {formLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {formLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NurseMedicine;
