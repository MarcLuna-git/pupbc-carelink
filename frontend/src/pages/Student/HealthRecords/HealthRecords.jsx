import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
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
  RotateCcw,
} from 'lucide-react';
import api from '../../../services/api';
import StudentPageHero from '../../../components/StudentPageHero';
import { SearchField } from '../../../components/StudentSearchFilter';
import { useStudentBreadcrumbTab } from '../../../utils/studentBreadcrumb';
import { buildRecordDocument, openRecordDocument } from './recordDocuments';
import DocumentViewerModal from '../../../components/DocumentViewerModal';
import { StudentToast } from '../../../components/StudentFeedback';

/*
 * ROUTE LOADING — same restored effect as the Settings / Profile pages,
 * scoped to this page. TEMP DEMO TIMER: holds the loading phase so the
 * animation is visible even when the API answers quickly on localhost.
 */
const ROUTE_LOADING_DELAY = 1600;

const CARD = 'rounded-[10px] border border-[var(--sp-border)] bg-[var(--sp-surface)]';
const FIELD_LABEL = 'mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300';

const RECORDS_HERO = {
  id: 'records-title',
  title: 'Health Records',
  description: 'View your consultation records, health documents, and clinic history.',
};

/* The kinds of record, listed in the Record Type dropdown. */
const TABS = [
  { id: 'consultations', label: 'Consultation Records' },
  { id: 'certificates', label: 'Medical Certificates' },
  { id: 'sick', label: 'Medical Cert (Sick)' },
  { id: 'ojt', label: 'Medical Cert (OJT)' },
  { id: 'liability', label: 'Medical Liability' },
];

/* The document kinds: which form a row prints, and what its detail column shows. */
const DOC_TABS = {
  certificates: {
    kind: 'certificate',
    detailLabel: 'Reference',
    detail: (r) => r.medicalCertificateRef,
    mono: true,
    mobile: (r) => `Ref ${r.medicalCertificateRef || '—'}`,
    search: 'Search certificates...',
    emptyTitle: 'No medical certificates yet',
    emptyText: 'Certificates issued by the clinic will appear here.',
  },
  sick: {
    kind: 'sick',
    detailLabel: 'Days of Attendance',
    detail: (r) => (r.sickRestDays ? `${r.sickRestDays} day/s` : ''),
    mono: false,
    mobile: (r) => `Ref ${r.sickCertificateRef || '—'}${r.sickRestDays ? ` · ${r.sickRestDays} day/s` : ''}`,
    search: 'Search sick certificates...',
    emptyTitle: 'No sick medical certificates yet',
    emptyText: 'Medical certificates for an illness that the clinic issues will appear here.',
  },
  ojt: {
    kind: 'ojt',
    detailLabel: 'OJT Company',
    detail: (r) => r.ojtCompany,
    mono: false,
    mobile: (r) => `OJT at ${r.ojtCompany || '—'}`,
    search: 'Search OJT certificates...',
    emptyTitle: 'No OJT medical certificates yet',
    emptyText: 'Medical certificates for On the Job Training that the clinic issues will appear here.',
  },
  liability: {
    kind: 'liability',
    detailLabel: 'Activity',
    detail: (r) => r.liabilityActivity,
    mono: false,
    mobile: (r) => `Activity: ${r.liabilityActivity || '—'}`,
    search: 'Search liability forms...',
    emptyTitle: 'No medical liability forms yet',
    emptyText: 'Liability forms the clinic issues for school activities will appear here.',
  },
};

const DEFAULT_FILTERS = { year: 'all' };
const DEFAULT_TAB = 'consultations';

const PAGE_SIZE = 7;

/* Table column sorts. Each header click cycles descending → ascending → back
   to the default order (newest first). */
const text = (value) => String(value || '').toLowerCase();
const COLUMN_SORTS = {
  date: (r) => new Date(r.date).getTime() || 0,
  complaint: (r) => text(r.complaint),
  detail: (r, tab) => text(DOC_TABS[tab] ? DOC_TABS[tab].detail(r) : r.diagnosis),
  staff: (r) => text(r.staff),
  status: (r) => text(r.status),
};

/* Stacked ▲/▼: both hollow until the column is sorted, then the active
   direction fills maroon. */
const SortCaret = ({ direction }) => (
  <svg viewBox="0 0 10 14" aria-hidden="true" className="h-[13px] w-[9px] text-gray-400">
    {[['asc', 'M1.5 5.5h7L5 1.5z'], ['desc', 'M1.5 8.5h7L5 12.5z']].map(([dir, d]) => (
      <path key={dir} d={d} strokeWidth="1.1" strokeLinejoin="round"
        className={direction === dir ? 'fill-maroon-700 stroke-maroon-700 dark:fill-maroon-300 dark:stroke-maroon-300' : 'fill-none stroke-current'} />
    ))}
  </svg>
);

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
    sickCertificate: Boolean(c.sick_certificate),
    sickCertificateRef: c.sick_certificate_ref || '',
    sickRestDays: c.sick_rest_days || '',
    ojtCertificate: Boolean(c.ojt_certificate),
    ojtCertificateRef: c.ojt_certificate_ref || '',
    ojtCompany: c.ojt_company || '',
    liabilityForm: Boolean(c.liability_form),
    liabilityActivity: c.liability_activity || '',
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
  <div className={`animate-pulse rounded-[10px] bg-gray-200 dark:bg-gray-700 ${className}`} />
);

const StatCard = ({ icon: Icon, label, value, hint }) => (
  <div className={`${CARD} flex items-center gap-4 p-4 lg:p-5`}>
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300">
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
  <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-green-50 px-2.5 py-1 text-xs font-semibold capitalize text-green-700 dark:bg-green-900/20 dark:text-green-400">
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

/* Viewer heading per document kind (the row's View button opens that document in the viewer). */
const VIEWER_TITLES = {
  certificate: ['Medical Certificate', 'View and print the medical certificate'],
  sick: ['Medical Certificate (Sick)', 'View and print the sick medical certificate'],
  ojt: ['Medical Certificate (OJT)', 'View and print the OJT medical certificate'],
  liability: ['Medical Liability Form', 'View and print the medical liability form'],
};

const ViewButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 whitespace-nowrap rounded-[10px] border border-gray-200 px-3 py-2 text-sm font-semibold text-maroon-800 transition hover:bg-maroon-900 hover:text-white dark:border-gray-600 dark:text-maroon-300 dark:hover:bg-maroon-900 dark:hover:text-white"
  >
    <Eye className="h-4 w-4" /> View
  </button>
);

/* What the record holds besides the Consultation Form (follow-up, issued documents), shown in
   the viewer's side panel with the buttons that print those documents. */
const RecordExtras = ({ record, onDocument }) => {
  const field = (label, value) => (
    <div className="rounded-[10px] bg-gray-50 p-3.5 dark:bg-gray-700/30">
      <p className="mb-1 text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      <p className="whitespace-pre-wrap break-words text-sm font-medium text-gray-800 dark:text-gray-200">{value || 'Not recorded'}</p>
    </div>
  );
  const printButton = (kind, label) => (
    <button
      key={kind}
      type="button"
      onClick={() => onDocument(kind, record, 'print')}
      className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-maroon-800 px-4 py-2 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 dark:border-maroon-700 dark:text-maroon-300 dark:hover:bg-maroon-900/20"
    >
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
  const documents = [
    record.medicalCertificate && printButton('certificate', 'Print certificate'),
    record.sickCertificate && printButton('sick', 'Print sick certificate'),
    record.ojtCertificate && printButton('ojt', 'Print OJT certificate'),
    record.liabilityForm && printButton('liability', 'Print liability form'),
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {formatLongDate(record.date)} · {formatDayTime(record.date)} · {record.staff}
      </p>
      {field('Follow-up', record.followUpRequired
        ? `Required${record.followUpDate ? ` — ${formatLongDate(record.followUpDate)}` : ''}`
        : 'Not required')}
      {record.recordType === 'emergency' && field(record.notesLabel, record.notesValue)}
      {record.symptoms && field('Symptoms', record.symptoms)}
      {record.disposition && field('Disposition', record.disposition)}
      {record.appointment?.service && field('Appointment Service', record.appointment.service)}
      {record.medicalCertificate && field('Medical Certificate', record.medicalCertificateRef || 'Issued')}
      {record.sickCertificate && field('Medical Certificate (Sick)', [record.sickCertificateRef, record.sickRestDays && `${record.sickRestDays} day/s`].filter(Boolean).join(' · ') || 'Issued')}
      {record.ojtCertificate && field('Medical Certificate (OJT)', [record.ojtCertificateRef, record.ojtCompany].filter(Boolean).join(' · ') || 'Issued')}
      {record.liabilityForm && field('Medical Liability Form', record.liabilityActivity || 'Issued')}
      {documents.length > 0 && <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">{documents}</div>}
    </div>
  );
};

const HealthRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  // Which kind of record the list shows; chosen in the Record Type dropdown.
  const [tab, setTab] = useState(DEFAULT_TAB);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  useStudentBreadcrumbTab(TABS.find(({ id }) => id === tab)?.label);
  // The record open in the viewer and which of its documents is shown.
  const [viewing, setViewing] = useState(null);
  const [page, setPage] = useState(1);
  const [columnSort, setColumnSort] = useState(null);
  const cycleSort = (key) => setColumnSort((current) => current?.key !== key ? { key, dir: 'desc' } : current.dir === 'desc' ? { key, dir: 'asc' } : null);
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
  const sickCertificates = useMemo(() => records.filter((r) => r.sickCertificate), [records]);
  const ojtCertificates = useMemo(() => records.filter((r) => r.ojtCertificate), [records]);
  const liabilityForms = useMemo(() => records.filter((r) => r.liabilityForm), [records]);
  const docTab = DOC_TABS[tab];

  const visibleRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = tab === 'certificates' ? certificates : tab === 'sick' ? sickCertificates : tab === 'ojt' ? ojtCertificates : tab === 'liability' ? liabilityForms : records;
    const matches = source.filter((r) => {
      const matchesSearch = !term || [r.title, r.complaint, r.diagnosis, r.notesValue, r.staff, r.medicalCertificateRef, r.ojtCompany, r.ojtCertificateRef, r.sickCertificateRef, r.liabilityActivity]
        .some((value) => value.toLowerCase().includes(term));
      const matchesYear = filters.year === 'all' || clinicYear(r.date) === filters.year;
      return matchesSearch && matchesYear;
    });
    if (columnSort) {
      const value = COLUMN_SORTS[columnSort.key];
      const sign = columnSort.dir === 'asc' ? 1 : -1;
      return matches.sort((a, b) => {
        const x = value(a, tab);
        const y = value(b, tab);
        return sign * (typeof x === 'number' ? x - y : x.localeCompare(y));
      });
    }
    return matches.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [records, certificates, sickCertificates, ojtCertificates, liabilityForms, tab, search, filters, columnSort]);

  /* A new tab, search, filter or sort starts again from the first page. */
  useEffect(() => setPage(1), [tab, search, filters, columnSort]);
  /* Column meanings differ between the tabs, so a header sort ends with its tab. */
  useEffect(() => setColumnSort(null), [tab]);

  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRecords = visibleRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeFilterCount = Object.keys(DEFAULT_FILTERS).filter((key) => filters[key] !== DEFAULT_FILTERS[key]).length;
  const isFiltering = Boolean(search.trim()) || activeFilterCount > 0;
  const canReset = isFiltering || Boolean(columnSort) || tab !== DEFAULT_TAB;
  const resetFilters = () => { setSearch(''); setFilters(DEFAULT_FILTERS); setColumnSort(null); setTab(DEFAULT_TAB); };

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
              <Skeleton className="h-14 w-14 shrink-0 rounded-[10px]" />
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
          <Skeleton className="mb-5 h-[4.5rem] w-full rounded-[10px]" />
          <div className="space-y-px overflow-hidden rounded-[10px] border border-[var(--sp-border)]">
            <Skeleton className="h-11 w-full rounded-none" />
            {[0, 1, 2, 3, 4].map((key) => (
              <div key={key} className="flex items-center gap-6 px-4 py-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="hidden h-4 flex-1 lg:block" />
                <Skeleton className="hidden h-8 w-32 lg:block" />
                <Skeleton className="h-9 w-28 rounded-[10px]" />
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

      {/* My Records: search, filters and the list in one card */}
      <section aria-labelledby="records-title" className={`${CARD} p-4 lg:p-6`}>
        <div className="mb-4 flex items-start gap-2.5">
          <ClipboardList className="mt-0.5 h-6 w-6 shrink-0 text-maroon-800 dark:text-maroon-300" />
          <div className="min-w-0">
            <h2 id="records-title" className="text-lg font-bold text-gray-900 dark:text-white">My Records</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Search by keyword or choose a record type and year, then view or print any record.
            </p>
          </div>
        </div>

        <div className="mb-5 grid gap-3 rounded-[10px] border border-[var(--sp-border)] bg-gray-50 p-3 dark:bg-gray-900/30 sm:grid-cols-2 sm:p-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <span className={FIELD_LABEL}>Search</span>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={docTab ? docTab.search : 'Search consultations...'}
              label="Search records"
              className="[&_input]:bg-[var(--sp-surface)]"
            />
          </div>
          {[
            ['type', 'Record Type', TABS.map(({ id, label }) => [id, label]), tab, setTab],
            ['year', 'Year', [['all', 'All years'], ...years.map((year) => [year, year])], filters.year, (year) => setFilters((current) => ({ ...current, year }))],
          ].map(([key, label, options, value, onChange]) => (
            <label key={key} className="block min-w-0">
              <span className={FIELD_LABEL}>{label}</span>
              <span className="relative block">
                <select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-10 w-full cursor-pointer appearance-none rounded-[10px] border border-[var(--sp-border)] bg-[var(--sp-surface)] pl-3 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-maroon-500 dark:text-white"
                >
                  {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-maroon-700 dark:text-maroon-300" />
              </span>
            </label>
          ))}
          <div className="min-w-0">
            <span aria-hidden="true" className={FIELD_LABEL}>&nbsp;</span>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!canReset}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--sp-border)] bg-white text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:hover:bg-gray-800"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4 text-maroon-700 dark:text-maroon-300" />
              Reset filters
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex flex-col items-center justify-between gap-3 rounded-[10px] border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400 sm:flex-row">
            <span>{error}</span>
            <button onClick={() => fetchRecords()} className="inline-flex items-center gap-2 rounded-[10px] border border-red-300 px-3 py-2 font-semibold hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/30">Retry</button>
          </div>
        )}

        {visibleRecords.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-gray-200 py-14 text-center dark:border-gray-700">
            <ClipboardList className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h3 className="font-semibold text-gray-500 dark:text-gray-400">
              {isFiltering ? 'No matching records' : docTab ? docTab.emptyTitle : 'No health records yet'}
            </h3>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              {isFiltering
                ? 'Try adjusting your search or filters.'
                : docTab
                  ? docTab.emptyText
                  : 'Completed clinic encounters will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            {/* Scrolls sideways instead of wrapping when the screen is narrow. */}
            <div className="hidden overflow-x-auto rounded-[10px] border border-[var(--sp-border)] lg:block">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="whitespace-nowrap bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    {[
                      ['date', docTab ? 'Visit Date' : 'Date & Time'],
                      ['complaint', docTab ? 'Reason for Visit' : 'Chief Complaint'],
                      ['detail', docTab ? docTab.detailLabel : 'Diagnosis / Findings'],
                      ['staff', docTab ? 'Issued By' : 'Attending Staff'],
                      ['status', 'Status'],
                    ].map(([key, label], index) => {
                      const active = columnSort?.key === key ? columnSort.dir : null;
                      return (
                        <th key={key} aria-sort={active === 'desc' ? 'descending' : active === 'asc' ? 'ascending' : 'none'}
                          className={`px-4 py-3 font-medium${index === 0 ? ' rounded-tl-[10px]' : ''}`}>
                          <button type="button" onClick={() => cycleSort(key)}
                            className={`inline-flex items-center gap-1 transition hover:text-gray-900 dark:hover:text-white${active ? ' text-gray-900 dark:text-white' : ''}`}>
                            {label}<SortCaret direction={active} />
                          </button>
                        </th>
                      );
                    })}
                    <th className="rounded-tr-[10px] px-4 py-3 font-medium">Actions</th>
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
                        {docTab
                          ? <span className={docTab.mono ? 'font-mono text-xs' : 'line-clamp-2'}>{docTab.detail(record) || '—'}</span>
                          : <span className="line-clamp-2">{record.diagnosis || <span className="text-gray-400">Not recorded</span>}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <p className="text-gray-900 dark:text-white">{record.staff}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{record.staffRole}</p>
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={record.status} /></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <ViewButton onClick={() => setViewing({ record, kind: docTab ? docTab.kind : 'consultation' })} />
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
                <div key={record.id} className="rounded-[10px] border border-[var(--sp-border)] p-4">
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
                    {docTab
                      ? docTab.mobile(record)
                      : record.diagnosis || 'No findings recorded'}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{record.staff}</p>
                    <ViewButton onClick={() => setViewing({ record, kind: docTab ? docTab.kind : 'consultation' })} />
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--sp-border)] text-gray-700 transition hover:bg-maroon-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-maroon-900/20"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span aria-current="page" className="inline-flex h-9 min-w-9 items-center justify-center rounded-[10px] bg-maroon-800 px-3 text-sm font-semibold text-white">
              {currentPage}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--sp-border)] text-gray-700 transition hover:bg-maroon-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-maroon-900/20"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {/* Running count: records seen so far out of the total (7 of 16, then 14 of 16). */}
            <span className="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400" aria-live="polite">
              {Math.min(currentPage * PAGE_SIZE, visibleRecords.length)} of {visibleRecords.length}
            </span>
          </nav>
        )}
      </section>

      {/* View: the chosen document of the record in the document viewer (preview, print, PDF). */}
      {viewing && (() => {
        const { record, kind } = viewing;
        const emergency = record.recordType === 'emergency';
        const [title, subtitle] = VIEWER_TITLES[kind] || [
          emergency ? 'Emergency Encounter Record' : 'Consultation Record',
          `View and print ${emergency ? 'emergency encounter' : 'consultation'} details`,
        ];
        return (
          <DocumentViewerModal
            title={title}
            subtitle={subtitle}
            docKey={`${kind}-${record.id}`}
            load={() => buildRecordDocument(kind, record)}
            onClose={() => setViewing(null)}
            details={<RecordExtras record={record} onDocument={handleDocument} />}
          />
        );
      })()}
    </motion.div>
  );
};

export default HealthRecords;
