import pupbg from '../assets/pupbg.webp';

// Shared kiosk frame: campus photo under a solid maroon scrim, so text on top
// keeps a predictable contrast.
const KioskLayout = ({ children, contentClassName = 'items-center py-8' }) => (
  <div className="relative min-h-screen w-full overflow-hidden bg-maroon-950">
    <img src={pupbg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
    <div className="absolute inset-0 bg-gradient-to-b from-maroon-950/90 via-maroon-950/85 to-maroon-950" />

    <div className={`relative z-10 flex min-h-screen justify-center px-6 md:px-12 ${contentClassName}`}>
      {children}
    </div>

    <p className="absolute bottom-4 left-0 right-0 z-10 text-center text-xs text-white/60">
      PUP Biñan Campus • Clinic Health Services
    </p>
  </div>
);

export default KioskLayout;
