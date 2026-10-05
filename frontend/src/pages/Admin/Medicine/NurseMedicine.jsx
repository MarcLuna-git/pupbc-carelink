import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Edit2, Trash2, Loader2, Pill, AlertTriangle, Clock, Package, Filter, ChevronDown, ClipboardList, X, History } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';

const isWholeNumberInput = (value) => /^\d*$/.test(value);
const isPositiveWholeNumberInput = (value) => value === '' || /^[1-9]\d*$/.test(value);

const NurseMedicine = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchMedicine, setBatchMedicine] = useState(null);
  const [batchForm, setBatchForm] = useState({ lot_number: '', quantity: '1', expiry_date: '', received_at: '', supplier: '', reference: '' });
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementMedicine, setMovementMedicine] = useState(null);
  const [movementForm, setMovementForm] = useState({ movement_type: 'dispensed', quantity: '1', batch_id: '', reason: '', student_id: '' });
  const [movementError, setMovementError] = useState('');
  const [historyMedicine, setHistoryMedicine] = useState(null);
  const [movementHistory, setMovementHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    fetchMedicines();
  }, [filter]);

  const fetchMedicines = async (searchValue = search) => {
    try {
      setError('');
      setRefreshing(true);
      setLoading(medicines.length === 0);
      const token = localStorage.getItem('token');
      const params = { search: searchValue };
      if (filter === 'low_stock') params.low_stock = true;
      if (filter === 'expiring_soon') params.expiring_soon = true;
      if (filter === 'expired') params.expired = true;

      const response = await api.get('/nurse/medicines', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (response.data.success) {
        const data = response.data.data;
        setMedicines(Array.isArray(data) ? data : (data?.data || []));
      }
    } catch {
      setError('Failed to load medicines.');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      const token = localStorage.getItem('token');
      let response;

      if (editingMedicine) {
        const editableFields = { ...form };
        delete editableFields.quantity;
        response = await api.put(`/nurse/medicines/${editingMedicine.id}`, editableFields, {
          headers: { Authorization: `Bearer ${token}` }
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
    setShowStockModal(true);
  };

  const handleStockUpdate = async () => {
    if (!stockMedicine) return;
    if (!Number.isInteger(Number(stockQuantity)) || Number(stockQuantity) < 1) return;
    setFormLoading(true);

    try {
      const token = localStorage.getItem('token');
      const endpoint = `/nurse/medicines/${stockMedicine.id}/add-stock`;

      const response = await api.post(endpoint, { quantity: stockQuantity }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setMessageType('success');
        setMessage(response.data.message);
        setShowStockModal(false);
        fetchMedicines();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.message || 'Failed to update stock.');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setFormLoading(false);
    }
  };

  const openBatchModal = (medicine) => {
    setBatchMedicine(medicine);
    setBatchForm({ lot_number: '', quantity: '1', expiry_date: '', received_at: '', supplier: '', reference: '' });
    setShowBatchModal(true);
  };

  const handleBatchReceive = async () => {
    if (!batchMedicine) return;
    if (!Number.isInteger(Number(batchForm.quantity)) || Number(batchForm.quantity) < 1) return;
    setFormLoading(true);
    try {
      await api.post(`/nurse/medicines/${batchMedicine.id}/batches`, batchForm);
      setMessageType('success'); setMessage('Batch received successfully.'); setShowBatchModal(false); fetchMedicines();
    } catch (err) {
      setMessageType('error'); setMessage(err.response?.data?.message || 'Failed to receive batch.');
    } finally { setFormLoading(false); }
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
      await api.post(`/nurse/medicines/${movementMedicine.id}/movements`, movementForm);
      setMessageType('success'); setMessage('Stock movement recorded.'); setShowMovementModal(false); fetchMedicines();
    } catch (err) {
      setMovementError(err.response?.data?.message || 'Failed to record movement.');
    } finally { setFormLoading(false); setTimeout(() => setMessage(''), 4000); }
  };

  const handleDelete = async () => {
    if (!deleteMedicine) return;
    setFormLoading(true);
    try {
      const token = localStorage.getItem('token');
      await api.delete(`/nurse/medicines/${deleteMedicine.id}`, {
        headers: { Authorization: `Bearer ${token}` }
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

  const inputClass = "w-full border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-2.5 text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-maroon-500 dark:focus:ring-maroon-300/30 dark:focus:border-maroon-300";
  const labelClass = "text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5";
  const today = new Date();
  const minimumExpiryDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  if (loading) {
    return <NursePageSkeleton variant="cards" label="Loading medicine inventory" />;
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Medicine Inventory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage clinic medicines and supplies</p>
          {refreshing && <p role="status" className="mt-1 text-xs text-gray-500">Updating inventory...</p>}
        </div>
        <button onClick={openAddModal}
          className="flex items-center space-x-2 px-5 py-2.5 bg-maroon-800 text-white rounded-2xl font-semibold text-sm hover:bg-maroon-900 transition">
          <Plus className="w-4 h-4" />
          <span>Add Medicine</span>
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {message && (
        <div className={`p-3 rounded-2xl text-sm text-center ${
          messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>{message}</div>
      )}

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

      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full border border-gray-200 dark:border-gray-600 rounded-2xl pl-10 pr-10 py-2.5 text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-maroon-500 dark:focus:ring-maroon-300/30 dark:focus:border-maroon-300"
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medicines..." />
          {search && <button type="button" onClick={() => { setSearch(''); fetchMedicines(''); }} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X className="h-4 w-4" /></button>}
        </form>
        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select className="border border-gray-200 dark:border-gray-600 rounded-2xl pl-10 pr-8 py-2.5 text-sm dark:bg-gray-700 dark:text-white appearance-none cursor-pointer"
            value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Medicines</option>
            <option value="low_stock">Low Stock</option>
            <option value="expiring_soon">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {medicines.length === 0 ? (
        <div className="text-center py-16">
          <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500">No Medicines Found</h3>
          <p className="text-sm text-gray-400 mt-1">Add medicines to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {medicines.map((med) => {
            const status = getStatusBadge(med);
            return (
              <motion.div key={med.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-maroon-50 dark:bg-maroon-900/20 rounded-xl flex items-center justify-center">
                      <Pill className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{med.name}</h3>
                      {med.generic_name && <p className="text-xs text-gray-400">{med.generic_name}</p>}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                    <status.icon className="w-3 h-3 inline mr-1" />{status.text}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Stock:</span>
                    <span className={`font-semibold ${med.is_low_stock ? 'text-orange-600' : 'text-gray-700 dark:text-gray-200'}`}>
                      {med.quantity} {med.unit}
                    </span>
                  </div>
                  {med.dosage && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Dosage:</span>
                      <span className="text-gray-600 dark:text-gray-300">{med.dosage}</span>
                    </div>
                  )}
                  {med.expiry_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Expiry:</span>
                      <span className={`${med.is_expired ? 'text-red-600 font-semibold' : 'text-gray-600 dark:text-gray-300'}`}>
                        {new Date(med.expiry_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <button onClick={() => openBatchModal(med)} title="Receive batch" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"><Package className="w-3.5 h-3.5" /></button>
                  <button onClick={() => openMovementModal(med)} title="Record stock movement" className="p-1.5 text-gray-400 hover:text-maroon-600 hover:bg-maroon-50 rounded-lg transition"><ClipboardList className="w-3.5 h-3.5" /></button>
                  <button onClick={() => openMovementHistory(med)} title="View stock movement history" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><History className="w-3.5 h-3.5" /></button>
                  <button onClick={() => openStockModal(med)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-xs font-semibold hover:bg-green-100 transition">
                    <Plus className="w-3 h-3" /><span>Add</span>
                  </button>
                  <button onClick={() => openEditModal(med)}
                    className="p-1.5 text-gray-400 hover:text-maroon-600 hover:bg-maroon-50 rounded-lg transition">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setDeleteMedicine(med); setShowDeleteConfirm(true); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              {message && messageType === 'error' && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Medicine Name *</label>
                  <input className={inputClass} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Generic Name</label>
                  <input className={inputClass} value={form.generic_name} onChange={(e) => setForm({...form, generic_name: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <input className={inputClass} value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} placeholder="e.g. Pain Relief" />
                </div>
                <div>
                  <label className={labelClass}>Unit</label>
                  <select className={inputClass} value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})}>
                    <option value="tablet">Tablet</option>
                    <option value="capsule">Capsule</option>
                    <option value="ml">ML</option>
                    <option value="bottle">Bottle</option>
                    <option value="box">Box</option>
                    <option value="piece">Piece</option>
                  </select>
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
                  <input className={inputClass} type="date" min={minimumExpiryDate} value={form.expiry_date} onChange={(e) => setForm({...form, expiry_date: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-2xl font-semibold">Cancel</button>
                <button type="submit" disabled={formLoading} className="flex-1 py-3 bg-maroon-800 text-white rounded-2xl font-semibold flex items-center justify-center disabled:opacity-50">
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span className="ml-2">{editingMedicine ? 'Update' : 'Add'} Medicine</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStockModal && stockMedicine && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Add Stock
            </h2>
            <p className="text-sm text-gray-500 mb-4">{stockMedicine.name} (Current: {stockMedicine.quantity} {stockMedicine.unit})</p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Quantity</label>
                <input className={inputClass} type="number" min="1" step="1" inputMode="numeric" value={stockQuantity} onChange={(e) => { if (isWholeNumberInput(e.target.value)) setStockQuantity(e.target.value); }} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowStockModal(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-2xl font-semibold">Cancel</button>
                <button onClick={handleStockUpdate} disabled={formLoading || !Number.isInteger(Number(stockQuantity)) || Number(stockQuantity) < 1}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-semibold flex items-center justify-center disabled:opacity-50">
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span className="ml-2">Add {stockQuantity} {stockMedicine.unit}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBatchModal && batchMedicine && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Receive Medicine Batch</h2>
            <p className="text-sm text-gray-500 mb-4">{batchMedicine.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2"><span className={labelClass}>Lot/batch number *</span><input className={inputClass} value={batchForm.lot_number} onChange={e => setBatchForm({ ...batchForm, lot_number: e.target.value })} required /></label>
              <label><span className={labelClass}>Quantity *</span><input className={inputClass} type="number" min="1" step="1" inputMode="numeric" value={batchForm.quantity} onChange={e => { if (isWholeNumberInput(e.target.value)) setBatchForm({ ...batchForm, quantity: e.target.value }); }} required /></label>
              <label><span className={labelClass}>Expiry Date</span><input className={inputClass} type="date" min={minimumExpiryDate} value={batchForm.expiry_date} onChange={e => setBatchForm({ ...batchForm, expiry_date: e.target.value })} /></label>
              <label><span className={labelClass}>Received Date</span><input className={inputClass} type="date" value={batchForm.received_at} onChange={e => setBatchForm({ ...batchForm, received_at: e.target.value })} /></label>
              <input className={inputClass} placeholder="Supplier (optional)" value={batchForm.supplier} onChange={e => setBatchForm({ ...batchForm, supplier: e.target.value })} />
              <input className={`${inputClass} col-span-2`} placeholder="Reference (optional)" value={batchForm.reference} onChange={e => setBatchForm({ ...batchForm, reference: e.target.value })} />
            </div>
            <div className="flex gap-3 mt-5"><button onClick={() => setShowBatchModal(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-2xl font-semibold">Cancel</button><button onClick={handleBatchReceive} disabled={formLoading || !batchForm.lot_number.trim()} className="flex-1 py-3 bg-green-600 text-white rounded-2xl font-semibold disabled:opacity-50">{formLoading ? 'Saving...' : 'Receive Batch'}</button></div>
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
