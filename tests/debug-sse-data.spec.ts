import { test, expect } from '@playwright/test';

test.describe('Debug SSE Data Flow', () => {
  test('Check what SSE endpoint actually sends', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`🖥️  BROWSER: ${msg.type()}: ${msg.text()}`);
    });

    console.log('\n🔍 Testing SSE data content...\n');

    // Step 1: Login to admin
    console.log('🔐 Step 1: Admin login');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    console.log('✅ Admin login successful');

    // Step 2: Enable force polling to ensure we get data
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

    // Step 3: Go to overview and capture SSE data
    console.log('📊 Step 3: Monitor SSE data on overview page');
    await page.goto('http://localhost:3000/admin/overview');
    await page.waitForLoadState('networkidle');

    // Step 4: Capture SSE data for analysis
    console.log('📡 Step 4: Capturing SSE data...');
    
    const sseDataCapture = await page.evaluate(() => {
      return new Promise((resolve) => {
        const logs = [];
        const originalLog = console.log;
        let capturedSSEData = null;
        let capturedPlaybackState = null;
        
        console.log = (...args) => {
          const message = args.join(' ');
          logs.push({
            timestamp: Date.now(),
            message: message
          });
          
          // Capture SSE data
          if (message.includes('📡 Received SSE data update') || message.includes('SSE Data received:')) {
            console.log('🎯 Found SSE data message!');
          }
          
          // Capture playback state updates
          if (message.includes('🎵 Updating playback state:')) {
            console.log('🎯 Found playback state update!');
          }
          
          originalLog(...args);
        };
        
        // Wait for data to flow
        setTimeout(() => {
          console.log = originalLog;
          
          const sseMessages = logs.filter(log => 
            log.message.includes('SSE') || 
            log.message.includes('Received SSE data') ||
            log.message.includes('spotify_state') ||
            log.message.includes('playback state')
          );
          
          const spotifyMessages = logs.filter(log =>
            log.message.includes('Spotify') ||
            log.message.includes('🎵') ||
            log.message.includes('track') ||
            log.message.includes('album')
          );
          
          resolve({
            totalLogs: logs.length,
            sseMessages: sseMessages.map(l => l.message),
            spotifyMessages: spotifyMessages.map(l => l.message),
            allRecentLogs: logs.slice(-30).map(l => l.message)
          });
        }, 20000); // Wait 20 seconds for data
      });
    });

    console.log('📊 SSE Data Capture Results:');
    console.log('Total logs:', sseDataCapture.totalLogs);
    console.log('SSE messages:', sseDataCapture.sseMessages.length);
    console.log('Spotify messages:', sseDataCapture.spotifyMessages.length);
    
    console.log('\n🔍 SSE Messages:');
    sseDataCapture.sseMessages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg}`);
    });
    
    console.log('\n🎵 Spotify Messages:');
    sseDataCapture.spotifyMessages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg}`);
    });
    
    console.log('\n📝 Recent Logs:');
    sseDataCapture.allRecentLogs.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg}`);
    });

    // Step 5: Check the actual component state
    console.log('\n🔍 Step 5: Checking component state...');
    
    const componentState = await page.evaluate(() => {
      // Try to find elements that would show track info
      const nowPlayingSection = document.querySelector('.bg-gray-800');
      const trackNameElement = document.querySelector('h3');
      const albumArtElement = document.querySelector('img[src*="placeholder"], img[src*="spotify"]');
      const connectSpotifyButton = document.querySelector('a[href*="spotify"]');
      
      return {
        hasNowPlayingSection: !!nowPlayingSection,
        nowPlayingSectionText: nowPlayingSection?.textContent?.substring(0, 200) || 'Not found',
        hasTrackNameElement: !!trackNameElement,
        trackNameText: trackNameElement?.textContent || 'Not found',
        hasAlbumArt: !!albumArtElement,
        albumArtSrc: albumArtElement?.src || 'Not found',
        hasConnectButton: !!connectSpotifyButton,
        pageTitle: document.title,
        bodyText: document.body.textContent.substring(0, 500)
      };
    });

    console.log('🔍 Component State Analysis:');
    console.log('Has Now Playing Section:', componentState.hasNowPlayingSection);
    console.log('Now Playing Text:', componentState.nowPlayingSectionText);
    console.log('Has Track Name Element:', componentState.hasTrackNameElement);
    console.log('Track Name Text:', componentState.trackNameText);
    console.log('Has Album Art:', componentState.hasAlbumArt);
    console.log('Album Art Src:', componentState.albumArtSrc);
    console.log('Has Connect Button:', componentState.hasConnectButton);

    console.log('\n✅ SSE data flow debug completed');
  });
});
