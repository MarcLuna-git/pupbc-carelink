import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Minus, Edit2, Trash2, Loader2, Pill, AlertTriangle, Clock, Package, Filter, ChevronDown, ClipboardList } from 'lucide-react';
import api from '../../../services/api';

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
    name: '', generic_name: '', category: '', quantity: 0,
    minimum_stock: 10, unit: 'tablet', dosage: '', expiry_date: '', description: ''
  });

  const [showStockModal, setShowStockModal] = useState(false);
  const [stockMedicine, setStockMedicine] = useState(null);
  const [stockAction, setStockAction] = useState('add');
  const [stockQuantity, setStockQuantity] = useState(1);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMedicine, setDeleteMedicine] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchMedicine, setBatchMedicine] = useState(null);
  const [batchForm, setBatchForm] = useState({ lot_number: '', quantity: 1, expiry_date: '', received_at: '', supplier: '', reference: '' });
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementMedicine, setMovementMedicine] = useState(null);
  const [movementForm, setMovementForm] = useState({ movement_type: 'dispensed', quantity: 1, batch_id: '', reason: '' });

  useEffect(() => {
    fetchMedicines();
  }, [filter]);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = { search };
      if (filter === 'low_stock') params.low_stock = true;
      if (filter === 'expiring_soon') params.expiring_soon = true;
      
      const response = await api.get('/nurse/medicines', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      if (response.data.success) {
        const data = response.data.data;
        setMedicines(Array.isArray(data) ? data : (data?.data || []));
      }
    } catch (err) {
      setError('Failed to load medicines.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchMedicines();
  };

  const openAddModal = () => {
    setEditingMedicine(null);
    setForm({ name: '', generic_name: '', category: '', quantity: 0, minimum_stock: 10, unit: 'tablet', dosage: '', expiry_date: '', description: '' });
    setShowModal(true);
  };

  const openEditModal = (medicine) => {
    setEditingMedicine(medicine);
    setForm({
      name: medicine.name || '',
      generic_name: medicine.generic_name || '',
      category: medicine.category || '',
      quantity: medicine.quantity || 0,
      minimum_stock: medicine.minimum_stock || 10,
      unit: medicine.unit || 'tablet',
      dosage: medicine.dosage || '',
      expiry_date: medicine.expiry_date ? medicine.expiry_date.split('T')[0] : '',
      description: medicine.description || ''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      let response;
      
      if (editingMedicine) {
        response = await api.put(`/nurse/medicines/${editingMedicine.id}`, form, {
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
      setMessage(err.response?.data?.message || 'Failed to save medicine.');
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setFormLoading(false);
    }
  };

  const openStockModal = (medicine, action) => {
    setStockMedicine(medicine);
    setStockAction(action);
    setStockQuantity(1);
    setShowStockModal(true);
  };

  const handleStockUpdate = async () => {
    if (!stockMedicine) return;
    setFormLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const endpoint = stockAction === 'add' 
        ? `/nurse/medicines/${stockMedicine.id}/add-stock`
        : `/nurse/medicines/${stockMedicine.id}/reduce-stock`;
      
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
    setBatchForm({ lot_number: '', quantity: 1, expiry_date: '', received_at: '', supplier: '', reference: '' });
    setShowBatchModal(true);
  };

  const handleBatchReceive = async () => {
    if (!batchMedicine) return;
    setFormLoading(true);
    try {
      await api.post(`/nurse/medicines/${batchMedicine.id}/batches`, batchForm);
      setMessageType('success'); setMessage('Batch received successfully.'); setShowBatchModal(false); fetchMedicines();
    } catch (err) {
      setMessageType('error'); setMessage(err.response?.data?.message || 'Failed to receive batch.');
    } finally { setFormLoading(false); setTimeout(() => setMessage(''), 4000); }
  };

  const openMovementModal = (medicine) => {
    setMovementMedicine(medicine);
    setMovementForm({ movement_type: 'dispensed', quantity: 1, batch_id: '', reason: '' });
    setShowMovementModal(true);
  };

  const handleMovement = async () => {
    if (!movementMedicine || !movementForm.reason.trim()) return;
    setFormLoading(true);
    try {
      await api.post(`/nurse/medicines/${movementMedicine.id}/movements`, movementForm);
      setMessageType('success'); setMessage('Stock movement recorded.'); setShowMovementModal(false); fetchMedicines();
    } catch (err) {
      setMessageType('error'); setMessage(err.response?.data?.message || 'Failed to record movement.');
    } finally { setFormLoading(false); setTimeout(() => setMessage(''), 4000); }
  };

  const handleDelete = async () => {
    if (!deleteMedicine) return;
    
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
      setMessage('Failed to delete medicine.');
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const getStatusBadge = (medicine) => {
    if (medicine.is_expired) return { color: 'bg-red-100 text-red-700', text: 'Expired', icon: AlertTriangle };
    if (medicine.is_low_stock) return { color: 'bg-orange-100 text-orange-700', text: 'Low Stock', icon: AlertTriangle };
    if (medicine.is_expiring_soon) return { color: 'bg-yellow-100 text-yellow-700', text: 'Expiring Soon', icon: Clock };
    return { color: 'bg-green-100 text-green-700', text: 'OK', icon: Package };
  };

  const inputClass = "w-full border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-2.5 text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-maroon-500";
  const labelClass = "text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5";

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-maroon-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Medicine Inventory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage clinic medicines and supplies</p>
        </div>
        <button onClick={openAddModal}
          className="flex items-center space-x-2 px-5 py-2.5 bg-maroon-800 text-white rounded-2xl font-semibold text-sm hover:bg-maroon-900 transition">
          <Plus className="w-4 h-4" />
          <span>Add Medicine</span>
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-2xl text-sm text-center ${
          messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>{message}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full border border-gray-200 dark:border-gray-600 rounded-2xl pl-10 pr-4 py-2.5 text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-maroon-500"
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medicines..." />
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
                  <button onClick={() => openStockModal(med, 'add')}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-xs font-semibold hover:bg-green-100 transition">
                    <Plus className="w-3 h-3" /><span>Add</span>
                  </button>
                  <button onClick={() => openStockModal(med, 'reduce')}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg text-xs font-semibold hover:bg-orange-100 transition">
                    <Minus className="w-3 h-3" /><span>Use</span>
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
                <div>
                  <label className={labelClass}>Quantity *</label>
                  <input className={inputClass} type="number" min="0" value={form.quantity} onChange={(e) => setForm({...form, quantity: parseInt(e.target.value) || 0})} required />
                </div>
                <div>
                  <label className={labelClass}>Min Stock Alert</label>
                  <input className={inputClass} type="number" min="0" value={form.minimum_stock} onChange={(e) => setForm({...form, minimum_stock: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className={labelClass}>Dosage</label>
                  <input className={inputClass} value={form.dosage} onChange={(e) => setForm({...form, dosage: e.target.value})} placeholder="e.g. 500mg" />
                </div>
                <div>
                  <label className={labelClass}>Expiry Date</label>
                  <input className={inputClass} type="date" value={form.expiry_date} onChange={(e) => setForm({...form, expiry_date: e.target.value})} />
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
              {stockAction === 'add' ? 'Add Stock' : 'Use/Reduce Stock'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">{stockMedicine.name} (Current: {stockMedicine.quantity} {stockMedicine.unit})</p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Quantity</label>
                <input className={inputClass} type="number" min="1" value={stockQuantity} onChange={(e) => setStockQuantity(parseInt(e.target.value) || 1)} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowStockModal(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-2xl font-semibold">Cancel</button>
                <button onClick={handleStockUpdate} disabled={formLoading}
                  className={`flex-1 py-3 text-white rounded-2xl font-semibold flex items-center justify-center disabled:opacity-50 ${stockAction === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : stockAction === 'add' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  <span className="ml-2">{stockAction === 'add' ? 'Add' : 'Remove'} {stockQuantity} {stockMedicine.unit}</span>
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
              <input className={`${inputClass} col-span-2`} placeholder="Lot/batch number *" value={batchForm.lot_number} onChange={e => setBatchForm({ ...batchForm, lot_number: e.target.value })} required />
              <input className={inputClass} type="number" min="1" placeholder="Quantity" value={batchForm.quantity} onChange={e => setBatchForm({ ...batchForm, quantity: Number(e.target.value) || 1 })} required />
              <input className={inputClass} type="date" value={batchForm.expiry_date} onChange={e => setBatchForm({ ...batchForm, expiry_date: e.target.value })} />
              <input className={inputClass} type="date" value={batchForm.received_at} onChange={e => setBatchForm({ ...batchForm, received_at: e.target.value })} />
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
              <select className={inputClass} value={movementForm.movement_type} onChange={e => setMovementForm({ ...movementForm, movement_type: e.target.value })}><option value="dispensed">Dispensed</option><option value="wasted">Wasted</option><option value="expired">Expired</option><option value="adjustment">Adjustment</option></select>
              <input className={inputClass} type="number" min="1" value={movementForm.quantity} onChange={e => setMovementForm({ ...movementForm, quantity: Number(e.target.value) || 1 })} />
              <textarea className={inputClass} rows={3} placeholder="Reason *" value={movementForm.reason} onChange={e => setMovementForm({ ...movementForm, reason: e.target.value })} required />
            </div>
            <div className="flex gap-3 mt-5"><button onClick={() => setShowMovementModal(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-2xl font-semibold">Cancel</button><button onClick={handleMovement} disabled={formLoading || !movementForm.reason.trim()} className="flex-1 py-3 bg-maroon-800 text-white rounded-2xl font-semibold disabled:opacity-50">{formLoading ? 'Saving...' : 'Record Movement'}</button></div>
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
              <button onClick={handleDelete} className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NurseMedicine;