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
 *
 * Safety: the switch is OFF by default. The server turns it off on sign-in and
 * sign-out and after a few hours; here it is also turned off the first time a
 * portal loads after the browser was closed and opened again.
 */
const createDevTools = ({ name, endpoint, storageKey, changeEvent }) => {
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

  // A cookie without an expiry lasts only while the browser is open, so when it is
  // missing this is a new browser session: switch the time guard back on (bypass OFF).
  const sessionCookie = `carelink_devtools_${name}`;
  const newBrowserSession = () => !document.cookie.split('; ').some(c => c.startsWith(`${sessionCookie}=`));

  const fetchState = async () => {
    const { data } = await api.get(endpoint);
    let state = data?.data;
    if (newBrowserSession()) {
      if (state?.time_guard_bypass) {
        await api.put(endpoint, { time_guard_bypass: false });
        state = { ...state, time_guard_bypass: false };
      }
      // Marked only once the server agrees, so a failed reset is tried again on the next load.
      document.cookie = `${sessionCookie}=1; path=/; SameSite=Lax`;
    }
    store(Boolean(state?.time_guard_bypass));
    return state;
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
  name: 'student',
  endpoint: '/student/dev-tools',
  storageKey: 'carelink.student.dev.timeGuardBypass',
  changeEvent: 'carelink:dev-tools-changed',
});

const nurse = createDevTools({
  name: 'nurse',
  endpoint: '/nurse/dev-tools',
  storageKey: 'carelink.nurse.dev.timeGuardBypass',
  changeEvent: 'carelink:nurse-dev-tools-changed',
});

const kiosk = createDevTools({
  name: 'kiosk',
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
