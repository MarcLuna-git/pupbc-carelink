import {
  useState,
} from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import authService from '../../services/authService';

import {
  Mail,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

const ForgotPassword = () => {
  const navigate = useNavigate();

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
              cleanEmail
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

      <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl p-6 sm:p-8 w-full max-w-md animate-fadeInUp">

        <div className="flex flex-col items-center mb-6">

          <div className="w-16 h-16 bg-maroon-800 rounded-2xl flex items-center justify-center shadow-lg mb-3">

            <Mail className="w-9 h-9 text-yellow-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-800">
            Forgot Password
          </h1>

          <p className="text-sm text-gray-500 mt-2 text-center">
            Enter your email
            and we&apos;ll send
            you a 6-digit
            password reset code.
          </p>

          <p className="text-xs text-gray-400 mt-1 text-center">
            The code is valid
            for 10 minutes.
          </p>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-xl text-sm text-center ${
              message
                .toLowerCase()
                .includes('sent')
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message}
          </div>
        )}

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-4"
        >

          <div>
            <label className="font-semibold text-sm text-gray-700 pb-1 block">
              Email Address
            </label>

            <input
              className="border border-gray-300 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-maroon-500"
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
            className="w-full py-3 bg-maroon-800 hover:bg-maroon-900 text-white font-semibold rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 hover:shadow-lg transition"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Mail className="w-5 h-5" />
            )}

            <span>
              {loading
                ? 'Sending...'
                : 'Send OTP'}
            </span>
          </button>
        </form>

        <div className="mt-6 text-center">

          <Link
            to="/login"
            className="text-sm text-maroon-800 hover:text-maroon-900 hover:underline inline-flex items-center space-x-1"
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

export default ForgotPassword;