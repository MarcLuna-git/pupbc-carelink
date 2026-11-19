import {
  useState,
} from 'react';

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import authService from '../../services/authService';

import {
  Mail,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { StudentToast } from '../../components/StudentFeedback';
import { NurseToast } from '../../components/NurseFeedback';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const accountType = new URLSearchParams(location.search).get('portal') === 'nurse'
    ? 'nurse'
    : 'student';
  // This page serves both portals, so use that portal's own feedback
  const Toast = accountType === 'nurse' ? NurseToast : StudentToast;

  const [email, setEmail] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [messageType, setMessageType] =
    useState('error');

  const [loading, setLoading] =
    useState(false);

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      const cleanEmail =
        email.trim();

      if (!cleanEmail) {
        setMessageType('error');
        setMessage(
          'Please enter your email address.'
        );

        return;
      }

      setLoading(true);
      setMessage('');

      try {
        const res =
          await authService
            .forgotPassword(
              cleanEmail,
              accountType
            );

        if (res.success) {
          setMessageType('success');
          setMessage(
            res.message ||
              'A password reset code was sent to your email.'
          );

          // Ipasa ang email para hindi na ulit i-type.
          window.setTimeout(
            () => {
              navigate(
                '/reset-password',
                {
                  state: {
                    email:
                      cleanEmail,

                    otpSent: true,
                    accountType,
                  },
                }
              );
            },
            1500
          );
        } else {
          setMessageType('error');
          setMessage(
            res.message ||
              'Failed to send OTP.'
          );
        }
      } catch (err) {
        setMessageType('error');
        setMessage(
          err.response?.data
            ?.message ||
            'Failed to send OTP.'
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="min-h-screen recovery-auth-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-[10px] border border-white/60 bg-white/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm animate-fadeInUp sm:p-8">

        <div className="mb-6 flex flex-col items-center">

          {/* Simple icon badge — same style as the appointment info modal. */}
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
            <Mail className="h-6 w-6 text-maroon-800" />
          </div>

          <h1 className="text-center text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            <span className="text-slate-900">
              Forgot{' '}
            </span>
            <span className="text-maroon-800">
              Password?
            </span>
          </h1>

          <p className="mt-3 max-w-sm text-center text-sm leading-6 text-slate-500">
            No worries! Enter your email address and
            we&apos;ll send you a 6-digit password
            reset code.
          </p>

          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-maroon-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100">
              <Clock className="h-4 w-4" />
            </span>
            The code is valid for 10 minutes.
          </p>
        </div>

        <Toast message={message} type={messageType} onClose={() => setMessage('')} />

        <form
          onSubmit={
            handleSubmit
          }
          autoComplete="off"
          className="space-y-5"
        >

          <div>
            <label
              htmlFor="forgot-email"
              className="mb-2 flex items-center gap-3 text-sm font-semibold text-slate-800"
            >
              <Mail className="h-5 w-5 text-maroon-800" />
              Email Address
            </label>

            <input
              id="forgot-email"
              className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-maroon-800 focus:bg-white focus:outline-none"
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              placeholder="your@email.com"
              autoComplete="off"
              required
            />
          </div>

          <button
            className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-maroon-800 py-3.5 font-semibold text-white transition-colors hover:text-gray-300 disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Mail className="h-5 w-5" />
            )}

            <span>
              {loading
                ? 'Sending...'
                : 'Send OTP'}
            </span>

            {!loading && (
              <ArrowRight className="absolute right-6 h-5 w-5" />
            )}
          </button>
        </form>

        <div className="my-5 flex items-center gap-4 text-xs font-medium text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          OR
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="text-center">
          <Link
            to={accountType === 'nurse' ? '/carelink-portal' : '/login'}
            className="inline-flex items-center gap-2 text-sm font-semibold text-maroon-800 hover:text-maroon-950 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-maroon-800" />
          Keep your account safe
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
