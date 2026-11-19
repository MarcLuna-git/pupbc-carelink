import {
  useEffect,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
  Link,
} from 'react-router-dom';

import authService from '../../services/authService';

import {
  Key,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  Mail,
} from 'lucide-react';
import { StudentNoticeModal, StudentToast } from '../../components/StudentFeedback';
import { NurseNoticeModal, NurseToast } from '../../components/NurseFeedback';

const OTP_RESEND_COOLDOWN = 60;
const OTP_EXPIRY_MINUTES = 10;

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const initialEmail =
    location.state?.email?.trim() || '';

  const accountType =
    location.state?.accountType === 'nurse' ||
    new URLSearchParams(location.search).get('portal') === 'nurse'
      ? 'nurse'
      : 'student';

  // This page serves both portals, so use that portal's own feedback
  const Toast = accountType === 'nurse' ? NurseToast : StudentToast;
  const NoticeModal = accountType === 'nurse' ? NurseNoticeModal : StudentNoticeModal;

  const initialOtpSent = Boolean(
    location.state?.otpSent
  );

  const [form, setForm] = useState({
    email: initialEmail,
    otp: '',
    password: '',
    password_confirmation: '',
  });

  const [message, setMessage] =
    useState('');

  const [resetDone, setResetDone] =
    useState('');

  const [messageType, setMessageType] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [otpVerified, setOtpVerified] =
    useState(false);

  const [
    resendingOtp,
    setResendingOtp,
  ] = useState(false);

  const [
    otpCooldown,
    setOtpCooldown,
  ] = useState(
    initialOtpSent
      ? OTP_RESEND_COOLDOWN
      : 0
  );

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);


  useEffect(() => {
    if (!initialEmail) {
      navigate(
        accountType === 'nurse'
          ? '/forgot-password?portal=nurse'
          : '/forgot-password',
        {
          replace: true,
        }
      );
    }
  }, [
    initialEmail,
    accountType,
    navigate,
  ]);


  useEffect(() => {
    if (otpCooldown <= 0) {
      return undefined;
    }

    const timer =
      window.setInterval(
        () => {
          setOtpCooldown(
            (current) => {
              if (
                current <= 1
              ) {
                window.clearInterval(
                  timer
                );

                return 0;
              }

              return (
                current - 1
              );
            }
          );
        },
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [otpCooldown]);


  const handleChange = (e) => {
    const {
      name,
      value,
    } = e.target;

    let nextValue = value;

    if (name === 'otp') {
      nextValue = value
        .replace(/\D/g, '')
        .slice(0, 6);
      setOtpVerified(false);
    }

    setForm(
      (previous) => ({
        ...previous,
        [name]: nextValue,
      })
    );

    if (
      messageType ===
      'error'
    ) {
      setMessage('');
      setMessageType('');
    }
  };


  const handleResendOtp =
    async () => {
      if (
        resendingOtp ||
        otpCooldown > 0
      ) {
        return;
      }

      const email =
        form.email
          .trim()
          .toLowerCase();

      if (!email) {
        setMessageType(
          'error'
        );

        setMessage(
          'Email address is required.'
        );

        return;
      }

      setResendingOtp(
        true
      );

      setMessage('');
      setMessageType('');

      // Invalid na ang dating OTP pagkatapos ng resend.
      setForm(
        (previous) => ({
          ...previous,
          otp: '',
          password: '',
          password_confirmation: '',
        })
      );
      setOtpVerified(false);

      try {
        const res =
          await authService
            .resendPasswordResetOtp(
              email,
              accountType
            );

        if (res.success) {
          setOtpCooldown(
            OTP_RESEND_COOLDOWN
          );

          setMessageType(
            'success'
          );

          setMessage(
            res.message ||
              `A new password reset code was sent. It is valid for ${OTP_EXPIRY_MINUTES} minutes.`
          );
        } else {
          setMessageType(
            'error'
          );

          setMessage(
            res.message ||
              'Failed to resend OTP.'
          );
        }
      } catch (err) {
        console.error(
          'Password reset OTP resend failed:',
          err
        );

        setMessageType(
          'error'
        );

        setMessage(
          err.response?.data
            ?.message ||
            'Failed to resend OTP. Please try again.'
        );
      } finally {
        setResendingOtp(
          false
        );
      }
    };


  const handleSubmit =
    async (e) => {
      e.preventDefault();

      const email =
        form.email
          .trim()
          .toLowerCase();

      const otp =
        form.otp
          .replace(/\D/g, '')
          .trim();

      if (!email) {
        setMessageType(
          'error'
        );

        setMessage(
          'Email address is required.'
        );

        return;
      }

      if (
        !/^\d{6}$/.test(
          otp
        )
      ) {
        setMessageType(
          'error'
        );

        setMessage(
          'Enter the 6-digit OTP sent to your email.'
        );

        return;
      }

      if (!otpVerified) {
        setLoading(true);
        setMessage('');
        setMessageType('');
        try {
          const res = await authService.verifyPasswordResetOtp(
            email,
            otp,
            accountType
          );
          setOtpVerified(true);
          setMessageType('success');
          setMessage(res.message || 'OTP verified. You may now choose a new password.');
        } catch (err) {
          setMessageType('error');
          setMessage(err.response?.data?.message || 'OTP verification failed. Please try again.');
        } finally {
          setLoading(false);
        }
        return;
      }

      if (
        form.password.length <
        8
      ) {
        setMessageType(
          'error'
        );

        setMessage(
          'Password must be at least 8 characters.'
        );

        return;
      }

      if (!form.password_confirmation.trim()) {
        setMessageType('error');
        setMessage('Confirm Password is required.');
        return;
      }

      if (form.password !== form.password_confirmation) {
        setMessageType(
          'error'
        );

        setMessage(
          'Passwords do not match.'
        );

        return;
      }

      setLoading(true);
      setMessage('');
      setMessageType('');

      try {
        const res =
          await authService
            .resetPassword(
              email,
              otp,
              form.password,
              form.password_confirmation,
              accountType
            );

        if (res.success) {
          // Shown as a popup; its button goes to the sign-in page
          setResetDone(
            res.message ||
              'Your password was reset. You can now sign in with your new password.'
          );

          return;
        }

        setMessageType(
          'error'
        );

        setMessage(
          res.message ||
            'Password reset failed.'
        );
      } catch (err) {
        console.error(
          'Password reset failed:',
          err
        );

        setMessageType(
          'error'
        );

        setMessage(
          err.response?.data
            ?.message ||
            'Password reset failed. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="min-h-screen bg-gradient-to-br from-maroon-950 via-maroon-900 to-maroon-800 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-[10px] shadow-2xl p-8 w-full max-w-md animate-fadeInUp">

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-maroon-800 to-maroon-900 rounded-[10px] flex items-center justify-center shadow-lg mb-3">
            <Key className="w-9 h-9 text-white" />
          </div>

          <h1 className="text-2xl font-bold text-gray-800">
            Reset Password
          </h1>

          <p className="text-sm text-gray-500 mt-2 text-center">
            Enter the verification code sent to your email, then create your new password.
          </p>

          <p className="text-xs text-gray-400 mt-1">
            OTP valid for{' '}
            {OTP_EXPIRY_MINUTES}{' '}
            minutes.
          </p>
        </div>

        <Toast message={message} type={messageType === 'success' ? 'success' : 'error'} onClose={() => { setMessage(''); setMessageType(''); }} />
        <NoticeModal
          open={Boolean(resetDone)}
          type="success"
          title="Password updated"
          message={resetDone}
          actionLabel="Go to sign in"
          onClose={() => navigate(accountType === 'nurse' ? '/carelink-portal' : '/login', { replace: true })}
        />

        <form
          onSubmit={
            handleSubmit
          }
          autoComplete="off"
          className="space-y-4"
        >

          <div>
            <label className="font-semibold text-sm text-gray-700 pb-1 block">
              Email
            </label>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

              <input
                className="border border-gray-300 rounded-[10px] pl-10 pr-4 py-3 text-sm w-full bg-gray-50 text-gray-600 cursor-not-allowed focus:outline-none"
                type="email"
                name="email"
                value={
                  form.email
                }
                readOnly
                autoComplete="off"
              />
            </div>

            <p className="text-xs text-gray-400 mt-1">
              The reset code was sent to this email address.
            </p>
          </div>

          <div>
            <label className="font-semibold text-sm text-gray-700 pb-1 block">
              OTP Code
            </label>

            <input
              className="border border-gray-300 rounded-[10px] px-4 py-3 text-lg font-semibold w-full focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 text-center tracking-[0.4em]"
              type="text"
              name="otp"
              value={
                form.otp
              }
              onChange={
                handleChange
              }
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              autoComplete="off"
              required
            />

            <div className="mt-2 text-center">
              {otpCooldown >
              0 ? (
                <p className="text-xs text-gray-500">
                  Resend code in{' '}
                  <strong>
                    {
                      otpCooldown
                    }
                    s
                  </strong>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={
                    handleResendOtp
                  }
                  disabled={
                    resendingOtp
                  }
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-maroon-800 hover:text-maroon-900 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendingOtp && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}

                  {resendingOtp
                    ? 'Resending...'
                    : 'Resend OTP'}
                </button>
              )}
            </div>
          </div>

          {otpVerified && (
            <>
          <div>
            <label className="font-semibold text-sm text-gray-700 pb-1 block">
              New Password
            </label>

            <div className="relative">
              <input
                className="border border-gray-300 rounded-[10px] px-4 py-3 pr-12 text-sm w-full focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                name="password"
                value={
                  form.password
                }
                onChange={
                  handleChange
                }
                placeholder="Enter new password"
                autoComplete="off"
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (
                      current
                    ) =>
                      !current
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="font-semibold text-sm text-gray-700 pb-1 block">
              Confirm Password
            </label>

            <div className="relative">
              <input
                className="border border-gray-300 rounded-[10px] px-4 py-3 pr-12 text-sm w-full focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                type={
                  showConfirmPassword
                    ? 'text'
                    : 'password'
                }
                name="password_confirmation"
                value={
                  form.password_confirmation
                }
                onChange={
                  handleChange
                }
                placeholder="Confirm new password"
                autoComplete="off"
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    (
                      current
                    ) =>
                      !current
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                aria-label={
                  showConfirmPassword
                    ? 'Hide confirmation password'
                    : 'Show confirmation password'
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {form.password &&
            form.password ===
              form.password_confirmation && (
              <p className="text-green-600 text-xs">
                Passwords match.
              </p>
            )}
            </>
          )}

          <button
            className="w-full py-3 bg-maroon-800 hover:bg-maroon-900 text-white font-semibold rounded-[10px] flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            type="submit"
            disabled={
              loading ||
              resendingOtp
            }
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Key className="w-5 h-5" />
            )}

            <span>
              {loading
                ? otpVerified ? 'Resetting...' : 'Verifying...'
                : otpVerified ? 'Reset Password' : 'Verify OTP'}
            </span>
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to={accountType === 'nurse' ? '/carelink-portal' : '/login'}
            className="text-sm text-gray-500 hover:text-maroon-800 hover:underline inline-flex items-center space-x-1"
          >
            <ArrowLeft className="w-4 h-4" />

            <span>
              Back to Login
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;