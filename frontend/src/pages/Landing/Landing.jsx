
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileHeart,
  FileText,
  GraduationCap,
  Heart,
  HeartPulse,
  LogIn,
  MapPin,
  Megaphone,
  Menu,
  Monitor,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  UserRoundPlus,
  X,
} from 'lucide-react';

import api from '../../services/api';
import clinicLogo from '../../assets/clinic logo.jpg';
import campusPhoto from '../../assets/pup-binan-hero.jpg';
import clinicScene from '../../assets/clinic-waiting-area.jpg';

const NAVIGATION = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Announcements', href: '#announcements' },
  { label: 'Contact', href: '#contact' },
];

const FEATURES = [
  {
    icon: GraduationCap,
    title: 'Student Portal',
    description:
      'Manage your appointments, health records and student account.',
    href: '/login',
  },
  {
    icon: QrCode,
    title: 'QR Check-in',
    description:
      'Quick clinic check-in on the day of your approved appointment.',
    href: '#how-it-works',
  },
  {
    icon: FileHeart,
    title: 'Health Records',
    description:
      'View your recorded consultations and available medical certificates.',
    href: '#services',
  },
  {
    icon: CalendarDays,
    title: 'Appointments',
    description:
      'Book, edit or cancel eligible clinic appointments.',
    href: '/login',
  },
];

const STEPS = [
  {
    icon: UserRoundPlus,
    title: 'Create Account',
    description:
      'Register using your student details and verify your email.',
  },
  {
    icon: ClipboardList,
    title: 'Complete Health Profile',
    description:
      'Provide your required health information during your first login.',
  },
  {
    icon: CalendarDays,
    title: 'Book Appointment',
    description:
      'Select a clinic service, available date and time slot.',
  },
  {
    icon: QrCode,
    title: 'Check In with QR',
    description:
      'Present your QR code on your approved appointment day.',
  },
];

const SERVICES = [
  {
    icon: Stethoscope,
    title: 'Consultation',
    description:
      'Schedule a clinic consultation for your health concerns.',
  },
  {
    icon: FileText,
    title: 'Medical Certificate',
    description:
      'Request a medical certificate through a clinic appointment.',
  },
  {
    icon: ShieldCheck,
    title: 'Medical Clearance',
    description:
      'Request medical clearance through the clinic.',
  },
  {
    icon: HeartPulse,
    title: 'Follow-up Checkup',
    description:
      'Schedule a recommended follow-up clinic visit.',
  },
];

const FAQS = [
  {
    question: 'How do I register?',
    answer:
      'Select Get Started, enter your official student details and verify your email using the registration OTP. After your first login, complete your Health Profile.',
  },
  {
    question: 'When can I use my QR code?',
    answer:
      'Your check-in QR code becomes usable on the day of your approved appointment, provided that your QR credential is valid.',
  },
  {
    question: 'Can I change my appointment?',
    answer:
      'You can edit a pending appointment or cancel an eligible appointment according to its current status and clinic queue rules.',
  },
  {
    question: 'Where can I see my health records?',
    answer:
      'Sign in to your Student Portal and open Health Records to see the clinic consultation records available to your account.',
  },
];

function formatAnnouncementDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function SectionTitle({ eyebrow, title, description }) {
  return (
    <div className="mb-5">
      {eyebrow && (
        <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8b1730]">
          {eyebrow}
        </p>
      )}

      <h2 className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl lg:text-[27px]">
        {title}
      </h2>

      {description && (
        <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-slate-500 sm:text-sm">
          {description}
        </p>
      )}
    </div>
  );
}

function FeatureCard({ feature }) {
  const Icon = feature.icon;

  const content = (
    <>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f9e9ee] text-[#741126] sm:h-14 sm:w-14">
        <Icon size={25} strokeWidth={1.9} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-slate-900">
          {feature.title}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {feature.description}
        </span>
      </span>

      <ChevronRight
        size={18}
        className="shrink-0 text-[#741126] transition-transform group-hover:translate-x-1"
      />
    </>
  );

  const classes =
    'group flex min-w-0 items-center gap-3 rounded-2xl ' +
    'border border-slate-200/90 bg-white p-3.5 text-left ' +
    'shadow-sm transition-all duration-200 hover:-translate-y-0.5 ' +
    'hover:border-rose-200 hover:shadow-lg sm:p-4';

  if (feature.href.startsWith('#')) {
    return (
      <a href={feature.href} className={classes}>
        {content}
      </a>
    );
  }

  return (
    <Link to={feature.href} className={classes}>
      {content}
    </Link>
  );
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] =
    useState(true);
  const [announcementsError, setAnnouncementsError] =
    useState(false);

  const currentYear = new Date().getFullYear();

  const closeMenu = () => setMobileMenuOpen(false);

  const loadAnnouncements = useCallback(async (signal) => {
    try {
      setAnnouncementsError(false);

      const response = await api.get('/announcements', {
        signal,
      });

      const payload = response.data?.data;

      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      if (!signal?.aborted) {
        setAnnouncements(items.slice(0, 3));
      }
    } catch (error) {
      if (
        error?.code !== 'ERR_CANCELED' &&
        !signal?.aborted
      ) {
        setAnnouncementsError(true);
      }
    } finally {
      if (!signal?.aborted) {
        setAnnouncementsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadAnnouncements(controller.signal);

    return () => controller.abort();
  }, [loadAnnouncements]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen]);

  return (
    <div
      id="home"
      className="min-h-screen overflow-x-hidden bg-[#f8f9fc] text-slate-900"
    >
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link
            to="/"
            onClick={closeMenu}
            className="flex min-w-0 shrink-0 items-center gap-2.5"
          >
            <img
              src={clinicLogo}
              alt="PUPBC CareLink clinic logo"
              className="h-11 w-11 shrink-0 rounded-full bg-white object-cover sm:h-12 sm:w-12"
            />

            <span className="block truncate text-base font-black tracking-tight text-[#701126] sm:text-lg">
              PUPBC CareLink
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-1 lg:flex"
          >
            {NAVIGATION.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-[#741126]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              to="/register"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-5 text-sm font-bold text-[#741126] transition hover:bg-rose-100"
            >
              <UserRoundPlus size={17} />
              Get Started
            </Link>

            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#741126] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#4d0d1b]"
            >
              <LogIn size={17} />
              Login
            </Link>
          </div>

          <button
            type="button"
            onClick={() =>
              setMobileMenuOpen((open) => !open)
            }
            aria-label={
              mobileMenuOpen
                ? 'Close navigation'
                : 'Open navigation'
            }
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#741126] hover:bg-rose-50 lg:hidden"
          >
            {mobileMenuOpen ? (
              <X size={23} />
            ) : (
              <Menu size={23} />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav
            id="landing-mobile-menu"
            aria-label="Mobile navigation"
            className="border-t border-slate-100 bg-white px-4 py-3 shadow-xl lg:hidden"
          >
            <div className="mx-auto max-w-xl space-y-1">
              {NAVIGATION.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="block rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-[#741126]"
                >
                  {item.label}
                </a>
              ))}

              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="flex min-h-11 items-center justify-center rounded-xl bg-rose-50 text-sm font-bold text-[#741126]"
                >
                  Get Started
                </Link>

                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="flex min-h-11 items-center justify-center rounded-xl bg-[#741126] text-sm font-bold text-white"
                >
                  Login
                </Link>
              </div>
            </div>
          </nav>
        )}
      </header>

      {/* HERO */}
      <section
        className="relative isolate min-h-[540px] overflow-hidden bg-[#4d0d1b] sm:min-h-[570px] lg:min-h-[500px]"
        aria-labelledby="landing-title"
      >
        <img
          src={campusPhoto}
          alt="Polytechnic University of the Philippines Biñan Campus building"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_center] lg:object-center"
          fetchPriority="high"
        />

        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#4d0d1b]/98 via-[#611322]/90 to-[#741126]/35 lg:via-[#611322]/78 lg:to-[#4d0d1b]/10" />

        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#4d0d1b]/75 via-transparent to-transparent" />

        <div className="mx-auto flex min-h-[540px] max-w-[1440px] flex-col justify-center px-5 py-14 sm:min-h-[570px] sm:px-8 lg:min-h-[500px] lg:px-14 lg:py-16">
          <div className="max-w-[690px]">
            <p className="text-[10px] font-bold uppercase leading-5 tracking-[0.19em] text-rose-100 sm:text-xs">
              Polytechnic University of the Philippines
              <span className="hidden sm:inline">
                {' '}—{' '}
              </span>
              <span className="block sm:inline">
                Biñan Campus
              </span>
            </p>

            <div className="mt-3 h-0.5 w-14 bg-rose-200/80" />

            <h1
              id="landing-title"
              className="mt-5 text-[33px] font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[54px]"
            >
              PUPBC CareLink
            </h1>

            <p className="mt-3 max-w-[630px] text-xl font-bold leading-tight text-white sm:text-[29px]">
              A QR Integrated Health Information System
              with Self-service Triage Kiosk
            </p>

            <p className="mt-5 max-w-xl text-[13px] leading-6 text-rose-50/90 sm:text-[15px] sm:leading-7">
              Book appointments, check in with QR, access
              your clinic health records and receive
              important updates — all in one place.
            </p>

            <div className="mt-7 flex flex-col gap-3 min-[410px]:flex-row">
              <Link
                to="/register"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#b92e4e] to-[#87172f] px-6 text-sm font-extrabold text-white shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:from-[#c13959]"
              >
                Get Started
                <ArrowRight size={17} />
              </Link>

              <a
                href="#services"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/5 px-6 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                View Services
                <ChevronRight size={17} />
              </a>
            </div>

            <div className="mt-9 grid max-w-xl grid-cols-3 gap-3 border-t border-white/20 pt-5 text-white">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Smartphone size={17} />
                </span>
                <span>
                  <span className="block text-[11px] font-bold">
                    Accessible
                  </span>
                  <span className="block text-[10px] leading-4 text-rose-100/75">
                    Across devices
                  </span>
                </span>
              </div>

              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <ShieldCheck size={17} />
                </span>
                <span>
                  <span className="block text-[11px] font-bold">
                    Protected
                  </span>
                  <span className="block text-[10px] leading-4 text-rose-100/75">
                    Account access
                  </span>
                </span>
              </div>

              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Heart size={17} />
                </span>
                <span>
                  <span className="block text-[11px] font-bold">
                    Student-focused
                  </span>
                  <span className="block text-[10px] leading-4 text-rose-100/75">
                    Campus healthcare
                  </span>
                </span>
              </div>
            </div>

            <p className="mt-6 font-serif text-sm italic text-rose-100/85 sm:text-base">
              “Smarter campus healthcare for every
              Iskolar ng Bayan.”
            </p>
          </div>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section
        aria-label="CareLink features"
        className="relative z-10 mx-auto -mt-6 max-w-[1440px] px-4 sm:px-6 lg:px-10"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
            />
          ))}
        </div>
      </section>

      {/* HOW CARELINK WORKS + CLINIC PHOTO */}
      <section
        id="about"
        className="mx-auto max-w-[1440px] scroll-mt-24 px-4 pt-12 sm:px-6 lg:px-10 lg:pt-16"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
          <div
            id="how-it-works"
            className="scroll-mt-24 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7"
          >
            <SectionTitle
              eyebrow="Get Started"
              title="How CareLink Works"
              description="Four simple steps to access campus clinic services."
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div
                    key={step.title}
                    className="relative rounded-2xl border border-rose-100 bg-gradient-to-b from-white to-[#fff8fa] p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#741126] text-xs font-extrabold text-white">
                        {index + 1}
                      </span>

                      <Icon
                        size={21}
                        className="text-[#8b1730]"
                      />
                    </div>

                    <h3 className="text-[13px] font-extrabold text-slate-900">
                      {step.title}
                    </h3>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
              <p className="text-xs font-medium text-[#741126]">
                Your first clinic appointment starts with
                your CareLink account.
              </p>

              <Link
                to="/register"
                className="inline-flex items-center gap-1 text-xs font-extrabold text-[#741126] hover:underline"
              >
                Create an account
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* A HEALTHIER YOU — ACTUAL CLINIC PHOTO */}
          <div className="relative isolate min-h-[320px] overflow-hidden rounded-3xl border border-slate-200/80 bg-[#4d0d1b] text-white shadow-sm sm:min-h-[360px]">
            <img
              src={clinicScene}
              alt="Students waiting and completing forms inside a clinic"
              loading="lazy"
              className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
            />

            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#4d0d1b]/95 via-[#741126]/65 to-[#4d0d1b]/5" />

            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#4d0d1b]/70 via-transparent to-transparent" />

            <div className="flex h-full min-h-[320px] flex-col justify-between p-5 sm:min-h-[360px] sm:p-7">
              <div className="max-w-[255px]">
                <span className="inline-flex rounded-lg border border-white/25 bg-[#741126]/85 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm">
                  A Healthier You
                </span>

                <h2 className="mt-5 text-2xl font-extrabold leading-tight sm:text-[28px]">
                 
                </h2>

                <p className="mt-3 text-sm leading-6 text-white/95">
                  Quality healthcare support for PUPBC student community.
                </p>
              </div>

              <p className="max-w-[260px] border-l-2 border-rose-200 pl-3 text-xs font-medium leading-5 text-rose-50 sm:text-sm">
                We care for you - your health and well-being is our priority
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES + ANNOUNCEMENTS */}
      <section
        id="services"
        className="mx-auto max-w-[1440px] scroll-mt-24 px-4 py-7 sm:px-6 lg:px-10"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
            <SectionTitle
              eyebrow="Student Health Services"
              title="Our Clinic Services"
              description="Choose from the clinic appointment services available to PUP Biñan students."
            />

            <div className="grid grid-cols-2 gap-3">
              {SERVICES.map((service) => {
                const Icon = service.icon;

                return (
                  <Link
                    key={service.title}
                    to="/login"
                    className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-rose-200 hover:bg-rose-50/40 sm:min-h-[155px]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f9e9ee] text-[#741126]">
                      <Icon size={21} />
                    </span>

                    <h3 className="mt-3 text-[13px] font-extrabold text-slate-900">
                      {service.title}
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {service.description}
                    </p>

                    <ArrowRight
                      size={15}
                      className="mt-3 text-[#741126] transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                );
              })}
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Appointment availability and service
              procedures depend on the clinic schedule.
            </p>
          </div>

          <div
            id="announcements"
            className="scroll-mt-24 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8b1730]">
                  Campus Updates
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">
                  Latest Announcements
                </h2>
              </div>

              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f9e9ee] text-[#741126]">
                <Megaphone size={21} />
              </span>
            </div>

            {announcementsLoading ? (
              <div
                className="space-y-3"
                aria-label="Loading announcements"
              >
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-xl border border-slate-100 p-3"
                  >
                    <div className="h-3 w-3/4 rounded bg-slate-200" />
                    <div className="mt-3 h-2 w-1/3 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : announcementsError ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Unable to load announcements.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setAnnouncementsLoading(true);
                    loadAnnouncements();
                  }}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#741126] hover:underline"
                >
                  <RefreshCw size={15} />
                  Try again
                </button>
              </div>
            ) : announcements.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-7 text-center">
                <Bell
                  size={26}
                  className="mx-auto text-slate-400"
                />

                <p className="mt-3 text-sm font-semibold text-slate-700">
                  No announcements yet
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Published clinic announcements will
                  appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="flex gap-3 py-3 first:pt-0"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#741126]">
                      <Megaphone size={17} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-[13px] font-bold text-slate-900">
                        {announcement.title}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {announcement.content}
                      </p>

                      <p className="mt-1.5 text-[11px] font-medium text-slate-400">
                        {formatAnnouncementDate(
                          announcement.published_at ||
                            announcement.created_at
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50 p-3">
              <p className="text-xs leading-5 text-[#741126]">
                Sign in to receive your personal clinic
                notifications and appointment updates.
              </p>

              <Link
                to="/login"
                className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-[#741126] hover:underline"
              >
                Open Student Portal
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-10">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
          <SectionTitle
            eyebrow="Questions & Answers"
            title="Frequently Asked Questions"
            description="Quick answers about using the CareLink Student Portal."
          />

          <div className="grid items-start gap-x-5 gap-y-2 lg:grid-cols-2">
            {FAQS.map((faq, index) => (
              <div
                key={faq.question}
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenFaq((current) =>
                      current === index ? null : index
                    )
                  }
                  aria-expanded={openFaq === index}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13px] font-bold text-slate-800 hover:bg-rose-50"
                >
                  {faq.question}

                  <ChevronDown
                    size={17}
                    className={`shrink-0 text-[#741126] transition-transform ${
                      openFaq === index
                        ? 'rotate-180'
                        : ''
                    }`}
                  />
                </button>

                {openFaq === index && (
                  <div className="border-t border-slate-100 px-4 py-3 text-xs leading-6 text-slate-600">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESPONSIVE BANNER */}
      <section className="relative overflow-hidden bg-[#4d0d1b] text-white">
        <img
          src={campusPhoto}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-15"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#4d0d1b] via-[#741126]/90 to-[#4d0d1b]/85" />

        <div className="relative mx-auto grid max-w-[1440px] gap-7 px-5 py-9 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:px-14">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-rose-200/75">
              Better access. A healthier campus.
            </p>

            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              Designed for PUP Biñan Students
            </h2>

            <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">
              Use CareLink to manage your campus clinic
              transactions across your devices.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <Monitor
                size={23}
                className="mx-auto text-rose-200"
              />

              <p className="mt-2 text-xs font-bold">
                Desktop
              </p>

              <p className="mt-1 text-[11px] text-white/60">
                Full experience
              </p>
            </div>

            <div>
              <Smartphone
                size={23}
                className="mx-auto text-rose-200"
              />

              <p className="mt-2 text-xs font-bold">
                Tablet
              </p>

              <p className="mt-1 text-[11px] text-white/60">
                On the go
              </p>
            </div>

            <div>
              <Smartphone
                size={23}
                className="mx-auto text-rose-200"
              />

              <p className="mt-2 text-xs font-bold">
                Mobile
              </p>

              <p className="mt-1 text-[11px] text-white/60">
                Within reach
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT + FOOTER */}
      <footer
        id="contact"
        className="scroll-mt-24 bg-white"
      >
        <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-9 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr] lg:px-14">
          <div>
            <div className="flex items-center gap-3">
              <img
                src={clinicLogo}
                alt="PUPBC clinic logo"
                className="h-11 w-11 rounded-full object-cover"
              />

              <p className="text-sm font-black text-[#741126]">
                PUPBC CareLink
              </p>
            </div>

            <p className="mt-4 max-w-sm text-xs leading-6 text-slate-500">
              A QR Integrated Health Information System
              with Self-service Triage Kiosk for
              PUP Biñan Campus.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Quick Links
            </h3>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-medium text-slate-600">
              {NAVIGATION.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="hover:text-[#741126]"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Campus Clinic
            </h3>

            <p className="mt-3 flex items-start gap-2 text-xs leading-6 text-slate-600">
              <MapPin
                size={17}
                className="mt-0.5 shrink-0 text-[#741126]"
              />

              <span>
                Polytechnic University of the Philippines
                <br />
                Biñan Campus
                <br />
                Biñan, Laguna
              </span>
            </p>

            <p className="mt-3 text-xs leading-6 text-slate-500">
              For medical concerns or account assistance,
              contact your campus clinic through its
              official channels.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-5 py-5 text-center text-[11px] text-slate-400 sm:flex-row sm:text-left lg:px-14">
            <span>
              © {currentYear} PUPBC CareLink.
              All rights reserved.
            </span>

            <span>
              Smarter campus healthcare for every
              Iskolar ng Bayan.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}