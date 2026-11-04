/*
 * Kiosk triage rules for /kiosk (the backend applies the same ones).
 * Only General Consultation asks for symptoms, duration and pain. Every other service was
 * already explained in the student portal, so it goes straight to a Regular queue ticket.
 */
export const needsTriage = (service) => service === 'Consultation';

// Values match KioskController::SYMPTOM_DURATIONS.
export const SYMPTOM_DURATIONS = ['Today', '1-2 days', '3-7 days', 'More than a week'];

export const PAIN_LEVELS = Array.from({ length: 10 }, (_, index) => index + 1);
export const painBand = (level) => (level <= 3 ? 'Mild' : level <= 6 ? 'Moderate' : 'Severe');
