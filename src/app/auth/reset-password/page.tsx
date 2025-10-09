'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Music2, Loader2, CheckCircle, XCircle, Eye, EyeOff, Lock, AlertCircle } from 'lucide-react';

// Password strength calculator
function getPasswordStrength(password: string): { level: 'weak' | 'medium' | 'strong'; score: number } {
  if (password.length < 8) return { level: 'weak', score: 0 };
  
  let score = 0;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score <= 2) return { level: 'weak', score };
  if (score <= 4) return { level: 'medium', score };
  return { level: 'strong', score };
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const passwordStrength = password ? getPasswordStrength(password) : null;

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid reset link. No token provided.');
    }
  }, [token]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!token) {
      setStatus('error');
      setMessage('Invalid reset link');
      return;
    }

    setIsSubmitting(true);
    setStatus('idle');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setStatus('success');
      setMessage(data.message || 'Password reset successfully!');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);

    } catch (error: any) {
      console.error('Reset password error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#191414] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center mb-4">
            <Music2 className="w-12 h-12 text-[#1DB954]" />
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Create New Password</h1>
          <p className="text-gray-400">Enter your new password below</p>
        </div>

        {/* Content Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
          
          {/* Success State */}
          {status === 'success' ? (
            <div className="text-center">
              <div className="bg-gradient-to-br from-green-400/20 to-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Password Reset! 🎉</h2>
              <p className="text-gray-300 mb-6">{message}</p>
              
              <div className="bg-green-400/10 border border-green-400/30 rounded-lg p-4 mb-6">
                <p className="text-green-200 text-sm">
                  ✨ You can now log in with your new password
                </p>
              </div>

              <p className="text-gray-400 text-sm mb-6">
                Redirecting to login page...
              </p>

              <Link
                href="/auth/login"
                className="block w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold py-3 px-4 rounded-full transition-all duration-300 text-center"
              >
                Go to Login Now
              </Link>
            </div>
          ) : status === 'error' && !token ? (
            // Invalid Token State
            <div className="text-center">
              <div className="bg-gradient-to-br from-red-400/20 to-rose-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Invalid Reset Link</h2>
              <p className="text-gray-300 mb-6">{message}</p>
              
              <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-4 mb-6">
                <p className="text-red-200 text-sm">
                  This password reset link is invalid or has expired. Please request a new one.
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  href="/auth/forgot-password"
                  className="block w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold py-3 px-4 rounded-full transition-all duration-300 text-center"
                >
                  Request New Reset Link
                </Link>
                <Link
                  href="/auth/login"
                  className="block w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-4 rounded-lg transition-all duration-300 border border-white/20 text-center"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            // Form State
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message */}
              {status === 'error' && message && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <p className="text-red-200 text-sm">{message}</p>
                </div>
              )}

              {/* New Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-12 pr-12 py-3 bg-white/10 border ${
                      errors.password ? 'border-red-500' : 'border-white/30'
                    } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1DB954] focus:border-transparent`}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                    autoFocus
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && passwordStrength && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${
                            i < passwordStrength.score
                              ? passwordStrength.level === 'weak'
                                ? 'bg-red-500'
                                : passwordStrength.level === 'medium'
                                ? 'bg-[#1DB954]'
                                : 'bg-green-500'
                              : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <p
                      className={`text-sm ${
                        passwordStrength.level === 'weak'
                          ? 'text-red-400'
                          : passwordStrength.level === 'medium'
                          ? 'text-[#1DB954]'
                          : 'text-green-400'
                      }`}
                    >
                      Password strength: {passwordStrength.level}
                    </p>
                  </div>
                )}

                {errors.password && (
                  <p className="mt-2 text-sm text-red-400">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-200 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-12 pr-12 py-3 bg-white/10 border ${
                      errors.confirmPassword ? 'border-red-500' : 'border-white/30'
                    } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1DB954] focus:border-transparent`}
                    placeholder="••••••••"
                    disabled={isSubmitting}
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-2 text-sm text-red-400">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !password || !confirmPassword}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-black font-bold py-3 px-4 rounded-full transition-all duration-300 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          )}

          {/* Additional Links */}
          {status !== 'success' && status !== 'error' && (
            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <Link
                href="/auth/login"
                className="text-gray-400 hover:text-[#1DB954] transition-colors text-sm"
              >
                Remember your password? <span className="font-medium">Log in</span>
              </Link>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-gray-400 hover:text-[#1DB954] transition-colors text-sm">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-[#1DB954] animate-spin mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
