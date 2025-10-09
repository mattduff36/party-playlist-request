'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Music2, Users, Smartphone, Zap, Radio, Heart } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const features = [
    {
      icon: <Music2 className="w-8 h-8" />,
      title: 'Spotify Integration',
      description: 'Connect your Spotify account and let guests request songs directly to your queue'
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Guest Requests',
      description: 'Share a simple link and let your guests browse and request their favorite tracks'
    },
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: 'Real-Time Updates',
      description: 'See requests instantly with live updates across all devices'
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Easy Management',
      description: 'Approve, reject, or queue songs with a simple tap from your admin panel'
    },
    {
      icon: <Radio className="w-8 h-8" />,
      title: 'Display Screen',
      description: 'Show current song, queue, and notifications on a big screen at your venue'
    },
    {
      icon: <Heart className="w-8 h-8" />,
      title: 'Made for Events',
      description: 'Perfect for parties, weddings, bars, restaurants, and any gathering with music'
    }
  ];

  return (
    <div className="min-h-screen bg-[#191414]">
      {/* Navigation */}
      <nav className="bg-black/50 backdrop-blur-md border-b border-[#1DB954]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Music2 className="w-8 h-8 text-[#1DB954]" />
              <span className="ml-2 text-xl font-bold text-white">Party Playlist</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/auth/login"
                className="text-white hover:text-[#1DB954] transition-colors font-medium"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="bg-[#1DB954] hover:bg-[#1ed760] text-black px-6 py-2 rounded-full font-bold transition-all duration-300 shadow-lg hover:shadow-[#1DB954]/50 hover:scale-105"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-[#1DB954] rounded-full blur-2xl opacity-30 animate-pulse"></div>
              <Music2 className="relative w-20 h-20 text-[#1DB954]" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
            Let Your Guests
            <br />
            <span className="text-[#1DB954]">
              Choose The Music
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-400 mb-8 max-w-3xl mx-auto">
            Create interactive playlist experiences for your parties, events, and venues. 
            Professional DJ tools made simple. Let the good times roll! 🎉
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/register"
              className="w-full sm:w-auto bg-[#1DB954] hover:bg-[#1ed760] text-black px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-2xl hover:shadow-[#1DB954]/50 hover:scale-105"
            >
              Get Started →
            </Link>
            <Link
              href="/auth/login"
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 border border-white/20"
            >
              Sign In
            </Link>
          </div>

          <p className="text-sm text-gray-500">
            ✨ Professional DJ tools • Connect Spotify in seconds
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Everything You Need for
            <span className="text-[#1DB954]"> Amazing Parties</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Built for DJs, event organizers, and music lovers who want to engage their audience
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-black/30 backdrop-blur-md rounded-2xl p-8 border border-[#1DB954]/20 hover:border-[#1DB954] hover:bg-black/50 transition-all duration-300 hover:scale-105"
            >
              <div className="bg-[#1DB954]/10 w-16 h-16 rounded-xl flex items-center justify-center mb-6 text-[#1DB954]">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-black/30">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Simple as <span className="text-[#1DB954]">1, 2, 3</span>
          </h2>
          <p className="text-gray-400 text-lg">Get started in minutes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Connect Spotify', desc: 'Link your Spotify account and select your playback device' },
            { step: '2', title: 'Share Your Link', desc: 'Send your unique request page URL to your guests' },
            { step: '3', title: 'Manage Requests', desc: 'Approve songs and keep the party going from your admin panel' }
          ].map((item, index) => (
            <div key={index} className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1DB954] text-black font-bold text-2xl mb-6">
                {item.step}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
              <p className="text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-[#1DB954] to-[#1ed760] rounded-3xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
            Ready to Transform Your Events?
          </h2>
          <p className="text-black/80 text-lg mb-8 max-w-2xl mx-auto">
            Join DJs and event organizers who are creating unforgettable music experiences
          </p>
          <Link
            href="/register"
            className="inline-block bg-black hover:bg-gray-900 text-[#1DB954] px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-xl hover:scale-105"
          >
            Get Started Free
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black border-t border-[#1DB954]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <Music2 className="w-6 h-6 text-[#1DB954]" />
              <span className="ml-2 text-white font-bold">Party Playlist</span>
            </div>
            <div className="flex space-x-6 text-sm text-gray-400">
              <Link href="/privacy" className="hover:text-[#1DB954] transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-[#1DB954] transition-colors">Terms</Link>
              <Link href="/contact" className="hover:text-[#1DB954] transition-colors">Contact</Link>
            </div>
          </div>
          <div className="mt-8 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Party Playlist. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
