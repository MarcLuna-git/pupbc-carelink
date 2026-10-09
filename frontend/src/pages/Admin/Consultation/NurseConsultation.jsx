import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Heart, Save, Loader2, Users, ClipboardList, CheckCircle, RotateCcw, SkipForward } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import useNurseSync from '../../../hooks/useNurseSync';

const NurseConsultation = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [checkedInStudents, setCheckedInStudents] = useState([]);
  const queueRequest = useRef(0);
  const [form, setForm] = useState({
    chief_complaint: '', bp: '', hr: '', rr: '', temp: '', o2_sat: '',
    general_remarks: '', medical_certificate: false, medical_certificate_ref: '',
    follow_up: false, follow_up_date: '',
  });

  const queueAction = async (student, action) => {
    setLoading(true); setMessage('');
    try {
      const { data } = await api.post(`/nurse/queue/${student.checkin_id}/${action}`, {}, {
        headers: { 'If-Match': student.sync_version },
      });
      if (data.success) {
        setMessageType('success');
        setMessage(data.message);
        await fetchCheckedInStudents(true);
      }
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.message || 'Failed to update the queue.');
      if (err.response?.status === 409) await fetchCheckedInStudents(true).catch(() => {});
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    fetchCheckedInStudents();
  }, []);
  useEffect(() => {
    if (step !== 2 || !selectedStudent) return;
    const id = selectedStudent.checkin_id;
    return () => { api.delete(`/nurse/queue/${id}/claim`).catch(() => {}); };
  }, [step, selectedStudent]);
  useNurseSync(['queue', 'appointments', 'consultations', 'students'], async () => {
    await fetchCheckedInStudents(true);
    if (step === 2 && selectedStudent) {
      try { await api.post(`/nurse/queue/${selectedStudent.checkin_id}/claim`); }
      catch (err) {
        if (err.response?.status === 409) { setMessageType('error'); setMessage(err.response.data.message); }
        throw err;
      }
    }
  });

  const openVisit = async student => {
    if (loading) return;
    setLoading(true); setMessage('');
    try {
      await api.post(`/nurse/queue/${student.checkin_id}/claim`);
      setSelectedStudent(student);
      setForm(current => ({ ...current, chief_complaint: student.complaint }));
      setStep(2);
    } catch (err) { setMessageType('error'); setMessage(err.response?.data?.message || 'Unable to open this visit.'); }
    finally { setLoading(false); }
  };

  const fetchCheckedInStudents = async (silent = false) => {
    const request = ++queueRequest.current;
    try {
      if (!silent) setPageLoading(true);
      const token = localStorage.getItem('token');
      const response = await api.get('/nurse/queue/checkins', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (request !== queueRequest.current) return;
      if (response.data.success) {
        const data = response.data.data;
        const checkins = Array.isArray(data) ? data : (data?.data || []);
        const formatted = checkins.map(c => ({
          id: c.user?.student_id || c.student_id || 'N/A',
          user_id: c.user_id,
          name: (c.user?.first_name || '') + ' ' + (c.user?.last_name || ''),
          appointment: c.appointment?.service || 'Scheduled visit',
          status: c.status,
          triage: c.triage,
          complaint: c.triage?.chief_complaint || c.chief_complaint || c.appointment?.concern || '',
          checkin_id: c.id,
          appointment_id: c.appointment_id,
          priority: c.triage?.priority || 'LOW',
          queue_number: c.queue_number || 'N/A',
          called_at: c.called_at || null,
          sync_version: c.sync_version,
        }));
        setCheckedInStudents(formatted);
      }
    } catch (err) {
      console.log('Checkins error:', err);
      if (!silent) { setMessageType('error'); setMessage('Unable to load the clinic queue. Retrying automatically.'); }
      if (silent) throw err;
    } finally {
      if (request === queueRequest.current) setPageLoading(false);
    }
  };

  const callNext = async () => {
    setLoading(true); setMessage('');
    try { const { data } = await api.post('/nurse/queue/call-next'); setMessageType('success'); setMessage(data.message); await fetchCheckedInStudents(true); }
    catch (err) { setMessageType('error'); setMessage(err.response?.data?.message || 'Unable to call next patient.'); }
    finally { setLoading(false); }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;

    setLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const payload = {
        user_id: selectedStudent.user_id || selectedStudent.id,
        appointment_id: selectedStudent.appointment_id || null,
        appointment_checkin_id: selectedStudent.checkin_id || null,
        chief_complaint: form.chief_complaint,
        vital_signs: { bp: form.bp || null, hr: form.hr || null, rr: form.rr || null, temp: form.temp || null, o2_sat: form.o2_sat || null },
        general_remarks: form.general_remarks || null,
        medical_certificate: form.medical_certificate,
        medical_certificate_ref: form.medical_certificate_ref || null,
        follow_up_required: form.follow_up,
        follow_up_date: form.follow_up ? form.follow_up_date || null : null,
      };

      const response = await api.post('/nurse/consultations', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setMessageType('success');
        setMessage('Consultation recorded successfully!');
        setStep(1);
        setSelectedStudent(null);
        setForm({
          chief_complaint: '', bp: '', hr: '', rr: '', temp: '', o2_sat: '',
          general_remarks: '', medical_certificate: false, medical_certificate_ref: '',
          follow_up: false, follow_up_date: '',
        });
        fetchCheckedInStudents();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.message || 'Failed to save consultation.');
      if (err.response?.status !== 409) setTimeout(() => setMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-2.5 text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-maroon-500 dark:focus:ring-maroon-300/30 dark:focus:border-maroon-300 focus:outline-none";
  const labelClass = "text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5";

  if (pageLoading) {
    return <NursePageSkeleton label="Loading consultations" />;
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Consultation</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Record student consultation</p>
      </div>

      {message && (
        <div className={`p-3 rounded-2xl text-sm text-center ${
          messageType === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>{message}</div>
      )}

      {step === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <Users className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
            <span>Clinic Queue</span>
          </h3>

          <div className="flex gap-3 mb-4"><button onClick={callNext} disabled={loading || checkedInStudents.some(s => ['serving', 'called'].includes(s.status))} className="bg-maroon-800 text-white rounded-xl px-4 py-2 disabled:opacity-50">Call Next</button><button onClick={() => fetchCheckedInStudents(true)} className="border rounded-xl px-4 py-2">Refresh Queue</button></div>
          <p className="text-sm text-gray-500 mb-4">Confirm arrival or skip after calling attempts. Skipped students stay in the waiting queue until marked returned or their original check-in deadline passes.</p>
          {checkedInStudents.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-500">No Checked-in Students</h3>
              <p className="text-sm text-gray-400 mt-1">Students who check in via QR will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checkedInStudents.map(s => (
                <div key={s.checkin_id} className="border rounded-2xl p-4 space-y-2 dark:border-gray-700">
                  <div className="flex justify-between gap-3">
                    <b>{s.queue_number} - {s.name}</b>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      s.status === 'called' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 animate-pulse' :
                      s.status === 'serving' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      s.status === 'waiting' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                      s.status === 'skipped' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                      s.status === 'no_show' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      s.status === 'completed' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {s.status.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>

                  {s.status === 'called' && (
                    <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-xl">
                      <div className="flex gap-2">
                        <button onClick={() => queueAction(s, 'arrived')} disabled={loading} className="flex-1 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 text-sm">
                          <CheckCircle className="w-4 h-4 inline-block mr-1" /> Patient Arrived
                        </button>
                        <button onClick={() => queueAction(s, 'recall')} disabled={loading} className="px-3 py-2 border border-yellow-600 text-yellow-700 dark:text-yellow-400 rounded-xl font-semibold hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-sm">
                          <RotateCcw className="w-4 h-4 inline-block mr-1" /> Recall
                        </button>
                        <button onClick={() => queueAction(s, 'skip')} disabled={loading} className="px-3 py-2 border border-red-600 text-red-700 dark:text-red-400 rounded-xl font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 text-sm">
                          <SkipForward className="w-4 h-4 inline-block mr-1" /> Skip
                        </button>
                      </div>
                    </div>
                  )}
                  {s.status === 'skipped' && (
                    <button onClick={() => queueAction(s, 'returned')} disabled={loading} className="px-3 py-2 border border-green-600 text-green-700 dark:text-green-400 rounded-xl font-semibold hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 text-sm">
                      <RotateCcw className="w-4 h-4 inline-block mr-1" /> Mark Returned
                    </button>
                  )}

                  <p className="text-sm">{s.complaint}</p>

                  {/* Action buttons for waiting patients */}
                  {s.status === 'waiting' && (
                    <div className="flex gap-4 text-sm">
                      <Link className="text-maroon-700 underline" to={`/nurse/students?student=${s.user_id}`}>Open Student</Link>
                    </div>
                  )}

                  {/* Action buttons for serving patients */}
                  {s.status === 'serving' && (
                    <div className="flex gap-4 text-sm">
                      <Link className="text-maroon-700 underline" to={`/nurse/students?student=${s.user_id}`}>Open Student</Link>
                      <button className="text-maroon-700 underline disabled:text-gray-400" disabled={loading} onClick={() => openVisit(s)}>Open Visit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {step === 2 && selectedStudent && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-4 mb-6 pb-4 border-b">
            <div className="w-12 h-12 bg-maroon-50 dark:bg-maroon-900/20 rounded-2xl flex items-center justify-center">
              <User className="w-6 h-6 text-maroon-800 dark:text-maroon-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{selectedStudent.name}</h3>
              <p className="text-sm text-gray-400">{selectedStudent.id} — {selectedStudent.appointment}</p>
            </div>
          </div>

          <div className="my-3 rounded-xl bg-gray-50 dark:bg-gray-700 p-3 text-sm">Triage: {selectedStudent.priority} / {selectedStudent.triage?.severity}. Red flags: {selectedStudent.triage?.red_flags?.join(', ') || 'None'}. {selectedStudent.triage?.notes}</div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelClass}>Chief Complaint *</label>
              <textarea name="chief_complaint" value={form.chief_complaint} onChange={handleChange} rows={3}
                className={inputClass} placeholder="Describe the student's main concern..." required />
            </div>

            <div>
              <label className={`${labelClass} flex items-center space-x-2`}>
                <Heart className="w-4 h-4 text-red-500" /><span>Vital Signs (Optional)</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { name: 'bp', label: 'BP', placeholder: '120/80' },
                  { name: 'hr', label: 'HR', placeholder: '72 bpm' },
                  { name: 'rr', label: 'RR', placeholder: '16' },
                  { name: 'temp', label: 'Temp', placeholder: '36.5°C' },
                  { name: 'o2_sat', label: 'O2 Sat', placeholder: '98%' }
                ].map(v => (
                  <div key={v.name}>
                    <label className="text-[10px] text-gray-400 block mb-1">{v.label}</label>
                    <input name={v.name} value={form[v.name]} onChange={handleChange}
                      className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      placeholder={v.placeholder} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>General Remarks</label>
              <textarea name="general_remarks" value={form.general_remarks} onChange={handleChange} rows={3}
                className={inputClass} placeholder="Additional notes..." />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
              <span className="text-sm">Issue Medical Certificate?</span>
              <input type="checkbox" name="medical_certificate" checked={form.medical_certificate} onChange={handleChange}
                className="w-5 h-5 accent-maroon-800" />
            </div>
            {form.medical_certificate && (
              <div>
                <label className={labelClass}>Certificate Reference</label>
                <input name="medical_certificate_ref" value={form.medical_certificate_ref} onChange={handleChange}
                  className={inputClass} placeholder="MED-2024-001" />
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
              <span className="text-sm">Follow-up Required?</span>
              <input type="checkbox" name="follow_up" checked={form.follow_up} onChange={handleChange}
                className="w-5 h-5 accent-maroon-800" />
            </div>
            {form.follow_up && (
              <div>
                <label className={labelClass}>Follow-up Date</label>
                <input type="date" name="follow_up_date" value={form.follow_up_date} onChange={handleChange} className={inputClass} />
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-2xl font-semibold">Back</button>
              <button type="submit" disabled={loading}
                className="flex-1 py-3 bg-maroon-800 text-white rounded-2xl font-semibold flex items-center justify-center space-x-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{loading ? 'Saving...' : 'Save Consultation'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
};

export default NurseConsultation;
