import { useCallback, useLayoutEffect, useState } from 'react';
import { currentPortal } from '../services/session';

// Each portal remembers its own theme, so dark mode in the Nurse portal does not
// change the Student portal (and vice versa) in the same browser.
export const darkModeKey = (portal = currentPortal()) => `carelink.theme.${portal}.darkMode`;

export const readDarkMode = (portal = currentPortal()) => {
  try { return localStorage.getItem(darkModeKey(portal)) === 'true'; }
  catch { return false; }
};

export const saveDarkMode = (value, portal = currentPortal()) => {
  try { localStorage.setItem(darkModeKey(portal), String(value)); } catch { /* Keep the current session usable. */ }
};

// One-time move of the old shared `darkMode` preference into both portals.
try {
  const legacy = localStorage.getItem('darkMode');
  if (legacy !== null) {
    ['student', 'nurse'].forEach(portal => {
      if (localStorage.getItem(darkModeKey(portal)) === null) localStorage.setItem(darkModeKey(portal), legacy);
    });
    localStorage.removeItem('darkMode');
  }
} catch { /* Storage blocked: themes default to light. */ }

// Mount only in account layouts so public pages always use the light theme.
export default function useAccountTheme() {
  const [darkMode, setDarkMode] = useState(() => readDarkMode());

  useLayoutEffect(() => {
    const syncTheme = () => {
      const next = readDarkMode();
      setDarkMode(next);
      document.documentElement.classList.toggle('dark', next);
    };
    const onStorage = event => {
      if (event.key === darkModeKey() || event.key === null) syncTheme();
    };
    syncTheme();
    window.addEventListener('darkModeChange', syncTheme);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('darkModeChange', syncTheme);
      window.removeEventListener('storage', onStorage);
      document.documentElement.classList.remove('dark');
    };
  }, []);

  const toggleDarkMode = useCallback(() => {
    const next = !darkMode;
    saveDarkMode(next);
    window.dispatchEvent(new Event('darkModeChange'));
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  }, [darkMode]);

  return { darkMode, toggleDarkMode };
}
