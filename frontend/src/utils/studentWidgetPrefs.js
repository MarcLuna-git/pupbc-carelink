/*
 * Student portal shell preferences.
 *
 * Three shell-level elements can be shown or hidden from Settings → General:
 *   - the floating Help & Support widget
 *   - the floating CareLink chat assistant
 *   - the "Clinic schedule" badge in the tablet/desktop header
 *
 * The choice is stored in localStorage and broadcast with a custom event so
 * the layout frame (which renders the widgets) and the Settings page (which
 * edits them) stay in sync without a reload. This mirrors the approach used
 * for the theme in useAccountTheme.
 */

export const STUDENT_WIDGET_PREFS_EVENT = 'studentWidgetPrefsUpdated';

/* localStorage key per widget, kept in a fixed order for storage listeners. */
export const STUDENT_WIDGET_PREF_STORAGE_KEYS = [
  'studentHelpWidgetEnabled',
  'studentChatWidgetEnabled',
  'studentClinicBadgeEnabled',
];

const STORAGE_KEY_BY_WIDGET = {
  helpWidget: 'studentHelpWidgetEnabled',
  chatWidget: 'studentChatWidgetEnabled',
  clinicBadge: 'studentClinicBadgeEnabled',
};

const readFlag = (key) => {
  try {
    const raw = localStorage.getItem(key);
    /* Widgets stay visible until the student opts out. */
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
};

export const getStudentWidgetPrefs = () => ({
  helpWidget: readFlag(STORAGE_KEY_BY_WIDGET.helpWidget),
  chatWidget: readFlag(STORAGE_KEY_BY_WIDGET.chatWidget),
  clinicBadge: readFlag(STORAGE_KEY_BY_WIDGET.clinicBadge),
});

export const setStudentWidgetPref = (widget, enabled) => {
  const key = STORAGE_KEY_BY_WIDGET[widget];
  if (!key) return;

  try {
    localStorage.setItem(key, String(Boolean(enabled)));
  } catch {
    /* Persisting preferences is best-effort. */
  }

  window.dispatchEvent(
    new CustomEvent(STUDENT_WIDGET_PREFS_EVENT, {
      detail: getStudentWidgetPrefs(),
    })
  );
};
