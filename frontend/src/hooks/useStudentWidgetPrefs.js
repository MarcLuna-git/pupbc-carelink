import { useCallback, useEffect, useState } from 'react';

import {
  STUDENT_WIDGET_PREFS_EVENT,
  STUDENT_WIDGET_PREF_STORAGE_KEYS,
  getStudentWidgetPrefs,
  setStudentWidgetPref,
} from '../utils/studentWidgetPrefs';

/*
 * Subscribes to the Student portal floating-widget preferences so the
 * Settings → General toggles and the layout frame share one source of truth.
 */
export default function useStudentWidgetPrefs() {
  const [prefs, setPrefs] = useState(getStudentWidgetPrefs);

  useEffect(() => {
    const sync = () => setPrefs(getStudentWidgetPrefs());

    const handleStorage = (event) => {
      if (
        event.key === null ||
        STUDENT_WIDGET_PREF_STORAGE_KEYS.includes(event.key)
      ) {
        sync();
      }
    };

    sync();
    window.addEventListener(STUDENT_WIDGET_PREFS_EVENT, sync);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(STUDENT_WIDGET_PREFS_EVENT, sync);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setPref = useCallback((widget, enabled) => {
    setStudentWidgetPref(widget, enabled);
  }, []);

  return { prefs, setPref };
}
