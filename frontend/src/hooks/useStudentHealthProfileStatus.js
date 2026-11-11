import { useCallback, useEffect, useState } from 'react';

import api from '../services/api';
import { sessionId, getUser, setUser } from '../services/session';

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
const hasCompletedStatusCache = () => completedHealthProfileCache.token === sessionId('student') &&
  completedHealthProfileCache.completed && Date.now() - completedHealthProfileCache.fetchedAt < COMPLETED_STATUS_CACHE_MS;
window.addEventListener('carelink:health-profile-saved', () => {
  completedHealthProfileCache = { token: null, completed: false, fetchedAt: 0 };
});

/*
 * Safely read the locally stored authenticated user.
 *
 * Local data is used only for UI synchronization.
 * It is NOT the final authority for Health Profile completion.
 */
const getStoredStudent = () => {
  const storedUser = getUser('student');

  return Object.keys(storedUser).length ? storedUser : null;
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

    setUser(updatedUser, 'student');

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
  const token = sessionId('student');

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
  if (sessionId('student') !== token) throw new Error('Session changed.');

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
 * Shared Health Profile verification hook.
 *
 * Used by the clinic-service pages (Appointments, QR) to gate themselves on
 * a backend-verified completed Health Profile. Pages call this directly so
 * their OWN loading skeleton covers the verification — one loading phase,
 * same flow as the unguarded pages.
 */
const useStudentHealthProfileStatus = () => {
  const [state, setState] = useState(() => ({
    loading: !hasCompletedStatusCache(),
    completed: hasCompletedStatusCache(),
    exists: hasCompletedStatusCache(),
    error: '',
  }));

  const checkStatus = useCallback(async () => {
    setState((current) => ({
      ...current,
      loading: !hasCompletedStatusCache(),
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
       * If we have a valid completed cache or the stored user
       * indicates a completed profile, keep access open and
       * retry silently instead of blocking the user.
       */
      const storedUser = getStoredStudent();
      const storedCompleted = toBoolean(
        storedUser?.profile?.health_profile_completed ||
          storedUser?.health_profile_completed
      );
      const hasCache = hasCompletedStatusCache();

      if (storedCompleted || hasCache) {
        setState({
          loading: false,
          completed: true,
          exists: true,
          error: '',
        });
      } else {
        setState({
          loading: false,
          completed: false,
          exists: false,
          error:
            'We could not verify your Health Profile. Please try again.',
        });
      }
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

export { useStudentHealthProfileStatus };
