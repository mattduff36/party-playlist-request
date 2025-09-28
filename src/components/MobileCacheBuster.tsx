'use client';

import { useEffect } from 'react';

const CURRENT_VERSION = '1.0.1'; // Increment this when you need to force mobile refresh

export default function MobileCacheBuster() {
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      console.log('📱 MobileCacheBuster: Mobile device detected');
      
      // Check stored version
      const storedVersion = localStorage.getItem('app_version');
      console.log('📱 MobileCacheBuster: Stored version:', storedVersion);
      console.log('📱 MobileCacheBuster: Current version:', CURRENT_VERSION);
      
      if (storedVersion !== CURRENT_VERSION) {
        console.log('📱 MobileCacheBuster: Version mismatch detected - clearing cache');
        
        // Clear localStorage except for admin_token
        const adminToken = localStorage.getItem('admin_token');
        localStorage.clear();
        if (adminToken) {
          localStorage.setItem('admin_token', adminToken);
        }
        
        // Store new version
        localStorage.setItem('app_version', CURRENT_VERSION);
        
        // Force a hard reload to bypass cache
        console.log('📱 MobileCacheBuster: Forcing hard reload...');
        window.location.reload();
        return;
      }
      
      // Add cache-busting headers to all fetch requests on mobile
      const originalFetch = window.fetch;
      window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        
        // Only add cache busting to our API calls
        if (url.includes('/api/')) {
          const separator = url.includes('?') ? '&' : '?';
          const cacheBustedUrl = `${url}${separator}mobile_t=${Date.now()}`;
          
          const newInit = {
            ...init,
            headers: {
              ...init?.headers,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            cache: 'no-store' as RequestCache
          };
          
          console.log('📱 MobileCacheBuster: Cache-busting API call:', cacheBustedUrl);
          return originalFetch(cacheBustedUrl, newInit);
        }
        
        return originalFetch(input, init);
      };
      
      console.log('📱 MobileCacheBuster: Mobile optimizations applied');
    }
  }, []);

  return null; // This component doesn't render anything
}
