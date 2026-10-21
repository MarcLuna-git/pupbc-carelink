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
  Lock,
  ShieldCheck,
} from 'lucide-react';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const accountType = new URLSearchParams(location.search).get('portal') === 'nurse'
    ? 'nurse'
    : 'student';

  const [email, setEmail] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      const cleanEmail =
        email.trim();

      if (!cleanEmail) {
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
            700
          );
        } else {
          setMessage(
            res.message ||
              'Failed to send OTP.'
          );
        }
      } catch (err) {
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
      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm animate-fadeInUp sm:p-8">

        <div className="mb-6 flex flex-col items-center">

          {/* Mail + lock icon */}
          <div className="relative mb-5 mt-2">
            <div className="absolute -inset-x-6 inset-y-2 rounded-full bg-rose-100/70" />

            <span className="absolute -left-5 top-0 h-1 w-4 rotate-45 rounded-full bg-rose-400/80" />
            <span className="absolute -left-7 top-5 h-1 w-3 rounded-full bg-rose-400/70" />
            <span className="absolute -right-5 top-2 h-1 w-3 -rotate-45 rounded-full bg-rose-400/70" />
            <span className="absolute -right-7 top-7 h-1 w-3 rounded-full bg-rose-400/70" />

            <div className="relative flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl bg-gradient-to-br from-maroon-800 to-maroon-950">
              <Mail
                className="h-8 w-8 rotate-6 text-white"
                strokeWidth={2.2}
              />
            </div>

            <span className="absolute -bottom-2 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
              <Lock
                className="h-4 w-4 text-maroon-800"
                strokeWidth={2.6}
              />
            </span>
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

        {message && (
          <div
            className={`mb-4 rounded-xl p-3 text-center text-sm ${
              message
                .toLowerCase()
                .includes('sent')
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
            role="status"
          >
            {message}
          </div>
        )}

        <form
          onSubmit={
            handleSubmit
          }
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
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-maroon-800 focus:bg-white focus:outline-none"
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              placeholder="your@email.com"
              autoComplete="email"
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
            to={accountType === 'nurse' ? '/nurse/login' : '/login'}
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
