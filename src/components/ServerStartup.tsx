'use client';

import { useEffect } from 'react';

// Component that triggers server startup tasks when the app loads
// This ensures the Spotify watcher starts automatically in production
export default function ServerStartup() {
  useEffect(() => {
    const triggerStartup = async () => {
      try {
        console.log('🚀 Triggering server startup...');
        
        const response = await fetch('/api/startup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Server startup completed:', data.message);
        } else {
          console.warn('⚠️ Server startup warning:', await response.text());
        }
      } catch (error) {
        console.warn('⚠️ Server startup error:', error);
        // Don't fail the app if startup fails
      }
    };

    // Trigger startup after a short delay to ensure the app is ready
    const timeoutId = setTimeout(triggerStartup, 1000);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // This component renders nothing - it's just for the side effect
  return null;
}
