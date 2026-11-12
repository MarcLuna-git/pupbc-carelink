import {
  BookOpen,
  Calendar,
  FileText,
  GraduationCap,
  LayoutDashboard,
  QrCode,
  Megaphone,
  Pill,
  Settings,
  Stethoscope,
  Users,
} from 'lucide-react';

/*
 * Nurse portal navigation, shared by the sidebar (tablet / desktop) and the
 * bottom dock + "More" sheet (mobile). `dock: true` items sit in the mobile
 * bottom dock; the rest are reached through its "More" button.
 *
 * `group` sorts the sidebar into labelled sections (one-word labels).
 * Management holds the clinic visit flow in order: appointments, then the
 * QR check-in queue, then the consultation form (its Individual Release tab also lists the past visits, Patient History).
 * Records holds the registers the clinic keeps: students, faculty, medicines and courses.
 * Dashboard has no group and sits on top.
 *
 * `countKey` marks a Management link that shows a live badge (GET /nurse/nav-counts):
 * requests still pending, patients waiting in today's queue, patients in consultation.
 * Records and Admin links are registers, not live lists, so they never get one.
 */
export const NURSE_NAV_GROUPS = [
  { key: 'management', label: 'Management' },
  { key: 'records', label: 'Records' },
  { key: 'admin', label: 'Admin' },
];

export const NURSE_NAV_ITEMS = [
  { path: '/nurse/dashboard', icon: LayoutDashboard, label: 'Overview', dock: true },
  { path: '/nurse/appointments', icon: Calendar, label: 'Appointments', dock: true, group: 'management', countKey: 'appointments', countLabel: 'pending requests' },
  { path: '/nurse/queue', icon: QrCode, label: 'Queue', dock: true, group: 'management', countKey: 'queue', countLabel: 'waiting in the queue' },
  { path: '/nurse/consultation', icon: Stethoscope, label: 'Consultation', group: 'management', countKey: 'consultation', countLabel: 'in consultation' },
  { path: '/nurse/students', icon: Users, label: 'Students', dock: true, group: 'records' },
  { path: '/nurse/faculty', icon: GraduationCap, label: 'Faculty', group: 'records' },
  { path: '/nurse/medicines', icon: Pill, label: 'Medicines', group: 'records' },
  { path: '/nurse/academic', icon: BookOpen, label: 'Courses', group: 'records' },
  { path: '/nurse/announcements', icon: Megaphone, label: 'Announcements', group: 'admin' },
  { path: '/nurse/settings', icon: Settings, label: 'Settings', group: 'admin' },
];

export const isNurseNavActive = (pathname, path) =>
  pathname === path || pathname.startsWith(`${path}/`);

export const nurseDisplayName = (user) =>
  [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || 'Nurse';

export const nurseInitials = (user) =>
  `${String(user?.first_name || '').trim().charAt(0)}${String(user?.last_name || '').trim().charAt(0)}`.toUpperCase() || 'N';
