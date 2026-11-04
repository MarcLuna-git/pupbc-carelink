import api from './api';
import { clearSession, currentPortal, getToken, getUser, setToken, setUser } from './session';

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

    if (body.success && payload?.token) {
      setToken(payload.token, 'nurse');

      if (payload.user) {
        setUser(payload.user, 'nurse');
      }
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

    if (body.success && payload?.token) {
      setToken(payload.token, 'student');

      if (payload.user) {
        setUser(payload.user, 'student');
      }
    }

    return body;
  },


  // Course, year level, and section choices, managed in Nurse → Course Management.
  async registrationOptions() {
    const response = await api.get('/auth/registration-options');
    return response.data?.data?.courses || [];
  },

  async register(data) {
    const response = await api.post(
      '/auth/register',
      data
    );

    return response.data;
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
      }
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
      await api.post('/auth/logout');
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
    return !!getToken();
  },

  isNurse() {
    const user = this.getCurrentUser();

    return user?.role === 'nurse';
  },

  isStudent() {
    const user = this.getCurrentUser();

    return user?.role === 'student';
  },

  getToken() {
    return getToken();
  },


  async refreshToken() {
    const response = await api.post(
      '/auth/refresh'
    );

    const body = response.data;
    const payload = getPayload(body);

    if (body.success && payload?.token) {
      setToken(payload.token);
    }

    return body;
  },

  async getMe() {
    const response = await api.get('/auth/me');

    return response.data;
  },
};

export default authService;