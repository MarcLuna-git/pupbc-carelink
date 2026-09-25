import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, ArrowRight, ArrowLeft, Lock, FileText, Clock, UserCheck, AlertCircle } from 'lucide-react';
import KioskLayout from '../../layouts/KioskLayout';

const KioskTerms = ({ onAgree, onDecline, onBack }) => {
  const [accepted, setAccepted] = useState(false);

  const policies = [
    {
      icon: Lock,
      title: 'Data Privacy',
      color: 'blue',
      text: 'Your personal and health information is protected under RA 10173 (Data Privacy Act of 2012). We only collect what is necessary for your clinic visit.'
    },
    {
      icon: UserCheck,
      title: 'Accuracy',
      color: 'green',
      text: 'Please ensure all information provided is accurate. False information may affect the quality of care you receive from our clinic.'
    },
    {
      icon: Clock,
      title: 'Queue System',
      color: 'purple',
      text: 'You will be assigned a queue number upon check-in. Priority may be given to emergency cases, PWDs, and pregnant students.'
    },
    {
      icon: AlertCircle,
      title: 'No-Show Policy',
      color: 'orange',
      text: 'If you fail to check in within 15 minutes of your scheduled appointment, it will be marked as void. A new appointment must be booked.'
    },
  ];

  const colorMap = {
    blue: 'border-blue-400/20 bg-blue-400/5 text-blue-300',
    green: 'border-green-400/20 bg-green-400/5 text-green-300',
    purple: 'border-purple-400/20 bg-purple-400/5 text-purple-300',
    orange: 'border-orange-400/20 bg-orange-400/5 text-orange-300',
  };

  return (
    <KioskLayout>
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-3xl mx-auto">
        
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-16 h-16 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
            <Shield className="w-8 h-8 text-yellow-400" />
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Terms & Privacy</h1>
          <p className="text-white/40 text-base">Please review our policies before proceeding</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {policies.map((policy, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className={`backdrop-blur-xl rounded-2xl p-4 border ${colorMap[policy.color]} transition-all duration-300 hover:scale-[1.02]`}>
              <div className="flex items-start gap-3">
                <policy.icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">{policy.title}</h3>
                  <p className="text-white/50 text-xs leading-relaxed">{policy.text}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setAccepted(!accepted)}
          className={`backdrop-blur-xl rounded-2xl p-4 border-2 cursor-pointer transition-all duration-300 ${
            accepted 
              ? 'border-yellow-400/50 bg-yellow-400/5' 
              : 'border-white/10 bg-white/5 hover:border-white/20'
          }`}>
          <div className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              accepted ? 'bg-yellow-400 border-yellow-400' : 'border-white/30'
            }`}>
              {accepted && <CheckCircle className="w-4 h-4 text-maroon-900" />}
            </div>
            <span className="text-white/70 text-sm">
              I have read and agree to the <strong className="text-yellow-300">Terms & Conditions</strong> and <strong className="text-yellow-300">Privacy Policy</strong>
            </span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex gap-3 mt-6">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="flex-1 py-4 bg-white/5 backdrop-blur-xl border border-white/10 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition text-base">
            <ArrowLeft className="w-5 h-5" />
            Back
          </motion.button>
          <motion.button
            whileHover={accepted ? { scale: 1.02 } : {}}
            whileTap={accepted ? { scale: 0.98 } : {}}
            onClick={onAgree}
            disabled={!accepted}
            className={`flex-[2] py-4 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 text-base ${
              accepted 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-maroon-900 shadow-xl shadow-yellow-400/20' 
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}>
            Agree & Continue
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>

      </motion.div>
    </KioskLayout>
  );
};

export default KioskTerms;