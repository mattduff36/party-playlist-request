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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      {/* Navigation */}
      <nav className="bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Music2 className="w-8 h-8 text-yellow-400" />
              <span className="ml-2 text-xl font-bold text-white">Party Playlist</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/auth/login"
                className="text-white hover:text-yellow-400 transition-colors font-medium"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 px-6 py-2 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
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
              <div className="absolute inset-0 bg-yellow-400 rounded-full blur-2xl opacity-30 animate-pulse"></div>
              <Music2 className="relative w-20 h-20 text-yellow-400" />
            </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
            Let Your Guests
            <br />
            <span className="bg-gradient-to-r from-yellow-400 to-pink-500 bg-clip-text text-transparent">
              Choose The Music
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Create interactive playlist experiences for your parties, events, and venues. 
            Connect Spotify, share a link, and let the good times roll! 🎉
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/register"
              className="w-full sm:w-auto bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-2xl hover:shadow-yellow-400/50 hover:scale-105"
            >
              Start Free Now →
            </Link>
            <Link
              href="/auth/login"
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 border border-white/20"
            >
              Sign In
            </Link>
          </div>

          <p className="text-sm text-gray-400">
            ✨ Free to use • No credit card required • Connect Spotify in seconds
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Everything You Need for
            <span className="text-yellow-400"> Amazing Parties</span>
          </h2>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Built for DJs, event organizers, and music lovers who want to engage their audience
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10 hover:border-yellow-400/50 hover:bg-white/10 transition-all duration-300 hover:scale-105"
            >
              <div className="bg-gradient-to-br from-yellow-400/20 to-pink-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6 text-yellow-400">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-gray-300">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Get Started in <span className="text-yellow-400">3 Simple Steps</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Create Account', desc: 'Sign up for free and connect your Spotify account' },
            { step: '2', title: 'Share Link', desc: 'Share your custom request page link with guests' },
            { step: '3', title: 'Manage Requests', desc: 'Approve songs and watch them appear in your Spotify queue' }
          ].map((item, index) => (
            <div key={index} className="relative">
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10 text-center">
                <div className="bg-gradient-to-br from-yellow-400 to-pink-500 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-gray-900 mx-auto mb-6">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-300">{item.desc}</p>
              </div>
              {index < 2 && (
                <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                  <div className="text-yellow-400 text-3xl">→</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-yellow-400/20 to-pink-500/20 backdrop-blur-md rounded-3xl p-12 border border-white/10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Rock Your Next Event? 🎸
          </h2>
          <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
            Join DJs and event hosts who are already creating unforgettable music experiences
          </p>
          <Link
            href="/register"
            className="inline-block bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 shadow-2xl hover:shadow-yellow-400/50 hover:scale-105"
          >
            Create Your Free Account →
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black/30 backdrop-blur-md border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center mb-4">
                <Music2 className="w-8 h-8 text-yellow-400" />
                <span className="ml-2 text-xl font-bold text-white">Party Playlist</span>
              </div>
              <p className="text-gray-400 mb-4">
                The easiest way to let your guests choose the music at your next party or event.
              </p>
              <p className="text-sm text-gray-500">
                © 2025 Party Playlist. All rights reserved.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><Link href="/register" className="text-gray-400 hover:text-yellow-400 transition-colors">Get Started</Link></li>
                <li><Link href="/auth/login" className="text-gray-400 hover:text-yellow-400 transition-colors">Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">Terms</Link></li>
                <li><Link href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">Privacy</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}