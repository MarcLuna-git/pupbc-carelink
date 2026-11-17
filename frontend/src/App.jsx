import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  Navigate,
  useLocation,
} from 'react-router-dom';

import { lazy, Suspense } from 'react';

const Landing = lazy(() => import('./pages/Landing/Landing'));

const Login = lazy(() => import('./pages/Student/Login'));
const Register = lazy(() => import('./pages/Student/Register'));
const ForgotPassword = lazy(() => import('./pages/Student/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/Student/ResetPassword'));

const Welcome = lazy(() => import('./pages/Student/Welcome/Welcome'));
const Appointments = lazy(() => import('./pages/Student/Appointments/Appointments'));
const QR = lazy(() => import('./pages/Student/QR/QR'));
const Overview = lazy(() => import('./pages/Student/Overview/Overview'));
const Announcements = lazy(() => import('./pages/Student/Announcements/Announcements'));
const HealthRecords = lazy(() => import('./pages/Student/HealthRecords/HealthRecords'));
const Settings = lazy(() => import('./pages/Student/Settings/Settings'));
const Help = lazy(() => import('./pages/Student/Help/Help'));
const About = lazy(() => import('./pages/Student/About/About'));

const StudentLayoutForDesktopView = lazy(() => import('./layouts/StudentLayout/StudentLayout-for-Desktop-View'));

const NurseLogin = lazy(() => import('./pages/Admin/Login/NurseLogin'));
const NurseDashboard = lazy(() => import('./pages/Admin/Dashboard/NurseDashboard'));
const NurseAppointments = lazy(() => import('./pages/Admin/Appointments/NurseAppointments'));
const NurseStudents = lazy(() => import('./pages/Admin/Students/NurseStudents'));
const NurseConsultation = lazy(() => import('./pages/Admin/Consultation/NurseConsultation'));
const NurseQueue = lazy(() => import('./pages/Admin/Consultation/NurseQueue'));
const NurseMedicine = lazy(() => import('./pages/Admin/Medicine/NurseMedicine'));
const NurseFaculty = lazy(() => import('./pages/Admin/Faculty/NurseFaculty'));
const NurseAnnouncements = lazy(() => import('./pages/Admin/Announcements/NurseAnnouncements'));
const NurseSettings = lazy(() => import('./pages/Admin/Settings/NurseSettings'));
const CourseManagement = lazy(() => import('./pages/Admin/Academic/CourseManagement'));

const NurseLayoutForDesktopView = lazy(() => import('./layouts/NurseLayout/NurseLayout-for-Desktop-View'));
import ProtectedRoute from './components/ProtectedRoute';
import HealthProfileVerifyError from './components/HealthProfileVerifyError';
import { useStudentHealthProfileStatus } from './hooks/useStudentHealthProfileStatus';

const KioskPage = lazy(() => import('./pages/Kiosk/KioskPage'));
const KioskSettings = lazy(() => import('./pages/Kiosk/KioskSettings'));
const KioskDev = lazy(() => import('./pages/Kiosk/KioskDev'));
import AppErrorBoundary from './components/AppErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import RouteLoadingBar, { StudentRouteSuspenseFallback } from './components/RouteLoadingBar';


/*
 * ============================================================
 * LOADING STATE
 * ============================================================
 *
 * Owner decision (updated): each page owns its route-loading
 * phase — a real hero with 1:1 content ghosts — while its first
 * data loads. The looping bar itself is the SINGLE top-edge bar
 * (components/RouteLoadingBar), shown for student pages only:
 * heroes push/pop it, and the Suspense fallback covers lazy
 * student routes (login, register, forgot password, OTP too).
 * The clinic-service pages (Appointments, QR) cover the backend
 * Health Profile verification inside that same phase (no separate
 * guard phase). Nurse and kiosk routes stay bar-free.
 * Lazy routes pop in when their chunk finishes loading
 * (chunks are preloaded on hover).
 */

/*
 * ============================================================
 * SAFE STATUS ERROR
 * ============================================================
 *
 * Moved to src/components/HealthProfileVerifyError.jsx — shared by
 * the /student redirect and the clinic-service pages.
 */

/*
 * ============================================================
 * /student
 * ============================================================
 *
 * First-time / incomplete:
 *   → /student/health-profile
 *
 * Completed in the ACTUAL database:
 *   → /student/appointments
 *
 * Works even when the student logs in using another device,
 * because the backend is checked after authentication.
 */
const StudentHomeRedirect = () => {
  const {
    loading,
    completed,
    error,
    retry,
  } = useStudentHealthProfileStatus();

  if (loading) {
    return null;
  }

  if (error) {
    return <HealthProfileVerifyError retry={retry} />;
  }

  return (
    <Navigate
      to={
        completed
          ? '/student/appointments'
          : '/student/health-profile'
      }
      replace
    />
  );
};

/*
 * ============================================================
 * HEALTH PROFILE FORM
 * ============================================================
 *
 * Both incomplete and completed students can open the form.
 * It is shown inside the Profile page (/student/profile?view=
 * health-profile); /student/health-profile stays as an alias.
 * Completion is required only for clinic services, never for
 * editing this form.
 */
const HealthProfileOnboardingRoute = () => {
  // The form lives inside the Profile page now; keep ?step=N working.
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('view', 'health-profile');
  return <Navigate to={`/student/profile?${params}`} replace />;
};

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        {/* One loading bar for the whole app, pinned to the top edge. */}
        <RouteLoadingBar />
        <ScrollToTop />
        <Suspense fallback={<StudentRouteSuspenseFallback />}>
        <Routes>
          {/* ==================================================
              PUBLIC
          ================================================== */}

          <Route
            path="/"
            element={<Landing />}
          />

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/register"
            element={<Register />}
          />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          <Route
            path="/reset-password"
            element={<ResetPassword />}
          />

          {/* ==================================================
              KIOSK
          ================================================== */}

          <Route
            path="/kiosk"
            element={<KioskPage />}
          />

          {/* Hidden: no link on the kiosk; staff type the URL. */}
          <Route
            path="/kiosk/settings"
            element={<KioskSettings />}
          />
          <Route
            path="/kiosk/dev"
            element={<KioskDev />}
          />

          {/* ==================================================
              HIDDEN NURSE LOGIN
          ================================================== */}

          <Route
            path="/carelink-portal"
            element={<NurseLogin />}
          />

          {/* ==================================================
              STUDENT
          ================================================== */}

          <Route
            path="/student"
            element={
              <ProtectedRoute role="student">
                <StudentLayoutForDesktopView>
                  <Outlet />
                </StudentLayoutForDesktopView>
              </ProtectedRoute>
            }
          >
            {/*
              Main Student landing route.

              DB determines whether this Student needs onboarding.
            */}
            <Route
              index
              element={<StudentHomeRedirect />}
            />

            {/*
              Existing route retained for compatibility.
            */}
            <Route
              path="welcome"
              element={<Welcome />}
            />

            {/*
              Health Profile completion and editing for all students.
            */}
            <Route
              path="health-profile"
              element={<HealthProfileOnboardingRoute />}
            />

            {/*
              Dashboard no longer exists in active Student UX.

              Old bookmarks safely resolve to the normal Student
              landing decision.
            */}
            <Route
              path="dashboard"
              element={<StudentHomeRedirect />}
            />

            {/*
              Clinic services gated on a completed Health Profile.

              The backend-verified check lives INSIDE each page
              (useStudentHealthProfileStatus) so the page's own
              loading skeleton covers the verification — one
              loading phase, no separate guard phase. Incomplete
              students are redirected to /student/health-profile.
            */}
            <Route
              path="appointments"
              element={<Appointments />}
            />

            <Route
              path="qr"
              element={<QR />}
            />

            {/* ==================================================
                STUDENT ACCOUNT
            ================================================== */}

            <Route
              path="profile"
              element={<Overview />}
            />

            {/* Editing is inline on the Profile page now; keep old links working. */}
            <Route
              path="profile/edit"
              element={<Navigate to="/student/profile" replace />}
            />

            {/* ==================================================
                ALERTS
            ================================================== */}

            {/*
              Notifications and announcements now open from the header
              bell's drop-down; old links land on the normal Student page.
            */}
            <Route
              path="alerts"
              element={<StudentHomeRedirect />}
            />

            {/*
              Legacy route retained so existing links/bookmarks
              do not break.

              We can later redirect this to Alerts after reviewing
              the current Announcements implementation.
            */}
            <Route
              path="announcements"
              element={<Announcements />}
            />

            {/* ==================================================
                HEALTH RECORDS
            ================================================== */}

            <Route
              path="health-records"
              element={<HealthRecords />}
            />

            {/* ==================================================
                ACCOUNT CENTER
            ================================================== */}

            {/*
              Account Center routes.

              Settings is also surfaced as a primary navigation tab (see
              STUDENT_PRIMARY_LINKS). Help and About remain reachable from
              the upper-right Account menu.
            */}
            <Route
              path="settings"
              element={<Settings />}
            />

            {/* Short link to the hidden Developer Tools tab (no menu link). */}
            <Route
              path="developer"
              element={<Navigate to="/student/settings?tab=developer" replace />}
            />

            <Route
              path="help"
              element={<Help />}
            />

            <Route
              path="about"
              element={<About />}
            />
          </Route>

          {/* ==================================================
              NURSE
              UNCHANGED
          ================================================== */}

          <Route
            path="/nurse"
            element={
              <ProtectedRoute role="nurse">
                <NurseLayoutForDesktopView>
                  <Outlet />
                </NurseLayoutForDesktopView>
              </ProtectedRoute>
            }
          >
            <Route
              path="dashboard"
              element={<NurseDashboard />}
            />

            <Route
              path="appointments"
              element={<NurseAppointments />}
            />

            <Route
              path="students"
              element={<NurseStudents />}
            />

            <Route
              path="academic"
              element={<CourseManagement />}
            />

            <Route
              path="queue"
              element={<NurseQueue />}
            />

            <Route
              path="consultation"
              element={<NurseConsultation />}
            />

            <Route
              path="medicines"
              element={<NurseMedicine />}
            />

            <Route
              path="faculty"
              element={<NurseFaculty />}
            />

            <Route
              path="records"
              element={<Navigate to="/nurse/consultation" replace />}
            />

            {/* Notifications moved to the header bell's drop-down; old links land on the dashboard. */}
            <Route
              path="notifications"
              element={<Navigate to="/nurse/dashboard" replace />}
            />

            <Route
              path="announcements"
              element={<NurseAnnouncements />}
            />

            <Route
              path="settings"
              element={<NurseSettings />}
            />

            {/* Short link to the hidden Developer Tools tab (no menu link). */}
            <Route
              path="developer"
              element={<Navigate to="/nurse/settings?tab=developer" replace />}
            />
          </Route>

          {/* ==================================================
              404
          ================================================== */}

          <Route
            path="*"
            element={
              <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-gray-300 dark:text-gray-700">
                    404
                  </h1>

                  <p className="mt-4 text-gray-600 dark:text-gray-300">
                    Page not found
                  </p>

                  <a
                    href="/"
                    className="mt-4 inline-block font-medium text-maroon-700 hover:text-maroon-900 dark:text-maroon-300 dark:hover:text-maroon-200"
                  >
                    Go Home
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
