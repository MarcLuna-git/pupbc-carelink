import { escapeHtml } from '../utils/escapeHtml';

/*
 * Who signs the printed clinic documents (nurse portal → account menu → Document signatory).
 *
 * The nurse picks one signatory and every document printed from the nurse portal carries that name in its
 * signature part, until another is picked. "Usual signatory" leaves each document as its template has it
 * (the campus physician on some, the signed-in nurse on others).
 *
 * Trial version: the choice and the added names are kept in this browser only, and a document saved
 * earlier prints with whoever is picked now. Names and license numbers only; no patient data.
 */
const LIST_KEY = 'carelink.nurse.signatories';
const SELECTED_KEY = 'carelink.nurse.signatory';

export const DEFAULT_ID = 'default';
export const SELF_ID = 'self';

const PHYSICIAN = { id: 'prieto', name: 'Angelo Tristan B. Prieto, M.D.', role: '', license: '0124173', esign: 'signature-prieto.jpeg' };

const clean = (value, max) => String(value ?? '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

const readList = () => {
  try {
    const list = JSON.parse(localStorage.getItem(LIST_KEY) || '[]');
    return Array.isArray(list) ? list.filter((item) => item && item.id && item.name) : [];
  } catch {
    return [];
  }
};
const store = (key, value) => { try { localStorage.setItem(key, value); } catch { /* storage blocked */ } };

// Open document previews listen for a change so they redraw with the new signatory right away
// (see hooks/useSignatoryVersion.js). A change made in another tab arrives as a storage event.
let version = 0;
const listeners = new Set();
const changed = () => { version += 1; listeners.forEach((listener) => listener()); };
export const subscribeSignatory = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const signatoryVersion = () => version;
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => { if (event.key === LIST_KEY || event.key === SELECTED_KEY) changed(); });
}

const selfSignatory = (user) => {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  return { id: SELF_ID, name: name ? `Nurse ${name}` : 'Nurse', role: 'Campus Nurse', license: '', note: 'You' };
};

// Everyone the nurse can pick, in menu order. `custom: true` entries were added in this browser and can be removed.
export const signatoryChoices = (user) => [
  { id: DEFAULT_ID, name: 'Usual signatory', role: 'Each document keeps its own: the physician or the signed-in nurse' },
  PHYSICIAN,
  selfSignatory(user),
  ...readList().map((item) => ({ ...item, custom: true })),
];

export const selectedSignatoryId = (user) => {
  let id = DEFAULT_ID;
  try { id = localStorage.getItem(SELECTED_KEY) || DEFAULT_ID; } catch { /* storage blocked */ }
  return signatoryChoices(user).some((choice) => choice.id === id) ? id : DEFAULT_ID;
};

export const selectSignatory = (id) => { store(SELECTED_KEY, id); changed(); };

// The picked signatory, or null when the documents keep their usual one.
export const currentSignatory = (user) => {
  const id = selectedSignatoryId(user);
  return id === DEFAULT_ID ? null : signatoryChoices(user).find((choice) => choice.id === id);
};

export const addSignatory = ({ name, role, license }) => {
  const item = { id: `custom-${Date.now()}`, name: clean(name, 120), role: clean(role, 80), license: clean(license, 30) };
  if (!item.name) return null;
  store(LIST_KEY, JSON.stringify([...readList(), item]));
  changed();
  return item;
};

export const removeSignatory = (id) => {
  store(LIST_KEY, JSON.stringify(readList().filter((item) => item.id !== id)));
  try { if (localStorage.getItem(SELECTED_KEY) === id) localStorage.removeItem(SELECTED_KEY); } catch { /* storage blocked */ }
  changed();
};

// The signature part of a print template (inside <div class="sign">), as ready-made HTML.
// With no license number on file, a blank line is left to write it by hand.
export const signatureBlock = (signatory, templateDir) => [
  '<div class="signed">',
  signatory.esign ? `<img class="esign" src="${escapeHtml(templateDir + signatory.esign)}" alt="" />` : '',
  `<strong>${escapeHtml(signatory.name)}</strong>`,
  signatory.role ? `<small>${escapeHtml(signatory.role)}</small>` : '',
  `<small class="lic">Lic. No. ${signatory.license ? escapeHtml(signatory.license) : '<span class="fill"></span>'}</small>`,
  '</div>',
].join('');
