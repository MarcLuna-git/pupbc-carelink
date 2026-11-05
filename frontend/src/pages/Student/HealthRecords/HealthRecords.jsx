import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Stethoscope,
  ClipboardList,
  CalendarDays,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Printer,
  X,
} from 'lucide-react';
import api from '../../../services/api';
import StudentPageHero from '../../../components/StudentPageHero';
import { SearchField } from '../../../components/StudentSearchFilter';
import { useStudentBreadcrumbTab } from '../../../utils/studentBreadcrumb';
import { openRecordDocument } from './recordDocuments';
import { StudentToast } from '../../../components/StudentFeedback';

/*
 * ROUTE LOADING — same restored effect as the Settings / Profile pages,
 * scoped to this page. TEMP DEMO TIMER: holds the loading phase so the
 * animation is visible even when the API answers quickly on localhost.
 */
const ROUTE_LOADING_DELAY = 1600;

const CARD = 'rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface)]';
const FIELD_LABEL = 'mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300';

const RECORDS_HERO = {
  id: 'records-title',
  title: 'Records',
  description: 'View your consultation records, health documents, and clinic history.',
};

const TABS = [
  { id: 'consultations', label: 'Consultation Records', icon: Stethoscope },
  { id: 'certificates', label: 'Medical Certificates', icon: FileText },
];

const DEFAULT_FILTERS = { type: 'all', year: 'all', sort: 'newest' };

const PAGE_SIZE = 7;

const CLINIC_TZ = 'Asia/Manila';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { timeZone: CLINIC_TZ, month: 'short', day: 'numeric', year: 'numeric' });

const formatLongDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { timeZone: CLINIC_TZ, month: 'long', day: 'numeric', year: 'numeric' });

const formatDayTime = (value) =>
  new Date(value).toLocaleString('en-US', { timeZone: CLINIC_TZ, weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

const clinicYear = (value) =>
  new Intl.DateTimeFormat('en', { timeZone: CLINIC_TZ, year: 'numeric' }).format(new Date(value));

/* API row → the shape every view on this page reads. */
const toRecord = (c, index) => {
  const isEmergency = c.record_type === 'emergency';
  const nurseName = c.nurse ? `${c.nurse.first_name || ''} ${c.nurse.last_name || ''}`.trim() : '';
  return {
    id: `${c.record_type}-${c.id || index}`,
    date: c.occurred_at,
    recordType: c.record_type,
    title: isEmergency
      ? `Emergency: ${c.reason || 'Encounter'}`
      : c.chief_complaint || c.appointment?.service || 'Consultation',
    complaint: (isEmergency ? c.reason : c.chief_complaint) || c.appointment?.service || 'Not recorded',
    diagnosis: (isEmergency ? c.assessment : c.general_remarks) || '',
    notesLabel: isEmergency ? 'Intervention' : 'General Remarks / Clinical Notes',
    notesValue: (isEmergency ? c.intervention : c.general_remarks) || 'Not recorded',
    symptoms: c.symptoms || '',
    disposition: c.disposition || '',
    appointment: c.appointment || null,
    medicalCertificate: Boolean(c.medical_certificate),
    medicalCertificateRef: c.medical_certificate_ref || '',
    followUpRequired: Boolean(c.follow_up_required),
    followUpDate: c.follow_up_date || '',
    staff: nurseName ? `Nurse ${nurseName}` : 'Clinic Staff',
    staffRole: 'Clinic Nurse',
    vitals: {
      bp: c.vital_signs?.bp || null,
      hr: c.vital_signs?.hr || null,
      temp: c.vital_signs?.temp || null,
      rr: c.vital_signs?.rr || null,
      o2: c.vital_signs?.o2_sat || null,
    },
    status: c.status || 'completed',
  };
};

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700 ${className}`} />
);

const StatCard = ({ icon: Icon, label, value, hint }) => (
  <div className={`${CARD} flex items-center gap-4 p-4 lg:p-5`}>
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300">
      <Icon className="h-7 w-7" />
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      <p className="truncate text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  </div>
);

const StatusBadge = ({ status }) => (
  <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold capitalize text-green-700 dark:bg-green-900/20 dark:text-green-400">
    <span className="h-2 w-2 rounded-full bg-green-600 dark:bg-green-400" />
    {status}
  </span>
);

const TypeTag = ({ record }) =>
  record.recordType === 'emergency' ? (
    <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs font-semibold uppercase text-red-700 dark:bg-red-900/20 dark:text-red-400">
      Emergency
    </span>
  ) : null;

/* Row print button: the certificate on the Certificates tab, the consultation form otherwise.
   Styled like View Details; the "Print" label shows only with the desktop table (lg+), icon only below. */
const PrintButton = ({ record, kind, onDocument }) => {
  const label = kind === 'certificate' ? 'Print medical certificate' : 'Print consultation form';
  return (
    <button
      type="button"
      onClick={() => onDocument(kind, record, 'print')}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 px-2.5 py-2 text-sm font-semibold text-maroon-800 transition hover:bg-gray-50 dark:border-gray-600 dark:text-maroon-300 dark:hover:bg-gray-900/30 lg:px-3"
    >
      <Printer className="h-4 w-4" />
      <span className="hidden lg:inline">Print</span>
    </button>
  );
};

const ViewButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-maroon-800 transition hover:bg-gray-50 dark:border-gray-600 dark:text-maroon-300 dark:hover:bg-gray-900/30"
  >
    <FileText className="h-4 w-4" /> View Details
  </button>
);

/* Full record in a dialog — portaled because the page wrapper animates
   `transform`, which would break position:fixed. */
const RecordDialog = ({ record, onClose, onDocument }) => {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const vitals = [
    ['BP', record.vitals.bp, 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'],
    ['HR', record.vitals.hr, 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'],
    ['Temp', record.vitals.temp, 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'],
    ['RR', record.vitals.rr, 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'],
    ['O2', record.vitals.o2, 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'],
  ].filter(([, value]) => value);

  const field = (label, value) => (
    <div className="rounded-xl bg-gray-50 p-3.5 dark:bg-gray-700/30">
      <p className="mb-1 text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      <p className="whitespace-pre-wrap break-words text-sm font-medium text-gray-800 dark:text-gray-200">{value || 'Not recorded'}</p>
    </div>
  );

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-dialog-title"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--sp-surface,#fff)] p-5 shadow-2xl dark:bg-gray-800 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700 dark:text-maroon-300">
              {record.recordType === 'emergency' ? 'Emergency encounter' : 'Consultation record'}
            </p>
            <h2 id="record-dialog-title" className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {record.title}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formatLongDate(record.date)} · {formatDayTime(record.date)} · {record.staff}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {vitals.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Vital Signs</p>
            <div className="flex flex-wrap gap-2">
              {vitals.map(([label, value, tone]) => (
                <span key={label} className={`rounded-xl px-2.5 py-1.5 text-xs font-medium ${tone}`}>
                  {label}: {value}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {field(record.recordType === 'emergency' ? 'Reason' : 'Chief Complaint', record.complaint)}
          {field(record.recordType === 'emergency' ? 'Assessment' : 'Diagnosis / Findings', record.diagnosis)}
          {record.recordType === 'emergency' && field(record.notesLabel, record.notesValue)}
          {record.symptoms && field('Symptoms', record.symptoms)}
          {record.appointment?.service && field('Appointment Service', record.appointment.service)}
          {record.disposition && field('Disposition', record.disposition)}
          {field('Follow-up', record.followUpRequired
            ? `Required${record.followUpDate ? ` — ${formatLongDate(record.followUpDate)}` : ''}`
            : 'Not required')}
          {record.medicalCertificate && field('Medical Certificate', record.medicalCertificateRef || 'Issued')}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
          {record.medicalCertificate && (
            <button
              type="button"
              onClick={() => onDocument('certificate', record, 'print')}
              className="inline-flex items-center gap-2 rounded-lg border border-maroon-800 px-4 py-2 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 dark:border-maroon-700 dark:text-maroon-300 dark:hover:bg-maroon-900/20"
            >
              <Printer className="h-4 w-4" /> Print certificate
            </button>
          )}
          <button
            type="button"
            onClick={() => onDocument('consultation', record, 'print')}
            className="inline-flex items-center gap-2 rounded-lg bg-maroon-800 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-900"
          >
            <Printer className="h-4 w-4" /> Print consultation form
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

const HealthRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('consultations');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  useStudentBreadcrumbTab(TABS.find(({ id }) => id === tab)?.label);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [page, setPage] = useState(1);
  /* Cosmetic hold for the route-loading animation — see ROUTE LOADING note. */
  const [routeReady, setRouteReady] = useState(false);


  useEffect(() => {
    fetchRecords();
  }, []);

  /* Demo timer: keeps the loading phase on screen long enough to see it. */
  useEffect(() => {
    const timer = setTimeout(() => setRouteReady(true), ROUTE_LOADING_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/student/clinic-history');
      if (response.data.success) {
        const data = response.data.data;
        const rows = Array.isArray(data) ? data : (data?.data || []);
        setRecords(rows.map(toRecord).sort((a, b) => new Date(b.date) - new Date(a.date)));
      }
    } catch (err) {
      console.log('Records error:', err);
      setError('Unable to load health records.');
    } finally {
      setLoading(false);
    }
  };

  const handleDocument = (kind, record, mode) => {
    if (!openRecordDocument(kind, record, mode)) {
      setNotice('Pop-up was blocked. Please allow pop-ups to view or print documents.');
    }
  };

  const years = useMemo(
    () => [...new Set(records.map((r) => clinicYear(r.date)))].sort((a, b) => b.localeCompare(a)),
    [records]
  );

  const certificates = useMemo(() => records.filter((r) => r.medicalCertificate), [records]);

  const visibleRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = tab === 'certificates' ? certificates : records;
    const matches = source.filter((r) => {
      const matchesSearch = !term || [r.title, r.complaint, r.diagnosis, r.notesValue, r.staff, r.medicalCertificateRef]
        .some((value) => value.toLowerCase().includes(term));
      const matchesYear = filters.year === 'all' || clinicYear(r.date) === filters.year;
      const matchesType = filters.type === 'all' || r.recordType === filters.type;
      return matchesSearch && matchesYear && matchesType;
    });
    return matches.sort((a, b) => {
      if (filters.sort === 'oldest') return new Date(a.date) - new Date(b.date);
      if (filters.sort === 'title') return a.title.localeCompare(b.title);
      return new Date(b.date) - new Date(a.date);
    });
  }, [records, certificates, tab, search, filters]);

  /* A new tab, search or filter starts again from the first page. */
  useEffect(() => setPage(1), [tab, search, filters]);

  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRecords = visibleRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeFilterCount = Object.keys(DEFAULT_FILTERS).filter((key) => filters[key] !== DEFAULT_FILTERS[key]).length;
  const isFiltering = Boolean(search.trim()) || activeFilterCount > 0;

  const consultationCount = records.filter((r) => r.recordType === 'consultation').length;
  const followUpCount = records.filter((r) => r.followUpRequired).length;
  const lastVisit = records[0] || null;

  /*
   * LOADING PHASE — the hero is real, with the looping progress bar on its
   * bottom edge ONLY (same as the Settings hero — never on the cards). The
   * stats and records cards render as 1:1 ghosts. Skipped
   * entirely on error so the Retry banner appears right away.
   */
  if (loading || (!routeReady && !error)) {
    return (
      <div className="w-full min-w-0 space-y-3">
        <StudentPageHero {...RECORDS_HERO} loading />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className={`${CARD} flex items-center gap-4 p-4 lg:p-5`}>
              <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32 max-w-full" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>

        <div className={`${CARD} p-4 lg:p-6`}>
          <Skeleton className="mb-5 h-6 w-32" />
          <div className="mb-4 flex flex-wrap gap-2">
            <Skeleton className="h-11 w-52 rounded-xl" />
            <Skeleton className="h-11 w-48 rounded-xl" />
            <Skeleton className="ml-auto h-11 w-72 max-w-full rounded-xl" />
          </div>
          <div className="space-y-px overflow-hidden rounded-xl border border-[var(--sp-border)]">
            <Skeleton className="h-11 w-full rounded-none" />
            {[0, 1, 2, 3, 4].map((key) => (
              <div key={key} className="flex items-center gap-6 px-4 py-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="hidden h-4 flex-1 lg:block" />
                <Skeleton className="hidden h-8 w-32 lg:block" />
                <Skeleton className="h-9 w-28 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full min-w-0 space-y-3"
    >
      <StudentPageHero {...RECORDS_HERO} />

      <StudentToast message={notice} type="error" onClose={() => setNotice('')} />

      {/* Summary stats */}
      <section aria-label="Record summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Stethoscope}
          label="Total Consultations"
          value={consultationCount}
          hint={records.length ? `Since ${clinicYear(records[records.length - 1].date)}` : 'No visits yet'}
        />
        <StatCard
          icon={CalendarClock}
          label="Follow-ups Advised"
          value={followUpCount}
          hint="Recommended return visits"
        />
        <StatCard
          icon={FileText}
          label="Issued Medical Certificates"
          value={certificates.length}
          hint="Official documents"
        />
        <StatCard
          icon={CalendarDays}
          label="Last Visit"
          value={lastVisit ? formatDate(lastVisit.date) : '—'}
          hint={lastVisit ? lastVisit.complaint : 'No visits yet'}
        />
      </section>

      {/* Search and filter */}
      <section aria-labelledby="records-search-title" className={`${CARD} p-4 lg:p-6`}>
        <h2 id="records-search-title" className="text-lg font-bold text-gray-900 dark:text-white">
          Search and Filter
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Find a record by keyword, or narrow the list by type, year and order.
        </p>

        <div className="mt-4 grid gap-3 rounded-xl border border-[var(--sp-border)] bg-gray-50 p-3 dark:bg-gray-900/30 sm:grid-cols-2 sm:p-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <span className={FIELD_LABEL}>Search</span>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={tab === 'certificates' ? 'Search certificates...' : 'Search consultations...'}
              label="Search records"
              className="[&_input]:bg-[var(--sp-surface)]"
            />
          </div>
          {[
            ['type', 'Record Type', [['all', 'All types'], ['consultation', 'Consultations'], ['emergency', 'Emergencies']]],
            ['year', 'Year', [['all', 'All years'], ...years.map((year) => [year, year])]],
            ['sort', 'Sort By', [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['title', 'Title A–Z']]],
          ].map(([key, label, options]) => (
            <label key={key} className="block min-w-0">
              <span className={FIELD_LABEL}>{label}</span>
              <span className="relative block">
                <select
                  value={filters[key]}
                  onChange={(e) => setFilters((current) => ({ ...current, [key]: e.target.value }))}
                  className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface)] pl-3 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-maroon-500 dark:text-white"
                >
                  {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-maroon-700 dark:text-maroon-300" />
              </span>
            </label>
          ))}
        </div>

        {Object.keys(DEFAULT_FILTERS).some((key) => filters[key] !== DEFAULT_FILTERS[key]) && (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="mt-2 text-xs font-semibold text-maroon-800 hover:underline dark:text-maroon-300"
          >
            Reset filters
          </button>
        )}
      </section>

      {/* My Records */}
      <div className={`${CARD} p-4 lg:p-6`}>
        <div className="mb-5 flex items-start gap-2.5">
          <ClipboardList className="mt-0.5 h-6 w-6 shrink-0 text-maroon-800 dark:text-maroon-300" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">My Records</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Browse your past clinic visits and issued medical certificates, then view or print any record.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <div role="tablist" aria-label="Record type" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              const count = id === 'certificates' ? certificates.length : records.length;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition sm:inline-flex sm:w-auto ${
                    active
                      ? 'border-maroon-800 bg-maroon-800 text-white'
                      : 'border-[var(--sp-border)] text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900/30'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex flex-col items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400 sm:flex-row">
            <span>{error}</span>
            <button onClick={() => fetchRecords()} className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 font-semibold hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/30">Retry</button>
          </div>
        )}

        {visibleRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-14 text-center dark:border-gray-700">
            <ClipboardList className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h3 className="font-semibold text-gray-500 dark:text-gray-400">
              {isFiltering ? 'No matching records' : tab === 'certificates' ? 'No medical certificates yet' : 'No health records yet'}
            </h3>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              {isFiltering
                ? 'Try adjusting your search or filters.'
                : tab === 'certificates'
                  ? 'Certificates issued by the clinic will appear here.'
                  : 'Completed clinic encounters will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            {/* Scrolls sideways instead of wrapping when the screen is narrow. */}
            <div className="hidden overflow-x-auto rounded-xl border border-[var(--sp-border)] lg:block">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="whitespace-nowrap bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th className="rounded-tl-xl px-4 py-3 font-medium">{tab === 'certificates' ? 'Visit Date' : 'Date & Time'}</th>
                    <th className="px-4 py-3 font-medium">{tab === 'certificates' ? 'Reason for Visit' : 'Chief Complaint'}</th>
                    <th className="px-4 py-3 font-medium">{tab === 'certificates' ? 'Reference' : 'Diagnosis / Findings'}</th>
                    <th className="px-4 py-3 font-medium">{tab === 'certificates' ? 'Issued By' : 'Attending Staff'}</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="rounded-tr-xl px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--sp-border)]">
                  {pagedRecords.map((record) => (
                    <tr key={record.id} className="align-middle transition hover:bg-gray-50/60 dark:hover:bg-gray-900/20">
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <p className="font-semibold text-gray-900 dark:text-white">{formatDate(record.date)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDayTime(record.date)}</p>
                      </td>
                      <td className="min-w-[10rem] px-4 py-3.5 text-gray-800 dark:text-gray-200">
                        <span className="line-clamp-2">{record.complaint}</span>
                        <TypeTag record={record} />
                      </td>
                      <td className="max-w-[16rem] px-4 py-3.5 text-gray-800 dark:text-gray-200">
                        {tab === 'certificates'
                          ? <span className="font-mono text-xs">{record.medicalCertificateRef || '—'}</span>
                          : <span className="line-clamp-2">{record.diagnosis || <span className="text-gray-400">Not recorded</span>}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <p className="text-gray-900 dark:text-white">{record.staff}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{record.staffRole}</p>
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={record.status} /></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {tab === 'certificates' ? (
                            <button
                              type="button"
                              onClick={() => handleDocument('certificate', record, 'preview')}
                              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-maroon-800 transition hover:bg-gray-50 dark:border-gray-600 dark:text-maroon-300 dark:hover:bg-gray-900/30"
                            >
                              <Eye className="h-4 w-4" /> Preview
                            </button>
                          ) : (
                            <ViewButton onClick={() => setSelectedRecord(record)} />
                          )}
                          <PrintButton record={record} kind={tab === 'certificates' ? 'certificate' : 'consultation'} onDocument={handleDocument} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet cards */}
            <div className="space-y-3 lg:hidden">
              {pagedRecords.map((record) => (
                <div key={record.id} className="rounded-xl border border-[var(--sp-border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {record.complaint}
                        <TypeTag record={record} />
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(record.date)} · {formatDayTime(record.date)}
                      </p>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                    {tab === 'certificates'
                      ? `Ref ${record.medicalCertificateRef || '—'}`
                      : record.diagnosis || 'No findings recorded'}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{record.staff}</p>
                    <div className="flex items-center gap-1">
                      <ViewButton onClick={() => setSelectedRecord(record)} />
                      <PrintButton record={record} kind={tab === 'certificates' ? 'certificate' : 'consultation'} onDocument={handleDocument} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {visibleRecords.length > 0 && (
          <nav aria-label="Records pages" className="mt-5 flex items-center justify-center gap-2 border-t border-[var(--sp-border)] pt-4">
            <button
              type="button"
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--sp-border)] text-gray-700 transition hover:bg-maroon-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-maroon-900/20"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span aria-current="page" className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-maroon-800 px-3 text-sm font-semibold text-white">
              {currentPage}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--sp-border)] text-gray-700 transition hover:bg-maroon-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-maroon-900/20"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        )}
      </div>

      <AnimatePresence>
        {selectedRecord && (
          <RecordDialog
            record={selectedRecord}
            onClose={() => setSelectedRecord(null)}
            onDocument={handleDocument}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default HealthRecords;
