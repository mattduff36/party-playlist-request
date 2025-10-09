'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Music2, Mail, Loader2, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setStatus('error');
      setMessage('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setStatus('idle');
    setMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      setStatus('success');
      setMessage(data.message || 'Password reset email sent!');

    } catch (error: any) {
      console.error('Forgot password error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
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
          <h1 className="text-3xl font-bold text-white mb-2">Reset Your Password</h1>
          <p className="text-gray-400">Enter your email and we'll send you a reset link</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
          
          {status === 'success' ? (
            // Success State
            <div className="text-center">
              <div className="bg-gradient-to-br from-green-400/20 to-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Check Your Email! 📧</h2>
              <p className="text-gray-300 mb-6">{message}</p>
              
              <div className="bg-green-400/10 border border-green-400/30 rounded-lg p-4 mb-6 text-left">
                <p className="text-green-200 text-sm mb-3 font-medium">What to do next:</p>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">1.</span>
                    <span>Check your email inbox for {email}</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">2.</span>
                    <span>Click the password reset link</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">3.</span>
                    <span>Create your new password</span>
                  </li>
                </ul>
              </div>

              <p className="text-gray-400 text-sm mb-6">
                💡 The reset link will expire in <strong className="text-white">1 hour</strong>. 
                Check your spam folder if you don't see the email.
              </p>

              <Link
                href="/auth/login"
                className="block w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold py-3 px-4 rounded-lg transition-all duration-300 text-center"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            // Form State
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message */}
              {status === 'error' && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <p className="text-red-200 text-sm">{message}</p>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    placeholder="you@example.com"
                    disabled={isSubmitting}
                    autoFocus
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  Enter the email address associated with your account
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !email}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-gray-900 font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          )}

          {/* Additional Links */}
          {status !== 'success' && (
            <div className="mt-6 pt-6 border-t border-white/10 space-y-3 text-center">
              <Link
                href="/auth/login"
                className="block text-gray-400 hover:text-yellow-400 transition-colors text-sm"
              >
                Remember your password? <span className="font-medium">Log in</span>
              </Link>
              <Link
                href="/register"
                className="block text-gray-400 hover:text-yellow-400 transition-colors text-sm"
              >
                Don't have an account? <span className="font-medium">Sign up</span>
              </Link>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm inline-flex items-center">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
