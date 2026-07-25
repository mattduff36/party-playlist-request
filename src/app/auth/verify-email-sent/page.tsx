'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Music2, Mail, ArrowLeft } from 'lucide-react';
import { Suspense } from 'react';

function VerifyEmailSentContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || 'your email';

  return (
    <div className="min-h-screen bg-gradient-to-br [#191414] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center mb-4">
            <Music2 className="w-12 h-12 text-accent" />
          </Link>
        </div>

        {/* Success Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl text-center">
          {/* Icon */}
          <div className="bg-accent/15 border border-accent/30 w-20 h-20 rounded-lg flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-accent" />
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-bone mb-4">
            Check Your Email
          </h1>

          {/* Message */}
          <p className="text-muted mb-2">
            We've sent a verification link to:
          </p>
          <p className="text-accent font-semibold text-lg mb-6">
            {email}
          </p>

          <p className="text-muted text-sm mb-8">
            Click the link in the email to verify your account and get started. 
            The link will expire in <strong className="text-bone">24 hours</strong>.
          </p>

          {/* Instructions */}
          <div className="bg-white/5 rounded-lg p-4 mb-6 text-left">
            <p className="text-muted text-sm mb-3 font-medium">What to do next:</p>
            <ul className="space-y-2 text-muted text-sm">
              <li className="flex items-start">
                <span className="text-accent mr-2">1.</span>
                <span>Open your email inbox</span>
              </li>
              <li className="flex items-start">
                <span className="text-accent mr-2">2.</span>
                <span>Find the email from Party Playlist</span>
              </li>
              <li className="flex items-start">
                <span className="text-accent mr-2">3.</span>
                <span>Click the verification link</span>
              </li>
              <li className="flex items-start">
                <span className="text-accent mr-2">4.</span>
                <span>Start creating your playlist experience!</span>
              </li>
            </ul>
          </div>

          {/* Note */}
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-6">
            <p className="text-muted text-sm">
              <strong className="text-bone">Tip:</strong> Check your spam folder if you don't see the email in a few minutes.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full bg-accent hover:bg-accent-hover text-gray-900 font-bold py-3 px-4 rounded-lg transition-all duration-300"
            >
              Go to Login
            </Link>
            
            {/* Resend option - can implement later */}
            {/* <button
              className="w-full bg-white/10 hover:bg-white/20 text-bone font-medium py-3 px-4 rounded-lg transition-all duration-300 border border-white/20"
            >
              Resend Verification Email
            </button> */}
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-muted hover:text-accent transition-colors text-sm inline-flex items-center">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailSentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br [#191414] flex items-center justify-center">
        <div className="text-bone">Loading...</div>
      </div>
    }>
      <VerifyEmailSentContent />
    </Suspense>
  );
}
