/*
 * Shared helpers for reading the logged-in Student from storage.
 *
 * Used by the Student shell (StudentLayout-for-Desktop-View) and by the account menu.
 */

import { getUser } from '../services/session';
import { mediaUrl } from './mediaUrl';

export const getStoredUser = () => getUser('student');

export const getAvatar = (user) => mediaUrl(
  user?.profile?.profile_picture ||
  user?.profile_picture ||
  user?.avatar_url ||
  '');

/*
 * Formal name casing: capitalize the first letter of every word (after a
 * space or hyphen) and leave the rest as typed, so "jerome dela cruz" reads
 * "Jerome Dela Cruz" while "McDonald" or "DELA CRUZ" are not mangled.
 * Mirrors the User model's name mutators on the backend.
 */
export const formatPersonName = (value) =>
  String(value ?? '').replace(/(^|[\s-])(\p{Ll})/gu, (_, separator, letter) => separator + letter.toUpperCase());

export const getDisplayName = (user) => {
  const name = [user?.first_name, user?.middle_name, user?.last_name]
    .map(formatPersonName)
    .filter(Boolean)
    .join(' ')
    .trim();

  return name || 'Student';
};

/*
 * Course + section as students write it, e.g. "BSIT 3-1". Sections are
 * stored as "<year>-<block>", so they already carry the year level. Falls
 * back to whichever part exists (or '' when neither does).
 */
export const getCourseSection = (user) =>
  [
    user?.course || user?.profile?.course,
    user?.section || user?.profile?.section,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');

export const getInitials = (user) => {
  const first = String(user?.first_name || '').trim();
  const last = String(user?.last_name || '').trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.trim();

  return initials.toUpperCase() || 'S';
};
