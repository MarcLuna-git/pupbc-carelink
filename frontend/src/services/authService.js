import api from './api';
import { clearSession, currentPortal, getUser, hasSession, startSession } from './session';

// Requests that send an email (registration code) wait up to 60 seconds.
const EMAIL_REQUEST_TIMEOUT_MS = 60000;

// One /auth/me check per portal at a time (several guards can ask at once).
const restoring = {};

const getPayload = (responseData) => {
  // Tanggap ang token/user sa data object o sa root response.
  return responseData?.data ?? responseData;
};

const authService = {

  async nurseLogin(email, password) {
    // Legacy URL pa rin para compatible sa backend.
    const response = await api.post('/auth/admin-login', {
      email,
      password,
    });

    const body = response.data;
    const payload = getPayload(body);

    // The server set the session cookie; only the user is kept, in memory.
    if (body.success && payload?.user) {
      startSession(payload.user, 'nurse');
    }

    return body;
  },


  async login(student_id, password, birthday) {
    const response = await api.post('/auth/login', {
      student_id,
      password,
      birthday,
    });

    const body = response.data;
    const payload = getPayload(body);

    // The server set the session cookie; only the user is kept, in memory.
    if (body.success && payload?.user) {
      startSession(payload.user, 'student');
    }

    return body;
  },


  // Course, year level, and section choices, managed in Nurse → Course Management.
  async registrationOptions() {
    const response = await api.get('/auth/registration-options');
    return response.data?.data?.courses || [];
  },

  // Courses plus whether the Student ID must be on the school masterlist.
  async registrationSettings() {
    const response = await api.get('/auth/registration-options');
    return { courses: response.data?.data?.courses || [], masterlistRequired: Boolean(response.data?.data?.masterlist_required) };
  },

  // "found", "not_found", or "unchecked" (masterlist check is off).
  async checkStudentId(studentId, signal) {
    const response = await api.post('/auth/check-student-id', { student_id: studentId }, { signal });
    return response.data?.data?.status || 'unchecked';
  },

  // The server saves the registration and then sends the code by email (SMTP),
  // which can take longer than the usual request timeout. So this call waits
  // longer, and if it still gets no answer it asks once more: the server sees
  // the saved registration and answers right away with "already pending".
  async register(data) {
    const send = () => api.post('/auth/register', data, { timeout: EMAIL_REQUEST_TIMEOUT_MS });
    try {
      return (await send()).data;
    } catch (error) {
      if (error?.response || error?.code === 'ERR_CANCELED') throw error;
      return (await send()).data;
    }
  },

  async verifyRegistration(email, otp) {
    const response = await api.post(
      '/auth/register/verify',
      {
        email,
        otp,
      }
    );

    return response.data;
  },

  async resendRegistrationOtp(email) {
    const response = await api.post(
      '/auth/register/resend-otp',
      {
        email,
      },
      { timeout: EMAIL_REQUEST_TIMEOUT_MS }
    );

    return response.data;
  },


  async forgotPassword(email, account_type = 'student') {
    const response = await api.post(
      '/auth/forgot-password',
      {
        email,
        account_type,
      }
    );

    return response.data;
  },

  // Gamit ulit ang forgot-password endpoint; papalitan nito ang dating OTP.
  async resendPasswordResetOtp(email, account_type = 'student') {
    const response = await api.post(
      '/auth/forgot-password',
      {
        email,
        account_type,
      }
    );

    return response.data;
  },

  async verifyPasswordResetOtp(email, otp, account_type = 'student') {
    const response = await api.post('/auth/verify-password-reset-otp', {
      email,
      otp,
      account_type,
    });
    return response.data;
  },

  async resetPassword(
    email,
    otp,
    password,
    password_confirmation,
    account_type = 'student'
  ) {
    const response = await api.post(
      '/auth/reset-password',
      {
        email,
        otp,
        password,
        password_confirmation,
        account_type,
      }
    );

    return response.data;
  },


  // Signs out of the current portal only; the other portal's session stays.
  async logout(portal = currentPortal()) {
    try {
      // The server clears this portal's httpOnly cookie (even if the session already expired).
      await api.post('/auth/logout', {}, { headers: { 'X-Portal': portal } });
    } catch (e) {
      // I-clear ang local session kahit invalid na ang token.
    }

    clearSession(portal);

    // The server switched Remove time Guard off on sign-out; drop the nurse portal's mirror of it.
    if (portal === 'nurse') {
      try { localStorage.removeItem('carelink.nurse.dev.timeGuardBypass'); } catch { /* storage blocked */ }
    }

    // Student-only cleanup of per-session caches. "Remember me" is kept
    // (stored outside this namespace, see studentRememberLogin.js), and the
    // Nurse portal's logout never touches Student data.
    if (portal === 'student') {
      Object.keys(localStorage)
        .filter((key) =>
          key.startsWith('carelink.student.')
        )
        .forEach((key) =>
          localStorage.removeItem(key)
        );
    }
  },


  getCurrentUser() {
    const user = getUser();

    return user.id || user.role ? user : null;
  },

  isAuthenticated() {
    return hasSession();
  },

  isNurse() {
    const user = this.getCurrentUser();

    return user?.role === 'nurse';
  },

  isStudent() {
    const user = this.getCurrentUser();

    return user?.role === 'student';
  },

  // The server renews the session cookie; nothing to store here.
  async refreshToken() {
    const response = await api.post(
      '/auth/refresh'
    );

    return response.data;
  },

  /*
   * After a reload the in-memory session is empty: ask the server whether this
   * portal's session cookie is still signed in. Resolves true (and remembers
   * the user) or false. Never redirects by itself.
   */
  restoreSession(portal = currentPortal()) {
    if (hasSession(portal)) return Promise.resolve(true);
    restoring[portal] ||= api.get('/auth/me', { headers: { 'X-Portal': portal }, skipAuthRedirect: true })
      .then((response) => {
        const user = response.data?.user;
        if (response.data?.success && user?.role === portal) {
          startSession(user, portal);
          return true;
        }
        return false;
      })
      .catch(() => false)
      .finally(() => { delete restoring[portal]; });
    return restoring[portal];
  },

  async getMe() {
    const response = await api.get('/auth/me');

    return response.data;
  },
};

export default authService;