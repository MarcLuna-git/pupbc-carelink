/*
 * Student portal "Remember me": the Student ID and birthday of the last
 * sign-in (never the password), so the Student login form is pre-filled.
 *
 * Student portal only — the Nurse portal never reads or writes this key. It
 * lives outside the `carelink.student.` namespace on purpose: signing out of
 * the Student portal clears that per-session data, but "Remember me" must
 * survive a logout.
 */
const REMEMBER_KEY = 'carelink.remember.student-login';

// Where it was stored before; that key was wiped on every logout.
const LEGACY_KEY = 'carelink.student.remember-login';

const EMPTY = {
  enabled: false,
  student_id: '',
  dobMonth: '',
  dobDay: '',
  dobYear: '',
};

export const getRememberedStudentLogin = () => {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY) || localStorage.getItem(LEGACY_KEY);
    const saved = JSON.parse(raw || '{}') || {};

    return {
      enabled: saved.enabled === true,
      student_id: saved.student_id || '',
      dobMonth: saved.dobMonth || '',
      dobDay: saved.dobDay || '',
      dobYear: saved.dobYear || '',
    };
  } catch {
    return EMPTY;
  }
};

export const rememberStudentLogin = ({ student_id, dobMonth, dobDay, dobYear }) => {
  try {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({
      enabled: true,
      student_id,
      dobMonth,
      dobDay,
      dobYear,
    }));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Storage blocked: the student simply types the details next time.
  }
};

export const forgetStudentLogin = () => {
  try {
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Storage blocked: nothing was saved.
  }
};
