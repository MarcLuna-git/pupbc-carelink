import { useLayoutEffect, useRef } from 'react';
import { formatContactPhone, philippineMobileDigits } from '../utils/contactValidation';

// Small Philippine flag for the +63 prefix.
export function PhilippineFlag() {
  return (
    <svg viewBox="0 0 30 20" aria-hidden="true" className="h-3.5 w-5 shrink-0 rounded-[10px] ring-1 ring-slate-200 dark:ring-slate-600">
      <rect width="30" height="10" fill="#0038a8" />
      <rect y="10" width="30" height="10" fill="#ce1126" />
      <path d="M0 0 17.32 10 0 20Z" fill="#fff" />
      <circle cx="5.8" cy="10" r="2.3" fill="#fcd116" />
    </svg>
  );
}

// The 10 digits shown the usual Philippine way: 917 123 4567.
const spacedMobile = (digits) => [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(' ');

// Position in the spaced text right after the given number of digits.
const caretAfterDigits = (text, count) => {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/\d/.test(text[i])) seen += 1;
    if (seen === count) return i + 1;
  }
  return text.length;
};

/*
 * Mobile number field used across CareLink: a fixed flag and +63 on the left, and the student
 * or nurse types the 10 digits after it. The digits are spaced as they are typed (917 123 4567).
 * The value given and sent back is always '+639XXXXXXXXX' (or '+63' plus the digits typed so far,
 * or '' when empty), so forms keep the one stored format. onChange gets an event-like
 * { target: { name, value } }. `className` is the page's own input style; the left padding for
 * the prefix is added here.
 */
export default function PhilippineMobileInput({ value, onChange, name, id, className = '', placeholder = '917 123 4567', ...rest }) {
  const digits = philippineMobileDigits(value) ?? '';
  const shown = spacedMobile(digits);
  const inputRef = useRef(null);
  const caret = useRef(null);

  // Keep the cursor where the student was typing after the spaces are put back.
  useLayoutEffect(() => {
    if (caret.current === null || !inputRef.current || document.activeElement !== inputRef.current) return;
    const position = caretAfterDigits(shown, caret.current);
    inputRef.current.setSelectionRange(position, position);
    caret.current = null;
  }, [shown]);

  const handle = (event) => {
    const raw = event.target.value;
    const cursor = event.target.selectionStart ?? raw.length;
    let digitsBefore = raw.slice(0, cursor).replace(/\D/g, '').length;
    let next = philippineMobileDigits(raw);
    if (next === null) return;
    // Backspace or Delete on a space removes only the space; remove the digit next to it too.
    if (next === digits && raw.length < shown.length) {
      const forward = event.nativeEvent?.inputType === 'deleteContentForward';
      const removeAt = forward ? digitsBefore : digitsBefore - 1;
      if (removeAt >= 0 && removeAt < digits.length) {
        next = digits.slice(0, removeAt) + digits.slice(removeAt + 1);
        digitsBefore = removeAt;
      }
    }
    caret.current = Math.min(digitsBefore, next.length);
    onChange?.({ target: { name, value: formatContactPhone(next) ?? '', type: 'tel' } });
  };

  return (
    <div className="relative min-w-0">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-1 border-r border-slate-200 pl-2.5 pr-2 text-sm font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300" aria-hidden="true">
        <PhilippineFlag />+63
      </span>
      <input
        {...rest}
        ref={inputRef}
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete={rest.autoComplete ?? 'tel-national'}
        value={shown}
        onChange={handle}
        placeholder={placeholder}
        aria-label={rest['aria-label'] ?? 'Mobile number, the 10 digits after +63'}
        className={`${className} pl-[4.4rem]! pr-2!`}
      />
    </div>
  );
}
