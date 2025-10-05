'use client';

import Link from 'next/link';
import { Music2, Sparkles, Users, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music2 className="w-8 h-8 text-white" />
            <span className="text-2xl font-bold text-white">PartyPlaylist</span>
          </div>
          <Link
            href="/login"
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all backdrop-blur-sm border border-white/20"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main Heading */}
          <div className="mb-8">
            <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Let Your Guests
              <br />
              <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                Control the Music
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-12 max-w-2xl mx-auto">
              The perfect DJ tool for parties, events, and venues. 
              Your guests request songs, you approve them instantly.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <Link
              href="/login"
              className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-lg font-semibold rounded-xl transition-all transform hover:scale-105 shadow-2xl"
            >
              Get Started
            </Link>
            <a
              href="mailto:contact@partyplaylist.co.uk"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white text-lg font-semibold rounded-xl transition-all backdrop-blur-sm border border-white/20"
            >
              Contact Us
            </a>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-white/10">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Instant Requests
              </h3>
              <p className="text-blue-200">
                Guests scan a QR code and request songs from Spotify in seconds.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-white/10">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                You're in Control
              </h3>
              <p className="text-blue-200">
                Approve, skip, or reject requests with one tap. Your party, your rules.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-lg p-8 rounded-2xl border border-white/10">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Everyone's Happy
              </h3>
              <p className="text-blue-200">
                Guests feel involved, you stay in control. Perfect balance for any event.
              </p>
            </div>
          </div>

          {/* Social Proof / Tagline */}
          <div className="mt-20 text-center">
            <p className="text-blue-200 text-lg">
              Perfect for <span className="text-white font-semibold">weddings</span>, 
              <span className="text-white font-semibold"> parties</span>, 
              <span className="text-white font-semibold"> bars</span>, and 
              <span className="text-white font-semibold"> events</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-white/10">
        <div className="flex flex-col md:flex-row justify-between items-center text-blue-200 text-sm">
          <p>© 2025 PartyPlaylist. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="mailto:contact@partyplaylist.co.uk" className="hover:text-white transition-colors">
              Contact
            </a>
            <Link href="/login" className="hover:text-white transition-colors">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
