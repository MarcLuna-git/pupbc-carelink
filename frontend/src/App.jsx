import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  Navigate,
} from 'react-router-dom';

import { useCallback, useEffect, useState } from 'react';

import Landing from './pages/Landing/Landing';

import Login from './pages/Student/Login';
import Register from './pages/Student/Register';
import ForgotPassword from './pages/Student/ForgotPassword';
import ResetPassword from './pages/Student/ResetPassword';

import Welcome from './pages/Student/Welcome/Welcome';
import HealthProfile from './pages/Student/HealthProfile/HealthProfile';
import Appointments from './pages/Student/Appointments/Appointments';
import QR from './pages/Student/QR/QR';
import Profile from './pages/Student/Profile/Profile';
import ProfileEdit from './pages/Student/ProfileEdit/ProfileEdit';
import Alerts from './pages/Student/Alerts/Alerts';
import Announcements from './pages/Student/Announcements/Announcements';
import HealthRecords from './pages/Student/HealthRecords/HealthRecords';
import Settings from './pages/Student/Settings/Settings';
import Help from './pages/Student/Help/Help';
import About from './pages/Student/About/About';

import StudentLayout from './layouts/StudentLayout';

import NurseLogin from './pages/Admin/Login/NurseLogin';
import NurseDashboard from './pages/Admin/Dashboard/NurseDashboard';
import NurseAppointments from './pages/Admin/Appointments/NurseAppointments';
import NurseStudents from './pages/Admin/Students/NurseStudents';
import NurseConsultation from './pages/Admin/Consultation/NurseConsultation';
import NurseMedicine from './pages/Admin/Medicine/NurseMedicine';
import NurseRecords from './pages/Admin/Records/NurseRecords';
import NurseNotifications from './pages/Admin/Notifications/NurseNotifications';
import NurseAnnouncements from './pages/Admin/Announcements/NurseAnnouncements';
import NurseSettings from './pages/Admin/Settings/NurseSettings';
import CourseManagement from './pages/Admin/Academic/CourseManagement';

import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';

import KioskPage from './pages/Kiosk/KioskPage';
import AppErrorBoundary from './components/AppErrorBoundary';

import api from './services/api';

/*
 * ============================================================
 * HEALTH PROFILE STATUS
 * ============================================================
 *
 * IMPORTANT:
 * The backend/database is the source of truth.
 *
 * We do NOT rely only on:
 * user.profile.health_profile_completed
 *
 * because localStorage can be stale on:
 * - another device
 * - another browser
 * - an old login session
 *
 * Backend endpoint:
 * GET /api/student/health-profile/status
 *
 * Expected:
 * {
 *   success: true,
 *   data: {
 *     exists: true|false,
 *     completed: true|false
 *   }
 * }
 */

/*
 * Cache only COMPLETED=true results.
 *
 * Why:
 * - completed students avoid a second duplicate request when
 *   /student redirects immediately to /student/appointments.
 *
 * We intentionally DO NOT cache incomplete=false.
 *
 * This prevents this sequence:
 * 1. student is incomplete
 * 2. backend returns false
 * 3. student completes Health Profile
 * 4. old cached false incorrectly blocks Appointments
 *
 * Cache is also tied to the current auth token so another
 * student cannot inherit another user's result.
 */
let completedHealthProfileCache = {
  token: null,
  completed: false,
  fetchedAt: 0,
};

const COMPLETED_STATUS_CACHE_MS = 60 * 1000;

/*
 * Safely read the locally stored authenticated user.
 *
 * Local data is used only for UI synchronization.
 * It is NOT the final authority for Health Profile completion.
 */
const getStoredStudent = () => {
  try {
    const storedUser = localStorage.getItem('user');

    if (!storedUser) {
      return null;
    }

    return JSON.parse(storedUser);
  } catch {
    return null;
  }
};

/*
 * Normalize boolean/integer/string representations.
 */
const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === '1' ||
  value === 'true';

/*
 * Synchronize the backend result into localStorage.
 *
 * This keeps older Student pages that still read:
 *
 * user.profile.health_profile_completed
 *
 * consistent with the actual DB value.
 */
const syncStoredHealthProfileStatus = (completed) => {
  try {
    const currentUser = getStoredStudent();

    if (!currentUser) {
      return;
    }

    const updatedUser = {
      ...currentUser,

      profile: {
        ...(currentUser.profile || {}),
        health_profile_completed: Boolean(completed),
      },
    };

    localStorage.setItem(
      'user',
      JSON.stringify(updatedUser)
    );

    /*
     * Same-tab storage events do not fire automatically,
     * so notify any Student components listening for updates.
     */
    window.dispatchEvent(
      new CustomEvent('carelink:student-user-updated', {
        detail: {
          user: updatedUser,
        },
      })
    );
  } catch {
    /*
     * Failure to synchronize localStorage must never block
     * the actual backend-derived routing decision.
     */
  }
};

/*
 * Fetch authoritative completion state.
 */
const fetchHealthProfileStatus = async () => {
  const token = localStorage.getItem('token');

  if (!token) {
    throw new Error('No authenticated Student session.');
  }

  const now = Date.now();

  const hasValidCompletedCache =
    completedHealthProfileCache.token === token &&
    completedHealthProfileCache.completed === true &&
    now - completedHealthProfileCache.fetchedAt <
      COMPLETED_STATUS_CACHE_MS;

  if (hasValidCompletedCache) {
    return {
      exists: true,
      completed: true,
    };
  }

  const response = await api.get(
    '/student/health-profile/status'
  );

  const data = response.data?.data || {};

  const status = {
    exists: toBoolean(data.exists),
    completed: toBoolean(data.completed),
  };

  /*
   * Cache TRUE only.
   */
  if (status.completed) {
    completedHealthProfileCache = {
      token,
      completed: true,
      fetchedAt: now,
    };
  } else {
    /*
     * Never preserve an incomplete result.
     */
    completedHealthProfileCache = {
      token: null,
      completed: false,
      fetchedAt: 0,
    };
  }

  syncStoredHealthProfileStatus(status.completed);

  return status;
};

/*
 * ============================================================
 * STATUS HOOK
 * ============================================================
 */

const useStudentHealthProfileStatus = () => {
  const [state, setState] = useState({
    loading: true,
    completed: false,
    exists: false,
    error: '',
  });

  const checkStatus = useCallback(async () => {
    setState((current) => ({
      ...current,
      loading: true,
      error: '',
    }));

    try {
      const status = await fetchHealthProfileStatus();

      setState({
        loading: false,
        completed: status.completed,
        exists: status.exists,
        error: '',
      });
    } catch (error) {
      /*
       * Do not expose raw Axios / SQL / Laravel messages.
       */
      setState({
        loading: false,
        completed: false,
        exists: false,
        error:
          'We could not verify your Health Profile. Please try again.',
      });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    ...state,
    retry: checkStatus,
  };
};

/*
 * ============================================================
 * LOADING STATE
 * ============================================================
 */

const StudentRouteLoading = ({
  message = 'Preparing your student portal...',
}) => (
  <div className="flex min-h-[55vh] items-center justify-center px-4">
    <div className="w-full max-w-sm text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-maroon-50 dark:bg-maroon-950/30">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-maroon-200 border-t-maroon-700 dark:border-maroon-900 dark:border-t-maroon-300" />
      </div>

      <p className="mt-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
        {message}
      </p>

      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Checking your clinic profile...
      </p>
    </div>
  </div>
);

/*
 * ============================================================
 * SAFE STATUS ERROR
 * ============================================================
 */

const StudentRouteStatusError = ({ retry }) => (
  <div className="flex min-h-[55vh] items-center justify-center px-4">
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl dark:bg-red-950/30">
        !
      </div>

      <h2 className="mt-4 text-base font-bold text-gray-900 dark:text-white">
        Unable to verify your Health Profile
      </h2>

      <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
        Please check your connection and try again. Your saved
        information has not been changed.
      </p>

      <button
        type="button"
        onClick={retry}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-maroon-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-maroon-800 focus:outline-none focus:ring-2 focus:ring-maroon-500/30"
      >
        Try Again
      </button>
    </div>
  </div>
);

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
    return (
      <StudentRouteLoading message="Opening your student portal..." />
    );
  }

  if (error) {
    return <StudentRouteStatusError retry={retry} />;
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
 * HealthProfile loads the saved record itself. Completion is
 * required only for clinic services, never for editing this form.
 */
const HealthProfileOnboardingRoute = () => {
  return <HealthProfile />;
};

/*
 * ============================================================
 * CLINIC SERVICE GUARD
 * ============================================================
 *
 * Appointments / QR require a completed Health Profile.
 *
 * Backend/database remains authoritative.
 *
 * This guard deliberately performs the real status check
 * instead of trusting old localStorage data.
 */
const HealthProfileRequired = ({ children }) => {
  const {
    loading,
    completed,
    error,
    retry,
  } = useStudentHealthProfileStatus();

  if (loading) {
    return (
      <StudentRouteLoading message="Checking clinic access..." />
    );
  }

  if (error) {
    return <StudentRouteStatusError retry={retry} />;
  }

  if (!completed) {
    return (
      <Navigate
        to="/student/health-profile"
        replace
      />
    );
  }

  return children;
};

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
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
                <StudentLayout>
                  <Outlet />
                </StudentLayout>
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
              Clinic services requiring completed Health Profile.
            */}
            <Route
              path="appointments"
              element={
                <HealthProfileRequired>
                  <Appointments />
                </HealthProfileRequired>
              }
            />

            <Route
              path="qr"
              element={
                <HealthProfileRequired>
                  <QR />
                </HealthProfileRequired>
              }
            />

            {/* ==================================================
                STUDENT ACCOUNT
            ================================================== */}

            <Route
              path="profile"
              element={<Profile />}
            />

            <Route
              path="profile/edit"
              element={<ProfileEdit />}
            />

            {/* ==================================================
                ALERTS
            ================================================== */}

            {/*
              Bell destination.

              Alerts.jsx will be refined later so Notifications +
              Announcements feel like one unified Student inbox.
            */}
            <Route
              path="alerts"
              element={<Alerts />}
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
              These routes are intentionally NOT sidebar items.

              They are accessed from the upper-right Account menu.
            */}
            <Route
              path="settings"
              element={<Settings />}
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
                <AdminLayout>
                  <Outlet />
                </AdminLayout>
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
              path="consultation"
              element={<NurseConsultation />}
            />

            <Route
              path="medicines"
              element={<NurseMedicine />}
            />

            <Route
              path="records"
              element={<NurseRecords />}
            />

            <Route
              path="notifications"
              element={<NurseNotifications />}
            />

            <Route
              path="announcements"
              element={<NurseAnnouncements />}
            />

            <Route
              path="settings"
              element={<NurseSettings />}
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
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
