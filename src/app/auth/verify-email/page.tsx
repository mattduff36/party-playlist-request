'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Music2, CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }

    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setStatus('success');
      setMessage(data.message || 'Email verified successfully!');
      
      if (data.user?.username) {
        setUsername(data.user.username);
      }

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);

    } catch (error: any) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to verify email. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center mb-4">
            <Music2 className="w-12 h-12 text-yellow-400" />
          </Link>
        </div>

        {/* Status Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl text-center">
          
          {/* Loading State */}
          {status === 'loading' && (
            <>
              <div className="bg-gradient-to-br from-yellow-400/20 to-pink-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">
                Verifying Your Email...
              </h1>
              <p className="text-gray-400">
                Please wait while we confirm your email address.
              </p>
            </>
          )}

          {/* Success State */}
          {status === 'success' && (
            <>
              <div className="bg-gradient-to-br from-green-400/20 to-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">
                Email Verified! 🎉
              </h1>
              <p className="text-gray-300 mb-6">
                {message}
              </p>

              {username && (
                <div className="bg-white/5 rounded-lg p-4 mb-6">
                  <p className="text-gray-400 text-sm mb-2">Your account is now active:</p>
                  <p className="text-yellow-400 font-semibold text-lg">@{username}</p>
                </div>
              )}

              <div className="bg-green-400/10 border border-green-400/30 rounded-lg p-4 mb-6">
                <p className="text-green-200 text-sm">
                  ✨ You can now log in and start creating amazing playlist experiences!
                </p>
              </div>

              <p className="text-gray-400 text-sm mb-6">
                Redirecting to login page in a few seconds...
              </p>

              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold py-3 px-4 rounded-lg transition-all duration-300"
              >
                Go to Login Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </>
          )}

          {/* Error State */}
          {status === 'error' && (
            <>
              <div className="bg-gradient-to-br from-red-400/20 to-rose-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">
                Verification Failed
              </h1>
              <p className="text-gray-300 mb-6">
                {message}
              </p>

              <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-4 mb-6">
                <p className="text-red-200 text-sm">
                  {message.includes('expired') 
                    ? '⏰ Your verification link has expired. Please register again or request a new verification email.'
                    : '❌ This verification link is invalid or has already been used.'}
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  href="/register"
                  className="block w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold py-3 px-4 rounded-lg transition-all duration-300"
                >
                  Register Again
                </Link>
                <Link
                  href="/auth/login"
                  className="block w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-4 rounded-lg transition-all duration-300 border border-white/20"
                >
                  Go to Login
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-yellow-400 animate-spin mb-4" />
          <p className="text-white">Loading verification...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
