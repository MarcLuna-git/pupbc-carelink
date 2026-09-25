import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, User, Users, RefreshCw, ArrowRight, QrCode } from 'lucide-react';
import api from '../../services/api';
import KioskLayout from '../../layouts/KioskLayout';

const KioskQueue = ({ checkin, onDone }) => {
  const isPriority = checkin.queue_type === 'priority';
  const [queueData, setQueueData] = useState(null);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    fetchQueue();
    const qInterval = setInterval(fetchQueue, 10000);
    const cInterval = setInterval(() => setCountdown(prev => {
      if (prev <= 1) { onDone(); return 0; }
      return prev - 1;
    }), 1000);
    return () => { clearInterval(qInterval); clearInterval(cInterval); };
  }, []);

  const fetchQueue = async () => {
    try {
      const res = await api.get('/kiosk/queue');
      if (res.data.success) setQueueData(res.data.data);
    } catch (err) {   }
  };

  const position = queueData?.queue?.findIndex(q => q.id === checkin.id) ?? -1;
  const aheadCount = position < 0 ? 0 : queueData.queue.slice(0, position).filter(q => q.status === 'waiting').length;
  const waitTime = aheadCount * 5;

  return (
    <KioskLayout>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg mx-auto text-center">
        
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
          className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-500/30">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </motion.div>

        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Checked In!</h1>
        <p className="text-white/40 mb-8">Please wait for your number to be called</p>

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.4 }}
          className={`rounded-3xl p-8 md:p-10 mb-6 border-2 relative overflow-hidden ${
            isPriority ? 'bg-red-500/5 border-red-500/30' : 'bg-yellow-400/5 border-yellow-400/30'
          }`}>
          <div className={`absolute inset-0 opacity-10 ${isPriority ? 'bg-red-500' : 'bg-yellow-400'}`} />
          <p className="text-white/30 text-sm mb-2 relative z-10">Your Number</p>
          <p className={`text-7xl md:text-9xl font-black tracking-wider relative z-10 ${isPriority ? 'text-red-400' : 'text-yellow-300'}`}>
            {checkin.queue_number}
          </p>
          <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold mt-3 relative z-10 ${
            isPriority ? 'bg-red-500/20 text-red-300' : 'bg-yellow-400/20 text-yellow-300'
          }`}>
            {checkin.priority} Priority
          </span>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            <User className="w-5 h-5 text-yellow-400/60 mx-auto mb-1" />
            <p className="text-white/40 text-xs">Patient</p>
            <p className="text-white text-sm font-semibold truncate">Your clinic visit</p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            <Users className="w-5 h-5 text-yellow-400/60 mx-auto mb-1" />
            <p className="text-white/40 text-xs">Ahead</p>
            <p className="text-white text-sm font-semibold">{aheadCount} patient{aheadCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            <Clock className="w-5 h-5 text-yellow-400/60 mx-auto mb-1" />
            <p className="text-white/40 text-xs">Est. Wait</p>
            <p className="text-white text-sm font-semibold">~{waitTime} min</p>
          </div>
        </div>

        {queueData?.now_serving && (
          <div className="bg-green-500/5 backdrop-blur-xl rounded-2xl p-4 mb-6 border border-green-500/20 flex items-center justify-between">
            <span className="text-green-400 text-sm font-semibold">NOW SERVING</span>
            <span className="text-green-300 text-xl font-bold">{queueData.now_serving.queue_number}</span>
          </div>
        )}

        <p className="text-white/15 text-xs mb-4">
          Screen resets in {countdown}s
        </p>

        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={onDone}
          className="w-full py-5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-maroon-900 font-bold rounded-2xl text-lg transition flex items-center justify-center gap-3 shadow-xl shadow-yellow-400/10">
          Done
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      </motion.div>
    </KioskLayout>
  );
};

export default KioskQueue;