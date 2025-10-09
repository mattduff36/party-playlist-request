'use client';

import Link from 'next/link';
import { Music2, Lock } from 'lucide-react';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#191414] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-black/50 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-[#1DB954]/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-[#1DB954] rounded-full blur-xl opacity-30 animate-pulse"></div>
                <Lock className="relative w-16 h-16 text-[#1DB954]" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Registration Closed
            </h1>
            <p className="text-gray-400">
              Account creation is currently by invitation only
            </p>
          </div>

          {/* Message */}
          <div className="bg-[#1DB954]/10 border border-[#1DB954]/30 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <Music2 className="w-6 h-6 text-[#1DB954] mr-3 flex-shrink-0 mt-1" />
              <div>
                <p className="text-white font-medium mb-2">
                  Currently Invitation-Only
                </p>
                <p className="text-gray-400 text-sm">
                  We're currently in a limited access phase. New accounts can only be created 
                  by our administrators. If you're interested in using Party Playlist for your 
                  events, please contact us to request access.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/auth/login"
              className="block w-full bg-[#1DB954] hover:bg-[#1ed760] text-black px-6 py-3 rounded-full font-bold text-center transition-all duration-300 shadow-lg hover:shadow-[#1DB954]/50"
            >
              Already Have an Account? Log In
            </Link>
            
            <Link
              href="/"
              className="block w-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-6 py-3 rounded-full font-semibold text-center transition-all duration-300 border border-white/20"
            >
              Back to Home
            </Link>
          </div>

          {/* Footer Note */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Want access?{' '}
              <a 
                href="mailto:support@partyplaylist.app" 
                className="text-[#1DB954] hover:text-[#1ed760] underline transition-colors"
              >
                Contact us
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
