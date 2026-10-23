import {
  Bell,
  BookOpen,
  Calendar,
  FileText,
  LayoutDashboard,
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
 */
export const NURSE_NAV_ITEMS = [
  { path: '/nurse/dashboard', icon: LayoutDashboard, label: 'Dashboard', dock: true },
  { path: '/nurse/appointments', icon: Calendar, label: 'Appointments', dock: true },
  { path: '/nurse/consultation', icon: Stethoscope, label: 'Consultation', dock: true },
  { path: '/nurse/students', icon: Users, label: 'Students', dock: true },
  { path: '/nurse/academic', icon: BookOpen, label: 'Courses' },
  { path: '/nurse/medicines', icon: Pill, label: 'Medicines' },
  { path: '/nurse/announcements', icon: Megaphone, label: 'Announcements' },
  { path: '/nurse/records', icon: FileText, label: 'Records' },
  { path: '/nurse/notifications', icon: Bell, label: 'Notifications' },
  { path: '/nurse/settings', icon: Settings, label: 'Settings' },
];

export const isNurseNavActive = (pathname, path) =>
  pathname === path || pathname.startsWith(`${path}/`);

export const nurseDisplayName = (user) =>
  [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || 'Nurse';

export const nurseInitials = (user) =>
  `${String(user?.first_name || '').trim().charAt(0)}${String(user?.last_name || '').trim().charAt(0)}`.toUpperCase() || 'N';
