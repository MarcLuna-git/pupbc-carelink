import { Link, useNavigate } from 'react-router-dom';
import { Heart, Clock, Shield, ArrowRight, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';

const Welcome = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const steps = [
    { icon: ClipboardList, title: 'Health Profile', desc: 'Tell us about your medical history so we can serve you better.' },
    { icon: Clock, title: '5 Minutes', desc: 'This quick form only takes about 5 minutes to complete.' },
    { icon: Shield, title: 'Secure & Private', desc: 'Your information is encrypted and only shared with clinic staff.' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-maroon-50 to-yellow-50 dark:from-gray-950 dark:to-gray-900 px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 text-center">
        
        <div className="w-20 h-20 bg-gradient-to-br from-maroon-800 to-maroon-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-maroon-800/20">
          <Heart className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white">
          Welcome to PUPBC CareLink, {user.first_name}!
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-3 text-sm leading-relaxed">
          Before using the system, please complete your <strong>Health Profile</strong>. 
          This helps our clinic provide better care for you.
        </p>

        <div className="space-y-3 mt-6 text-left">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
              <div className="w-9 h-9 bg-maroon-50 dark:bg-maroon-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <s.icon className="w-4.5 h-4.5 text-maroon-800 dark:text-maroon-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/student/health-profile')}
          className="w-full mt-6 py-3.5 bg-gradient-to-r from-maroon-800 to-maroon-900 text-white font-bold rounded-2xl hover:from-maroon-900 hover:to-maroon-950 transition flex items-center justify-center space-x-2 shadow-lg shadow-maroon-800/20">
          <span>Start Health Profile</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        <p className="text-xs text-gray-400 mt-4">You can also complete this later from your Dashboard.</p>
      </motion.div>
    </div>
  );
};

export default Welcome;