import axios from 'axios';

const getApiUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_URL
    ?.trim()
    .replace(/\/+$/, '');

  // Sa dev, sundin ang host/IP na ginamit para buksan ang frontend.
  if (import.meta.env.DEV) {
    const host = window.location.hostname;
    return `http://${host}:8000/api`;
  }

  // Sa production, puwedeng configured API URL ang gamitin.
  if (configuredUrl) {
    return configuredUrl;
  }

  return '/api';
};

const api = axios.create({
  baseURL: getApiUrl(),

  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },

  timeout: import.meta.env.PROD ? 20000 : 15000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.url?.startsWith('/kiosk/')) {
      config.headers['X-Kiosk-Token'] =
        sessionStorage.getItem('carelink.kiosk.token') ||
        import.meta.env.VITE_KIOSK_DEVICE_TOKEN ||
        '';
    }

    if (config.url?.startsWith('/announcements')) {
      config.timeout = 10000;
    }

    return config;
  },

  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,

  (error) => {
    if (error.response?.status === 401) {
      const pathname = window.location.pathname;

      const isLoginPage = pathname.includes('/login');

      const isCarelinkPortal =
        pathname.includes('/carelink-portal');

      const isAuthPage =
        pathname.includes('/register') ||
        pathname.includes('/forgot-password') ||
        pathname.includes('/reset-password');

      if (
        !isLoginPage &&
        !isCarelinkPortal &&
        !isAuthPage
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        window.location.replace(
          pathname.startsWith('/nurse')
            ? '/carelink-portal'
            : '/login'
        );
      }
    }

    return Promise.reject(error);
  }
);

export default api;