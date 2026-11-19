
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell,
  CalendarDays,
  ChevronDown,
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
import clinicLogo from '../../assets/clinic-logo.webp';
import campusPhoto from '../../assets/pup-binan-hero.jpg';
import clinicScene from '../../assets/clinic-waiting-area.jpg';
import clinicVaccination from '../../assets/clinic-vaccination.jpg';

const HERO_SLIDES = [
  {
    src: clinicScene,
    alt: 'PUP Biñan Campus clinic waiting area',
    position: 'object-center',
    caption: 'Campus Clinic',
  },
  {
    src: campusPhoto,
    alt: 'Polytechnic University of the Philippines Biñan Campus building',
    position: 'object-[60%_center] lg:object-center',
    caption: 'PUP Biñan Campus',
  },
];

// Auto-advance cadence; the active dot's timer sweep matches this.
const HERO_INTERVAL_MS = 11000;

/* Slow glide for the header nav tabs: native 'smooth' scrolling finishes in a
   blink and reads as instant. This animates ~1.1s with an ease-in-out curve so
   the travel is visible. Works on the inner scroll container (md+) and the
   window (mobile) — whichever actually scrolls; the other is a harmless no-op.
   A wheel / touch gesture cancels the glide so it never fights the user. */
const GLIDE_MS = 1100;
const glideScroll = (scroller, targetTop) => {
  if (!scroller) return;
  if (scroller.__glideRaf) window.cancelAnimationFrame(scroller.__glideRaf);
  const start = scroller.scrollTop;
  const distance = targetTop - start;
  if (Math.abs(distance) < 1) return;
  const startAt = performance.now();
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const cancel = () => {
    if (scroller.__glideRaf) window.cancelAnimationFrame(scroller.__glideRaf);
    scroller.__glideRaf = null;
  };
  scroller.addEventListener('wheel', cancel, { once: true, passive: true });
  scroller.addEventListener('touchmove', cancel, { once: true, passive: true });
  const step = (now) => {
    const progress = Math.min(1, (now - startAt) / GLIDE_MS);
    scroller.scrollTop = start + distance * easeInOutCubic(progress);
    scroller.__glideRaf = progress < 1 ? window.requestAnimationFrame(step) : null;
  };
  scroller.__glideRaf = window.requestAnimationFrame(step);
};

// lucide-react v1 dropped brand icons, so these are inline lucide-style SVGs.
// TODO: replace the '#' hrefs with the official PUP Biñan pages.
const SOCIAL_LINKS = [
  {
    label: 'Facebook',
    href: '#',
    hoverColor: 'group-hover:text-[#1877f2]',
    icon: (
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    ),
  },
  {
    label: 'Instagram',
    href: '#',
    hoverColor: 'group-hover:text-[#e1306c]',
    icon: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </>
    ),
  },
  {
    label: 'YouTube',
    href: '#',
    hoverColor: 'group-hover:text-[#ff0000]',
    icon: (
      <>
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
        <path d="m10 15 5-3-5-3z" />
      </>
    ),
  },
  {
    label: 'LinkedIn',
    href: '#',
    hoverColor: 'group-hover:text-[#0a66c2]',
    icon: (
      <>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </>
    ),
  },
];

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

function SectionTitle({ title, description }) {
  return (
    <div className="mb-5">
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
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border-2 border-maroon-800 bg-white text-maroon-800 transition-colors duration-500 group-hover:duration-700 group-hover:bg-maroon-800 group-hover:text-white sm:h-14 sm:w-14">
        <Icon size={25} strokeWidth={2.5} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-slate-900">
          {feature.title}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {feature.description}
        </span>
      </span>

    </>
  );

  const classes =
    'group flex min-w-0 items-center gap-3 rounded-[10px] ' +
    'border border-slate-200/90 bg-white p-3.5 text-left ' +
    'shadow-sm sm:p-4';

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

function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = HERO_SLIDES.length;

  const goTo = useCallback(
    (index) => setActiveIndex((index + total) % total),
    [total],
  );

  // Owner call: the carousel must animate even when the OS asks for reduced
  // motion — with the gate on, the slide read as an instant switch.
  useEffect(() => {
    if (paused) return undefined;

    const timer = window.setTimeout(
      () => setActiveIndex((index) => (index + 1) % total),
      HERO_INTERVAL_MS,
    );

    return () => window.clearTimeout(timer);
  }, [activeIndex, paused, total]);

  return (
    // No z-index on the wrapper so the images can sit behind the gradient
    // overlays while the controls stay above them.
    <div
      className="pointer-events-none absolute inset-0"
      role="region"
      aria-roledescription="carousel"
      aria-label="Campus photos"
    >
      {HERO_SLIDES.map((slide, index) => (
        <img
          key={slide.caption}
          src={slide.src}
          alt={index === activeIndex ? slide.alt : ''}
          aria-hidden={index !== activeIndex}
          className={`absolute inset-0 -z-20 h-full w-full object-cover ${slide.position} transition-transform duration-[900ms] ease-out ${
            index === activeIndex
              ? 'translate-x-0'
              : index < activeIndex
                ? '-translate-x-full'
                : 'translate-x-full'
          }`}
          fetchPriority={index === 0 ? 'high' : 'low'}
          loading={index === 0 ? 'eager' : 'lazy'}
        />
      ))}

      <div
        className="pointer-events-auto absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 sm:bottom-6"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') goTo(activeIndex - 1);
          if (event.key === 'ArrowRight') goTo(activeIndex + 1);
        }}
      >
        {HERO_SLIDES.map((slide, index) => (
          <button
            key={slide.caption}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Show photo ${index + 1}: ${slide.caption}`}
            aria-current={index === activeIndex}
            className={`relative h-2 overflow-hidden rounded-full transition-all duration-500 ${
              index === activeIndex
                ? 'w-7 bg-white/30'
                : 'w-2 bg-white/45 hover:bg-white/70'
            }`}
          >
            {/* Timer sweep: the active dot fills over the slide interval. */}
            {index === activeIndex && (
              <motion.span
                key={activeIndex}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: HERO_INTERVAL_MS / 1000, ease: 'linear' }}
                className="absolute inset-y-0 left-0 rounded-full bg-white"
              />
            )}
          </button>
        ))}
      </div>
    </div>
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

  /* Header nav tabs glide to their section. '#home' targets the page wrapper,
     which is always in view — native fragment navigation is a no-op there —
     so glide the actual scrolling container (md+) and the window (mobile) to
     the top instead. The other tabs glide their section into view. */
  const scrollToSection = useCallback((event, href) => {
    event.preventDefault();
    closeMenu();
    const container = document.querySelector('.landing-scroll');
    if (href === '#home') {
      glideScroll(container, 0);
      glideScroll(document.scrollingElement, 0);
      return;
    }
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    if (container) {
      const top = target.getBoundingClientRect().top
        - container.getBoundingClientRect().top
        + container.scrollTop;
      glideScroll(container, top);
    }
    glideScroll(document.scrollingElement, target.getBoundingClientRect().top + window.scrollY);
  }, [closeMenu]);

  const loadAnnouncements = useCallback(async (signal) => {
    try {
      setAnnouncementsError(false);

      const response = await api.get('/announcements', {
        params: { limit: 3 },
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
      className="landing-page min-h-screen overflow-x-hidden md:flex md:h-dvh md:min-h-0 md:flex-col md:overflow-hidden bg-[#f8f9fc] text-slate-900 dark:bg-gray-900 dark:text-gray-100"
    >
      {/* HEADER */}
      <header className="sticky top-0 z-50 shrink-0 border-b border-slate-100 bg-gradient-to-b from-maroon-50 to-white shadow-sm dark:from-maroon-950/30 dark:to-gray-900">
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

            <span className="block truncate text-base font-black tracking-tight text-maroon-800 dark:text-rose-300 sm:text-lg">
              PUPBC CareLink
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="ml-4 mr-auto hidden items-center gap-1 lg:flex"
          >
            {NAVIGATION.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(event) => scrollToSection(event, item.href)}
                className="rounded-[10px] px-3 py-2 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-maroon-800 hover:text-white dark:hover:bg-maroon-900 dark:hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              to="/register"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-maroon-800 bg-white px-5 text-sm font-bold text-maroon-800 transition-colors duration-500 hover:bg-maroon-800 hover:text-white"
            >
              <UserRoundPlus size={17} />
              Get Started
            </Link>

            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-maroon-800 px-5 text-sm font-bold text-white transition-colors duration-300 hover:text-gray-300"
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-maroon-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 lg:hidden"
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
                  onClick={(event) => scrollToSection(event, item.href)}
                  className="block rounded-[10px] px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-maroon-800 hover:text-white dark:hover:bg-maroon-900 dark:hover:text-white"
                >
                  {item.label}
                </a>
              ))}

              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="flex min-h-11 items-center justify-center rounded-[10px] bg-rose-50 text-sm font-bold text-maroon-800 dark:text-rose-300"
                >
                  Get Started
                </Link>

                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="flex min-h-11 items-center justify-center rounded-[10px] bg-maroon-800 text-sm font-bold text-white"
                >
                  Login
                </Link>
              </div>
            </div>
          </nav>
        )}
      </header>

      {/* On tablet/desktop the page scrolls inside this area (like the
          dashboard's .student-shell-body) so the scrollbar starts below the
          header instead of running behind it. */}
      <div
        className="landing-scroll md:min-h-0 md:flex-1 md:overflow-y-auto md:overflow-x-hidden"
        data-route-scroll
      >
      {/* HERO */}
      <section
        className="relative isolate min-h-[calc(100dvh-73px)] overflow-hidden bg-maroon-950"
        aria-labelledby="landing-title"
      >
        <HeroCarousel />

        <div className="absolute inset-0 -z-10 bg-maroon-950/90" />

        <div className="mx-auto flex min-h-[inherit] max-w-[1440px] flex-col justify-center px-5 py-14 sm:px-8 lg:px-14 lg:py-16 max-lg:pb-20">
          <div className="max-w-[690px]">
            <p className="text-xs font-bold uppercase leading-5 tracking-[0.19em] text-white sm:text-xs">
              Polytechnic University of the Philippines
              <span className="hidden sm:inline">
                {' '}—{' '}
              </span>
              <span className="block sm:inline">
                Biñan Campus
              </span>
            </p>

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

            <p className="mt-5 max-w-xl text-[13px] leading-6 text-white sm:text-[15px] sm:leading-7">
              Book appointments, check in with QR, access
              your clinic health records and receive
              important updates, all in one place.
            </p>

            <div className="mt-7 flex flex-col gap-3 min-[410px]:flex-row">
              <a
                href="#how-it-works"
                onClick={(event) => scrollToSection(event, '#how-it-works')}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-maroon-800 px-6 text-sm font-extrabold text-white transition-colors duration-300 hover:text-gray-300"
              >
                How It Works
              </a>

              <a
                href="#services"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-white/60 bg-white/5 px-6 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                View Services
              </a>
            </div>

            <div className="mt-9 grid max-w-xl grid-cols-3 gap-3 text-white">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Smartphone size={17} />
                </span>
                <span>
                  <span className="block text-xs font-bold">
                    Accessible
                  </span>
                  <span className="block text-xs leading-4 text-white">
                    Across devices
                  </span>
                </span>
              </div>

              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <ShieldCheck size={17} />
                </span>
                <span>
                  <span className="block text-xs font-bold">
                    Protected
                  </span>
                  <span className="block text-xs leading-4 text-white">
                    Account access
                  </span>
                </span>
              </div>

              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Heart size={17} />
                </span>
                <span>
                  <span className="block text-xs font-bold">
                    Student-focused
                  </span>
                  <span className="block text-xs leading-4 text-white">
                    Campus healthcare
                  </span>
                </span>
              </div>
            </div>

            <p className="mt-6 font-serif text-sm italic text-white sm:text-base">
              “Smarter campus healthcare for every
              Iskolar ng Bayan.”
            </p>
          </div>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section
        aria-label="CareLink features"
        className="relative z-10 mx-auto mt-8 max-w-[1440px] sm:mt-10 px-4 sm:px-6 lg:px-10"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        className="mx-auto max-w-[1440px] scroll-mt-24 md:scroll-mt-4 px-4 pt-8 sm:px-6 lg:px-10 lg:pt-10"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
          <div
            id="how-it-works"
            className="scroll-mt-24 md:scroll-mt-4 flex flex-col rounded-[10px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7"
          >
            <SectionTitle
              title="How CareLink Works"
              description="Four simple steps to access campus clinic services."
            />

            <div className="grid flex-1 content-center gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div
                    key={step.title}
                    className="rounded-[10px] border border-slate-200/90 bg-white p-3.5 shadow-sm sm:p-4"
                  >
                    <Icon
                      size={24}
                      strokeWidth={2.5}
                      className="text-maroon-800 dark:text-rose-300"
                    />

                    <h3 className="mt-3 text-[13px] font-extrabold text-slate-900">
                      {index + 1}. {step.title}
                    </h3>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* A HEALTHIER YOU — ACTUAL CLINIC PHOTO */}
          <div className="group relative isolate min-h-[320px] overflow-hidden rounded-[10px] border border-slate-200/80 bg-white shadow-sm sm:min-h-[360px]">
            <img
              src={clinicVaccination}
              alt="Clinic nurse giving a vaccination to a PUP Biñan student"
              loading="lazy"
              className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_35%]"
            />

            {/* White overlay — fades away on hover to reveal the full photo. */}
            <div className="absolute inset-0 -z-10 bg-white/70 transition-opacity duration-500 group-hover:opacity-0" />

            <div className="flex h-full min-h-[320px] flex-col justify-between p-5 sm:min-h-[360px] sm:p-7">
              <div className="relative max-w-[255px]">
                {/* Frosted panel behind the text — fades in on hover. */}
                <div className="absolute -inset-4 z-[-1] rounded-[10px] bg-white/70 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="inline-flex rounded-[10px] border border-white/25 bg-maroon-800/85 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-white backdrop-blur-sm">
                  A Healthier You
                </span>

                <h2 className="mt-5 text-2xl font-extrabold leading-tight sm:text-[28px]">
                 
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Quality healthcare support for PUPBC student community.
                </p>
              </div>

              <div className="relative max-w-[260px]">
                {/* Frosted panel behind the quote — fades in on hover. */}
                <div className="absolute -inset-2 z-[-1] rounded-[10px] bg-white/70 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <p className="border-l-2 border-maroon-200 pl-3 text-xs font-medium leading-5 text-maroon-800 sm:text-sm">
                  We care for you - your health and well-being is our priority
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES + ANNOUNCEMENTS */}
      <section
        id="services"
        className="mx-auto max-w-[1440px] scroll-mt-24 md:scroll-mt-4 px-4 py-7 sm:px-6 lg:px-10"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
          <div className="flex flex-col rounded-[10px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
            <SectionTitle
              title="Our Clinic Services"
              description="Choose from the clinic appointment services available to PUP Biñan students."
            />

            <div className="grid flex-1 content-start grid-cols-2 gap-3 sm:grid-cols-3">
              {SERVICES.map((service) => {
                const Icon = service.icon;

                return (
                  <Link
                    key={service.title}
                    to="/login"
                    className="group flex min-w-0 flex-col rounded-[10px] border border-slate-200/90 bg-white p-3.5 text-left shadow-sm sm:p-4"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-2 border-maroon-800 bg-white text-maroon-800 transition-colors duration-500 group-hover:duration-700 group-hover:bg-maroon-800 group-hover:text-white">
                      <Icon size={20} strokeWidth={2.5} />
                    </span>

                    <h3 className="mt-3 text-[13px] font-extrabold text-slate-900">
                      {service.title}
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {service.description}
                    </p>
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
            className="scroll-mt-24 md:scroll-mt-4 flex flex-col rounded-[10px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7"
          >
            <div className="mb-5">
              <h2 className="text-xl font-extrabold text-slate-950 sm:text-2xl">
                Latest Announcements
              </h2>
            </div>

            {announcementsLoading ? (
              <div
                className="flex-1 space-y-3"
                aria-label="Loading announcements"
              >
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="animate-pulse rounded-[10px] border border-slate-100 p-3"
                  >
                    <div className="h-3 w-3/4 rounded bg-slate-200" />
                    <div className="mt-3 h-2 w-1/3 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : announcementsError ? (
              <div className="flex-1 rounded-[10px] bg-slate-50 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Unable to load announcements.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setAnnouncementsLoading(true);
                    loadAnnouncements();
                  }}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-maroon-800 dark:text-rose-300 hover:underline"
                >
                  <RefreshCw size={15} />
                  Try again
                </button>
              </div>
            ) : announcements.length === 0 ? (
              <div className="flex-1 rounded-[10px] bg-slate-50 px-4 py-7 text-center">
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
              <div className="flex-1 space-y-3">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="flex items-start gap-3 rounded-[10px] border border-slate-200/90 bg-white p-3 shadow-sm"
                  >
                    <Megaphone
                      size={20}
                      strokeWidth={2.5}
                      className="mt-0.5 shrink-0 text-maroon-800"
                    />

                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 text-[13px] font-bold text-slate-900">
                        {announcement.title}
                      </h3>

                      <p className="mt-1 line-clamp-1 text-xs leading-5 text-slate-500">
                        {announcement.content}
                      </p>
                    </div>

                    <span className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-400">
                      {formatAnnouncementDate(
                        announcement.published_at ||
                          announcement.created_at
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-5 text-xs leading-5 text-slate-900">
              Sign in to receive your personal clinic notifications and
              appointment updates.{' '}
              <Link
                to="/login"
                className="font-extrabold text-slate-900 underline underline-offset-2 hover:no-underline"
              >
                Open Student Portal
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-10">
        <div className="rounded-[10px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
          <SectionTitle
            title="Frequently Asked Questions"
            description="Quick answers about using the CareLink Student Portal."
          />

          <div className="grid items-start gap-x-5 gap-y-2 lg:grid-cols-2">
            {FAQS.map((faq, index) => (
              <div
                key={faq.question}
                className="overflow-hidden rounded-[10px] border border-slate-200"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenFaq((current) =>
                      current === index ? null : index
                    )
                  }
                  aria-expanded={openFaq === index}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13px] font-bold text-slate-800 transition-colors duration-500 hover:bg-maroon-800 hover:text-white"
                >
                  {faq.question}

                  <ChevronDown
                    size={17}
                    className={`shrink-0 transition ${
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
      <section className="relative overflow-hidden bg-maroon-950 text-white">
        <img
          src={campusPhoto}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-15"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-maroon-950 via-maroon-800/90 to-maroon-950/85" />

        <div className="relative mx-auto grid max-w-[1440px] gap-7 px-5 py-9 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:px-14">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">
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

              <p className="mt-1 text-xs text-white/60">
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

              <p className="mt-1 text-xs text-white/60">
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

              <p className="mt-1 text-xs text-white/60">
                Within reach
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT + FOOTER */}
      <footer
        id="contact"
        className="scroll-mt-24 md:scroll-mt-4 bg-white"
      >
        <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-9 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr] lg:px-14">
          <div>
            <div className="flex items-center gap-3">
              <img
                src={clinicLogo}
                alt="PUPBC clinic logo"
                className="h-11 w-11 rounded-full object-cover"
              />

              <p className="text-sm font-black text-maroon-800 dark:text-rose-300">
                PUPBC CareLink
              </p>
            </div>

            <p className="mt-4 max-w-sm text-xs leading-6 text-slate-500">
              A QR Integrated Health Information System
              with Self-service Triage Kiosk for
              PUP Biñan Campus.
            </p>

            <div className="mt-4 flex items-center gap-2">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="group flex h-9 w-9 items-center justify-center rounded-full bg-maroon-800 text-white transition hover:-translate-y-0.5 hover:bg-slate-100"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="17"
                    height="17"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={`transition-colors duration-300 ${social.hoverColor}`}
                  >
                    {social.icon}
                  </svg>
                </a>
              ))}
            </div>
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
                  className="hover:text-maroon-800"
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
                className="mt-0.5 shrink-0 text-maroon-800 dark:text-rose-300"
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
          <div className="mx-auto max-w-[1440px] px-5 py-5 text-center text-xs text-slate-400 lg:px-14">
            <span>
              © {currentYear} PUPBC CareLink.
              All rights reserved.
            </span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
