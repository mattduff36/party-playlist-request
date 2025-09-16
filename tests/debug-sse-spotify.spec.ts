import { test, expect } from '@playwright/test';

test.describe('Debug SSE and Spotify Issues', () => {
  test('Debug SSE connection and Spotify data flow', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`🖥️  BROWSER: ${msg.type()}: ${msg.text()}`);
    });

    // Enable network logging
    page.on('request', request => {
      if (request.url().includes('/api/admin/events') || 
          request.url().includes('/api/admin/playback') ||
          request.url().includes('spotify')) {
        console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/admin/events') || 
          response.url().includes('/api/admin/playback') ||
          response.url().includes('spotify')) {
        console.log(`📥 RESPONSE: ${response.status()} ${response.url()}`);
      }
    });

    console.log('\n🔍 Testing SSE and Spotify data flow...\n');

    // Step 1: Login to admin
    console.log('🔐 Step 1: Admin login');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    console.log('✅ Admin login successful');

    // Step 2: Enable force polling to ensure Spotify stays connected
    console.log('⚙️ Step 2: Enable force polling');
    await page.goto('http://localhost:3000/admin/settings');
    await page.waitForLoadState('networkidle');
    
    const forcePollingCheckbox = page.locator('#force_polling');
    const isChecked = await forcePollingCheckbox.isChecked();
    if (!isChecked) {
      await forcePollingCheckbox.check();
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      console.log('✅ Force polling enabled');
    } else {
      console.log('✅ Force polling already enabled');
    }

    // Step 3: Go to overview page and monitor data
    console.log('📊 Step 3: Monitor overview page data');
    await page.goto('http://localhost:3000/admin/overview');
    await page.waitForLoadState('networkidle');

    // Step 4: Wait and capture data flow
    console.log('⏳ Step 4: Monitoring data flow for 15 seconds...');
    
    const dataFlow = await page.evaluate(() => {
      return new Promise((resolve) => {
        const logs = [];
        const originalLog = console.log;
        let spotifyData = null;
        let playbackState = null;
        
        console.log = (...args) => {
          const message = args.join(' ');
          logs.push({
            timestamp: Date.now(),
            message: message
          });
          originalLog(...args);
        };
        
        // Monitor for specific data patterns
        const checkForData = () => {
          // Try to access React component state if possible
          const overviewElements = document.querySelectorAll('[data-testid], .now-playing, .spotify');
          const hasNowPlayingBox = document.querySelector('.bg-gray-800') !== null;
          const hasAlbumArt = document.querySelector('img[src*="spotify"]') !== null;
          const hasTrackInfo = document.textContent.includes('Now Playing') || document.textContent.includes('Track:');
          
          return {
            hasNowPlayingBox,
            hasAlbumArt,
            hasTrackInfo,
            elementCount: overviewElements.length,
            pageText: document.body.textContent.substring(0, 500)
          };
        };
        
        const initialState = checkForData();
        
        setTimeout(() => {
          console.log = originalLog;
          
          const finalState = checkForData();
          
          const sseMessages = logs.filter(log => 
            log.message.includes('SSE') || 
            log.message.includes('Received SSE data') ||
            log.message.includes('spotify_state')
          );
          
          const spotifyMessages = logs.filter(log =>
            log.message.includes('Spotify') ||
            log.message.includes('playback') ||
            log.message.includes('track')
          );
          
          const pollingMessages = logs.filter(log =>
            log.message.includes('Polling tick') ||
            log.message.includes('Setting up polling') ||
            log.message.includes('force polling')
          );
          
          resolve({
            totalLogs: logs.length,
            sseMessages: sseMessages.length,
            spotifyMessages: spotifyMessages.length,
            pollingMessages: pollingMessages.length,
            initialState,
            finalState,
            recentLogs: logs.slice(-20).map(l => l.message),
            sseDetails: sseMessages.slice(-5).map(l => l.message),
            spotifyDetails: spotifyMessages.slice(-5).map(l => l.message)
          });
        }, 15000);
      });
    });

    console.log('📊 Data flow analysis:', dataFlow);

    // Step 5: Test direct API calls
    console.log('🔍 Step 5: Testing direct API calls');
    
    const apiTest = await page.evaluate(async () => {
      const token = localStorage.getItem('admin_token');
      
      try {
        // Test playback endpoint
        const playbackResponse = await fetch('/api/admin/playback/resume', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const playbackResult = await playbackResponse.json();
        console.log('🎵 Playback API test:', playbackResult);
        
        // Test stats endpoint
        const statsResponse = await fetch('/api/admin/stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const statsResult = await statsResponse.json();
        console.log('📊 Stats API test:', statsResult);
        
        return {
          playbackSuccess: playbackResponse.ok,
          playbackData: playbackResult,
          statsSuccess: statsResponse.ok,
          statsData: statsResult
        };
        
      } catch (error) {
        console.error('❌ API test error:', error);
        return {
          error: error.message
        };
      }
    });

    console.log('🔍 API test results:', apiTest);

    // Step 6: Check if SSE is causing issues
    console.log('🔍 Step 6: Testing SSE vs Polling behavior');
    
    // Disable force polling to test SSE
    await page.goto('http://localhost:3000/admin/settings');
    await page.waitForLoadState('networkidle');
    
    const checkbox = page.locator('#force_polling');
    await checkbox.uncheck();
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    console.log('🔄 Force polling disabled - testing SSE');
    
    await page.goto('http://localhost:3000/admin/overview');
    await page.waitForLoadState('networkidle');
    
    // Monitor SSE behavior
    const sseTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        const logs = [];
        const originalLog = console.log;
        
        console.log = (...args) => {
          const message = args.join(' ');
          logs.push(message);
          originalLog(...args);
        };
        
        setTimeout(() => {
          console.log = originalLog;
          
          const sseConnections = logs.filter(log => 
            log.includes('Connecting to SSE') ||
            log.includes('SSE connection established') ||
            log.includes('SSE connection closed') ||
            log.includes('SSE connection error')
          );
          
          const spotifyDisconnects = logs.filter(log =>
            log.includes('No Spotify state') ||
            log.includes('spotify_connected: false') ||
            log.includes('Spotify not connected')
          );
          
          resolve({
            sseConnections,
            spotifyDisconnects,
            allLogs: logs.slice(-15)
          });
        }, 10000);
      });
    });

    console.log('🔍 SSE test results:', sseTest);

    // Analysis
    console.log('\n🔬 ANALYSIS:');
    
    if (dataFlow.pollingMessages > 0) {
      console.log('✅ Polling is working');
    } else {
      console.log('❌ Polling not detected');
    }
    
    if (dataFlow.sseMessages > 0) {
      console.log('✅ SSE messages received');
    } else {
      console.log('❌ No SSE messages detected');
    }
    
    if (dataFlow.spotifyMessages > 0) {
      console.log('✅ Spotify data detected');
    } else {
      console.log('❌ No Spotify data detected');
    }
    
    if (dataFlow.finalState.hasNowPlayingBox) {
      console.log('✅ Now playing box rendered');
    } else {
      console.log('❌ Now playing box missing');
    }
    
    if (dataFlow.finalState.hasAlbumArt) {
      console.log('✅ Album art displayed');
    } else {
      console.log('❌ Album art missing');
    }

    console.log('\n✅ SSE and Spotify debug test completed');
  });

  test('Test Spotify API directly', async ({ page }) => {
    console.log('\n🎵 Testing Spotify API directly...\n');
    
    page.on('console', msg => console.log(`🖥️  ${msg.text()}`));

    // Login first
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');

    // Test Spotify API endpoints directly
    const spotifyApiTest = await page.evaluate(async () => {
      const token = localStorage.getItem('admin_token');
      
      console.log('🔑 Testing Spotify API with admin token:', !!token);
      
      try {
        // Test different Spotify endpoints
        const endpoints = [
          '/api/admin/stats',
          '/api/admin/playback/resume',
          '/api/admin/queue'
        ];
        
        const results = {};
        
        for (const endpoint of endpoints) {
          try {
            const method = endpoint.includes('resume') ? 'POST' : 'GET';
            const response = await fetch(endpoint, {
              method,
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            const data = await response.json();
            results[endpoint] = {
              success: response.ok,
              status: response.status,
              data: data
            };
            
            console.log(`🎵 ${endpoint}: ${response.status}`, data);
            
          } catch (error) {
            results[endpoint] = {
              success: false,
              error: error.message
            };
            console.error(`❌ ${endpoint} failed:`, error);
          }
        }
        
        return results;
        
      } catch (error) {
        console.error('❌ Spotify API test error:', error);
        return {
          error: error.message
        };
      }
    });

    console.log('🔍 Spotify API test results:', spotifyApiTest);

    console.log('\n✅ Spotify API test completed');
  });
});
