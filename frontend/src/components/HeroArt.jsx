/*
 * Decorative right-side artwork for the Student page heroes: one large line
 * icon that stands for the tab (calendar for Appointments, QR for QR Code, …),
 * sitting on the hero's bottom edge. Styles live in index.css (`.hero-art*`).
 */
const HeroArt = ({ icon: Icon = null }) => (
  <div className="hero-art" aria-hidden="true">
    {Icon && (
      <span className="hero-art-icon">
        <Icon strokeWidth={1.25} />
      </span>
    )}
  </div>
);

export default HeroArt;
