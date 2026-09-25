import { motion } from 'framer-motion';
import pupbg from '../assets/pupbg.jpg';

const KioskLayout = ({ children }) => (
  <div className="relative min-h-screen w-full overflow-hidden bg-black">
    <img src={pupbg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
    <div className="absolute inset-0 bg-gradient-to-br from-maroon-950/98 via-maroon-900/95 to-black/98" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.06),transparent_50%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(120,0,0,0.4),transparent_50%)]" />
    
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div 
        animate={{ x: [0, 60, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 -left-40 w-[35rem] h-[35rem] bg-yellow-400/8 rounded-full blur-3xl" 
      />
      <motion.div 
        animate={{ x: [0, -50, 0], y: [0, 50, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-1/4 -right-40 w-[30rem] h-[30rem] bg-red-800/20 rounded-full blur-3xl" 
      />
    </div>

    <div className="relative z-10 min-h-screen flex items-center justify-center px-6 md:px-12 py-8">
      {children}
    </div>

    <p className="absolute bottom-4 left-0 right-0 text-center text-white/10 text-xs z-10">
      PUP Biñan Campus • Clinic Health Services
    </p>
  </div>
);

export default KioskLayout;