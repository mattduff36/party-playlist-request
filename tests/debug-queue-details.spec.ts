import { test, expect } from '@playwright/test';

test.describe('Debug Queue Details Endpoint', () => {
  test('Test queue details endpoint directly', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`🖥️  BROWSER: ${msg.type()}: ${msg.text()}`);
    });

    console.log('\n🔍 Testing queue details endpoint...\n');

    // Step 1: Login to admin
    console.log('🔐 Step 1: Admin login');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    console.log('✅ Admin login successful');

    // Step 2: Test queue details endpoint directly
    console.log('🔍 Step 2: Testing queue details endpoint');
    
    const queueDetailsTest = await page.evaluate(async () => {
      const token = localStorage.getItem('admin_token');
      
      console.log('🔑 Testing queue details with admin token:', !!token);
      
      try {
        const response = await fetch('/api/admin/queue/details', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        console.log('📊 Queue details response:', data);
        
        return {
          success: response.ok,
          status: response.status,
          data: data,
          hasCurrentTrack: !!data.current_track,
          hasQueue: !!data.queue,
          spotifyConnected: data.spotify_connected,
          currentTrackName: data.current_track?.name,
          currentTrackImage: data.current_track?.image_url,
          queueLength: data.queue?.length || 0
        };
        
      } catch (error) {
        console.error('❌ Queue details test error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });

    console.log('🔍 Queue Details Test Results:');
    console.log('Success:', queueDetailsTest.success);
    console.log('Status:', queueDetailsTest.status);
    console.log('Spotify Connected:', queueDetailsTest.spotifyConnected);
    console.log('Has Current Track:', queueDetailsTest.hasCurrentTrack);
    console.log('Current Track Name:', queueDetailsTest.currentTrackName);
    console.log('Current Track Image:', queueDetailsTest.currentTrackImage);
    console.log('Has Queue:', queueDetailsTest.hasQueue);
    console.log('Queue Length:', queueDetailsTest.queueLength);

    if (queueDetailsTest.success) {
      if (queueDetailsTest.spotifyConnected && queueDetailsTest.hasCurrentTrack) {
        console.log('✅ SUCCESS: Queue details endpoint returns track data');
      } else {
        console.log('❌ ISSUE: Queue details endpoint not returning expected data');
        console.log('Full response:', queueDetailsTest.data);
      }
    } else {
      console.log('❌ FAILED: Queue details endpoint failed');
      console.log('Error:', queueDetailsTest.error);
    }

    console.log('\n✅ Queue details test completed');
  });
});
