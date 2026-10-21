import { useEffect, useState } from 'react';
import api from './api';

/*
 * Settings → Developer Tools → "Remove time Guard".
 *
 * The real switch is stored on the server (the backend, kiosk and scheduled
 * jobs honour it). Each portal mirrors its current value here so its pages can
 * relax their own client-side time checks too:
 *   - Student: per student account; key under `carelink.student.` so Student
 *     sign-out clears it.
 *   - Nurse: one clinic-wide switch for the whole nurse portal.
 *   - Kiosk: one kiosk-wide switch (the kiosk has no signed-in user).
 */
const createDevTools = ({ endpoint, storageKey, changeEvent }) => {
  const isBypassed = () => {
    try { return localStorage.getItem(storageKey) === 'true'; } catch { return false; }
  };

  const store = (bypassed) => {
    try {
      if (bypassed) localStorage.setItem(storageKey, 'true');
      else localStorage.removeItem(storageKey);
    } catch { /* Storage blocked: the server still enforces the real value. */ }
    window.dispatchEvent(new Event(changeEvent));
  };

  const fetchState = async () => {
    const { data } = await api.get(endpoint);
    store(Boolean(data?.data?.time_guard_bypass));
    return data?.data;
  };

  // Turning the bypass on needs the developer password; turning it off does not.
  const update = async (bypassed, password = '') => {
    const { data } = await api.put(endpoint, { time_guard_bypass: bypassed, password });
    store(Boolean(data?.data?.time_guard_bypass));
    return data;
  };

  const useBypass = () => {
    const [bypassed, setBypassed] = useState(isBypassed);
    useEffect(() => {
      const sync = () => setBypassed(isBypassed());
      const onStorage = (event) => { if (event.key === storageKey || event.key === null) sync(); };
      window.addEventListener(changeEvent, sync);
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(changeEvent, sync);
        window.removeEventListener('storage', onStorage);
      };
    }, []);
    return bypassed;
  };

  return { isBypassed, fetchState, update, useBypass };
};

const student = createDevTools({
  endpoint: '/student/dev-tools',
  storageKey: 'carelink.student.dev.timeGuardBypass',
  changeEvent: 'carelink:dev-tools-changed',
});

const nurse = createDevTools({
  endpoint: '/nurse/dev-tools',
  storageKey: 'carelink.nurse.dev.timeGuardBypass',
  changeEvent: 'carelink:nurse-dev-tools-changed',
});

const kiosk = createDevTools({
  endpoint: '/kiosk/dev-tools',
  storageKey: 'carelink.kiosk.dev.timeGuardBypass',
  changeEvent: 'carelink:kiosk-dev-tools-changed',
});

// Student portal
export const isTimeGuardBypassed = student.isBypassed;
export const fetchDevTools = student.fetchState;
export const updateTimeGuardBypass = student.update;
export const useTimeGuardBypass = student.useBypass;

// Nurse portal
export const fetchNurseDevTools = nurse.fetchState;
export const updateNurseTimeGuardBypass = nurse.update;
export const useNurseTimeGuardBypass = nurse.useBypass;

// Kiosk (hidden /kiosk/settings page)
export const fetchKioskDevTools = kiosk.fetchState;
export const updateKioskTimeGuardBypass = kiosk.update;
export const useKioskTimeGuardBypass = kiosk.useBypass;
