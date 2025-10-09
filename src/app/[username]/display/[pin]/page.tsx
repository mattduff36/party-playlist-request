'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Display Page with PIN in URL
 * Simple authentication: /[username]/display/[PIN]
 * Verifies PIN and redirects to main display page
 */
export default function DisplayWithPinPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const pin = params.pin as string;
  
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyPinAndRedirect();
  }, [username, pin]);

  async function verifyPinAndRedirect() {
    try {
      console.log(`🔐 Verifying PIN ${pin} for user ${username}...`);
      
      // Verify PIN with the backend
      const response = await fetch('/api/events/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Invalid PIN');
        setVerifying(false);
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ PIN verified, authenticating display...');
        
        // Store authentication in sessionStorage
        sessionStorage.setItem(`display_auth_${username}`, JSON.stringify({
          authenticated: true,
          timestamp: Date.now(),
          pin: pin
        }));
        
        // Redirect to main display page (without PIN in URL)
        router.push(`/${username}/display`);
      } else {
        setError(data.error || 'Invalid PIN');
        setVerifying(false);
      }
    } catch (error) {
      console.error('❌ Error verifying PIN:', error);
      setError('Failed to verify PIN');
      setVerifying(false);
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-12 rounded-2xl text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Verifying PIN...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md p-12 rounded-2xl text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-white mb-4">Invalid PIN</h1>
          <p className="text-gray-200 mb-6">{error}</p>
          <p className="text-gray-300 text-sm mb-4">
            Get the correct PIN from the admin panel and use: <br />
            <code className="bg-black/30 px-2 py-1 rounded mt-2 inline-block">
              /{username}/display/[PIN]
            </code>
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
          >
            Go to Admin Login
          </button>
        </div>
      </div>
    );
  }

  return null;
}

