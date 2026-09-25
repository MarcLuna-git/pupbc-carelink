import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, CheckCircle, XCircle, Search, User, Loader2, X, FileText, Stethoscope, Info, Filter, Users, RefreshCw } from 'lucide-react';
import api from '../../../services/api';
import { formatAppointmentDate, groupAppointments } from '../../../utils/appointmentDate';

const NurseAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const requestInFlight = useRef(false);

  const fetchAppointments = useCallback(async () => {
    if (document.visibilityState === 'hidden' || requestInFlight.current) return;
    requestInFlight.current = true;
    setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await api.get('/nurse/appointments', {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          status: filter !== 'all' ? filter : undefined,
          search: search || undefined,
        },
      });
      const data = res.data.data;
      setAppointments(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      requestInFlight.current = false;
    }
  }, [filter, search]);

  useEffect(() => { 
    setLoading(true);
    fetchAppointments(); 
  }, [filter, fetchAppointments]);

  // Mag-poll lang habang visible ang page para iwas background requests.
  useEffect(() => {
    const refresh = () => fetchAppointments();
    const interval = setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [fetchAppointments]);

  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      await api.patch(`/nurse/appointments/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showMessage('Appointment approved successfully!', 'success');
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to approve', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      await api.patch(`/nurse/appointments/${rejectModal}/reject`, 
        { reason: rejectReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showMessage('Appointment rejected.', 'success');
      setRejectModal(null);
      setRejectReason('');
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to reject', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      await api.patch(`/nurse/appointments/${cancelModal}/cancel`, { reason: cancelReason }, { headers: { Authorization: `Bearer ${token}` } });
      showMessage('Appointment cancelled.', 'success');
      setCancelModal(null);
      setCancelReason('');
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to cancel', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = () => { window.location.assign('/nurse/consultation'); };

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const formatDate = (value) => formatAppointmentDate(value, { weekday: 'short' });

  const filtered = Array.isArray(appointments) ? appointments : [];

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/20',
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800/20',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800/20',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800/20',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800/20',
    expired: 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  };

  const statusConfig = {
    approved: { icon: CheckCircle, color: 'text-green-500' },
    pending: { icon: Clock, color: 'text-yellow-500' },
    completed: { icon: CheckCircle, color: 'text-blue-500' },
    cancelled: { icon: XCircle, color: 'text-red-500' },
    rejected: { icon: XCircle, color: 'text-red-500' },
    expired: { icon: XCircle, color: 'text-gray-500' },
  };

  const counts = {
    all: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    approved: groupAppointments(appointments).today.length,
    completed: appointments.filter(a => a.status === 'completed').length,
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto px-4 sm:px-0 pb-6">
      
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Appointments</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {counts.all} total · {counts.pending} pending · {counts.approved} approved today
            </p>
          </div>
          <button
            type="button"
            onClick={fetchAppointments}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-2xl text-sm font-medium text-center ${
              messageType === 'success' 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/20' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/20'
            }`}>{message}</motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            className="w-full border border-gray-200 dark:border-gray-600 rounded-2xl pl-10 pr-4 py-2.5 text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-500"
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search student name or concern..." 
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'pending', label: 'Pending', count: counts.pending },
            { key: 'approved', label: 'Approved', count: counts.approved },
            { key: 'completed', label: 'Completed', count: counts.completed },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all flex-shrink-0 ${
                filter === f.key 
                  ? 'bg-maroon-800 text-white shadow-md' 
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}>
              {f.label}
              <span className="ml-1.5 text-[10px] opacity-75">({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="text-sm text-gray-400 mt-3">Loading appointments...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 py-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No appointments found</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {filter !== 'all' ? `No ${filter} appointments.` : 'All clear!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => {
            const config = statusConfig[app.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <motion.div key={app.id} layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedAppointment(app)}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-4 sm:p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all cursor-pointer">
                
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-maroon-50 dark:bg-maroon-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                          {app.user?.first_name} {app.user?.last_name}
                        </h3>
                        <span className="text-xs text-gray-400 font-mono">{app.user?.student_id || ''}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{app.service}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">{app.reference_number}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{formatDate(app.appointment_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{app.time_slot}
                        </span>
                      </div>
                      {app.concern && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 line-clamp-1">{app.concern}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize border ${statusColors[app.status]}`}>
                      <StatusIcon className="w-3 h-3" />{app.status}
                    </span>
                    {app.status === 'pending' && (
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => handleApprove(app.id)} 
                          disabled={actionLoading}
                          className="p-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition"
                          title="Approve">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setRejectModal(app.id)} 
                          disabled={actionLoading}
                          className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                          title="Reject">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {['pending', 'rejected'].includes(app.status) && (
                      <button
                        onClick={() => setCancelModal(app.id)}
                        disabled={actionLoading}
                        className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                        title="Cancel">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedAppointment && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAppointment(null)}>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
              style={{ maxHeight: '90vh' }}
              onClick={e => e.stopPropagation()}>
              
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold capitalize border ${statusColors[selectedAppointment.status]}`}>
                  {(() => { const Icon = (statusConfig[selectedAppointment.status] || statusConfig.pending).icon; return <Icon className="w-3.5 h-3.5" />; })()}
                  {selectedAppointment.status}
                </span>
                <button onClick={() => setSelectedAppointment(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="overflow-y-auto px-5 pb-5" style={{ WebkitOverflowScrolling: 'touch' }}>
                
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-maroon-50 dark:bg-maroon-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {selectedAppointment.user?.first_name} {selectedAppointment.user?.last_name}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                      {selectedAppointment.user?.student_id} · {selectedAppointment.reference_number}
                    </p>
                  </div>
                </div>

                {selectedAppointment.status === 'pending' && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/20 rounded-2xl p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <Clock className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">⏳ Pending Review</p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">This appointment needs your approval or rejection.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-4 space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Service</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedAppointment.service}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Date</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedAppointment.appointment_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Time</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedAppointment.time_slot}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Concern</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAppointment.concern || 'No concern specified'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedAppointment.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleApprove(selectedAppointment.id)} 
                        disabled={actionLoading}
                        className="w-full py-3 bg-green-500 text-white font-semibold rounded-2xl hover:bg-green-600 transition flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Approve Appointment
                      </button>
                      <button 
                        onClick={() => { setRejectModal(selectedAppointment.id); }}
                        className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm border border-red-200 dark:border-red-800/20">
                        Reject Appointment
                      </button>
                    </>
                  )}
                  {selectedAppointment.status === 'approved' && (
                    <button 
                      onClick={() => handleComplete(selectedAppointment.id)} 
                      disabled={actionLoading}
                      className="w-full py-3 bg-maroon-800 text-white font-semibold rounded-2xl hover:bg-maroon-900 transition flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Open Clinic Queue
                    </button>
                  )}
                  {['pending', 'rejected'].includes(selectedAppointment.status) && (
                    <button
                      onClick={() => setCancelModal(selectedAppointment.id)}
                      disabled={actionLoading}
                      className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm">
                      Cancel Appointment
                    </button>
                  )}
                  <button onClick={() => setSelectedAppointment(null)} 
                    className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rejectModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setRejectModal(null)}>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl p-6"
              onClick={e => e.stopPropagation()}>
              
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white text-center">Reject Appointment</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">Please provide a reason for rejection.</p>
              
              <textarea 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
                className="w-full mt-4 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              />
              
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setRejectModal(null); setRejectReason(''); }} 
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm">
                  Cancel
                </button>
                <button 
                  onClick={handleReject} 
                  disabled={!rejectReason.trim() || actionLoading}
                  className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-2xl hover:bg-red-600 transition text-sm disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cancelModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setCancelModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl p-6"
              onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-bold text-gray-900 dark:text-white text-center">Cancel Appointment</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">Please provide a cancellation reason.</p>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
                className="w-full mt-4 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500/20 resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setCancelModal(null); setCancelReason(''); }} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl text-sm">Back</button>
                <button onClick={handleCancel} disabled={!cancelReason.trim() || actionLoading} className="flex-1 py-3 bg-gray-700 text-white font-semibold rounded-2xl text-sm disabled:opacity-50">{actionLoading ? 'Cancelling...' : 'Confirm'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default NurseAppointments;