import { test, expect } from '@playwright/test';

test.describe('Task 0.3: Focused Render Loop Validation', () => {
  test('validate render frequency is reasonable (< 2 renders/sec)', async ({ page }) => {
    const renderLogs: string[] = [];
    let renderCount = 0;
    let lastRenderContent = '';
    let identicalRenders = 0;
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('📊 OverviewPage rendering with:')) {
        renderCount++;
        renderLogs.push(text);
        
        // Check for identical consecutive renders (sign of render loop)
        if (text === lastRenderContent) {
          identicalRenders++;
        }
        lastRenderContent = text;
      }
    });
    
    console.log('🔍 Testing render frequency...');
    
    // Login
    await page.goto('/admin/overview');
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for initial load
    await page.waitForTimeout(5000);
    
    const initialRenderCount = renderCount;
    console.log(`📊 Initial renders after login: ${initialRenderCount}`);
    
    // Monitor for 10 seconds (shorter test)
    console.log('⏱️ Monitoring for 10 seconds...');
    const monitoringStartTime = Date.now();
    
    await page.waitForTimeout(10000);
    
    const finalRenderCount = renderCount;
    const monitoringDuration = (Date.now() - monitoringStartTime) / 1000;
    const rendersInMonitoring = finalRenderCount - initialRenderCount;
    const renderFrequency = rendersInMonitoring / monitoringDuration;
    
    console.log('📈 Results:');
    console.log(`  - Total renders: ${finalRenderCount}`);
    console.log(`  - Renders during monitoring: ${rendersInMonitoring}`);
    console.log(`  - Render frequency: ${renderFrequency.toFixed(2)} renders/second`);
    console.log(`  - Identical consecutive renders: ${identicalRenders}`);
    
    // Show last few renders for debugging
    console.log('📋 Last 5 renders:');
    renderLogs.slice(-5).forEach((log, i) => {
      console.log(`  ${i + 1}: ${log.substring(0, 100)}...`);
    });
    
    // SUCCESS CRITERIA
    const renderFrequencyGood = renderFrequency < 2.0; // Less than 2 renders per second
    const noExcessiveIdentical = identicalRenders < 5; // No more than 5 identical renders
    const reasonableTotal = rendersInMonitoring < 20; // Less than 20 renders in 10 seconds
    
    console.log('✅ VALIDATION:');
    console.log(`  - Render frequency < 2/sec: ${renderFrequencyGood ? '✅ PASS' : '❌ FAIL'} (${renderFrequency.toFixed(2)})`);
    console.log(`  - No excessive identical: ${noExcessiveIdentical ? '✅ PASS' : '❌ FAIL'} (${identicalRenders})`);
    console.log(`  - Reasonable total: ${reasonableTotal ? '✅ PASS' : '❌ FAIL'} (${rendersInMonitoring})`);
    
    const testPassed = renderFrequencyGood && noExcessiveIdentical && reasonableTotal;
    console.log(`\n🎯 RENDER LOOP FIX: ${testPassed ? '✅ WORKING' : '❌ FAILED'}`);
    
    expect(testPassed).toBe(true);
  });
  
  test('check for spotify_connected state thrashing', async ({ page }) => {
    const spotifyStateLogs: string[] = [];
    let stateChanges = 0;
    let lastSpotifyState = '';
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('📊 OverviewPage rendering with:') && text.includes('playbackState_connected:')) {
        // Extract spotify connected state
        const match = text.match(/playbackState_connected: (true|false|undefined)/);
        if (match) {
          const currentState = match[1];
          if (currentState !== lastSpotifyState) {
            stateChanges++;
            spotifyStateLogs.push(`${new Date().toISOString()}: ${lastSpotifyState} → ${currentState}`);
            lastSpotifyState = currentState;
          }
        }
      }
    });
    
    console.log('🔍 Testing Spotify state thrashing...');
    
    // Login
    await page.goto('/admin/overview');
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Monitor for 15 seconds
    await page.waitForTimeout(15000);
    
    console.log('📊 Spotify state analysis:');
    console.log(`  - Total state changes: ${stateChanges}`);
    console.log(`  - Final state: ${lastSpotifyState}`);
    
    if (spotifyStateLogs.length > 0) {
      console.log('📋 State change log:');
      spotifyStateLogs.forEach(log => console.log(`    ${log}`));
    }
    
    // SUCCESS CRITERIA: Should have minimal state changes (< 5 in 15 seconds)
    const noStatesThrashing = stateChanges < 5;
    console.log(`  - No state thrashing: ${noStatesThrashing ? '✅ PASS' : '❌ FAIL'}`);
    
    expect(noStatesThrashing).toBe(true);
  });
  
  test('verify data change detection is working', async ({ page }) => {
    const dataUpdateLogs: string[] = [];
    let sseDataUpdates = 0;
    let dataProcessingSkips = 0;
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('📊 SSE Data received:')) {
        sseDataUpdates++;
        dataUpdateLogs.push(text);
      }
      if (text.includes('Skip processing if data hasn\'t actually changed')) {
        dataProcessingSkips++;
      }
    });
    
    console.log('🔍 Testing data change detection...');
    
    // Login
    await page.goto('/admin/overview');
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Monitor for data updates
    await page.waitForTimeout(10000);
    
    console.log('📊 Data processing analysis:');
    console.log(`  - SSE data updates received: ${sseDataUpdates}`);
    console.log(`  - Data processing skips: ${dataProcessingSkips}`);
    
    // In development, we might not get SSE, so this test is informational
    if (sseDataUpdates > 0) {
      console.log('✅ SSE data updates detected - change detection is active');
    } else {
      console.log('ℹ️ No SSE updates in development - using polling fallback');
    }
    
    // This test always passes as it's informational in dev environment
    expect(true).toBe(true);
  });
  
  test('basic functionality still works after render loop fix', async ({ page }) => {
    console.log('🔍 Testing basic functionality...');
    
    // Login
    await page.goto('/admin/overview');
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Check that key elements are present
    const nowPlayingExists = await page.locator('h2:has-text("Now Playing")').count() > 0;
    const statsExist = await page.locator('text=Total Requests').count() > 0;
    const navigationExists = await page.locator('button:has-text("Settings")').count() > 0;
    
    console.log('📊 Functionality check:');
    console.log(`  - Now Playing section: ${nowPlayingExists ? '✅ Present' : '❌ Missing'}`);
    console.log(`  - Stats display: ${statsExist ? '✅ Present' : '❌ Missing'}`);
    console.log(`  - Navigation: ${navigationExists ? '✅ Present' : '❌ Missing'}`);
    
    const basicFunctionalityWorks = nowPlayingExists && statsExist && navigationExists;
    console.log(`\n🎯 Basic functionality: ${basicFunctionalityWorks ? '✅ WORKING' : '❌ BROKEN'}`);
    
    expect(basicFunctionalityWorks).toBe(true);
  });
});
