import axios from 'axios';
import { createRequestPool } from './requestPool.js';

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

const transportGet = api.get.bind(api);
const reads = createRequestPool(transportGet,
  () => JSON.stringify([localStorage.getItem('token'), sessionStorage.getItem('carelink.kiosk.token')]),
  (url, config) => {
    const target = new URL(api.getUri({ ...config, url }), window.location.origin);
    target.searchParams.sort();
    return [target.href, config.headers || {}, config.timeout, config.responseType];
  });
api.get = (url, config) => reads.get(url, config);

// Retain ambiguous (network/5xx) operations for safe retries in this tab.
const operations = new Map();
const nurseWrite = config => window.location.pathname.startsWith('/nurse') &&
  !['get', 'head', 'options'].includes((config.method || 'get').toLowerCase()) &&
  (config.url?.startsWith('/nurse/') || config.url?.startsWith('/notifications/')) &&
  !config.url?.includes('change-password') && !config.url?.endsWith('/claim') && !(config.data instanceof FormData);

api.interceptors.request.use(
  (config) => {
    if (!['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) reads.invalidate();
    // Let the browser generate the multipart boundary for file uploads.
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (nurseWrite(config)) {
      const fingerprint = JSON.stringify([token, config.method, config.url, config.data, config.headers['If-Match']]);
      if (!operations.has(fingerprint)) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        operations.set(fingerprint, Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''));
      }
      config.headers['Idempotency-Key'] ||= operations.get(fingerprint);
      config.operationFingerprint = fingerprint;
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
  (response) => {
    if (!['get', 'head', 'options'].includes((response.config.method || 'get').toLowerCase())) {
      reads.invalidate();
      if (response.config.url?.startsWith('/student/health-profile')) {
        window.dispatchEvent(new Event('carelink:health-profile-saved'));
      }
    }
    if (response.config.operationFingerprint) {
      operations.delete(response.config.operationFingerprint);
      window.dispatchEvent(new Event('carelink:nurse-change'));
    }
    return response;
  },

  (error) => {
    if (error.response && error.response.status < 500 && error.response.status !== 429) {
      operations.delete(error.config?.operationFingerprint);
    }
    if (error.response?.status === 401) {
      reads.invalidate();
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
