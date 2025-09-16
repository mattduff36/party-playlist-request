import { test, expect } from '@playwright/test';

test.describe('Comprehensive System Testing', () => {
  
  test('Phase 1: Performance and API Call Analysis', async ({ page }) => {
    console.log('\n🔍 PHASE 1: PERFORMANCE AND API CALL ANALYSIS\n');
    
    // Track all network requests
    const networkRequests = [];
    const apiCallCounts = {};
    
    page.on('request', request => {
      const url = request.url();
      networkRequests.push({
        url,
        method: request.method(),
        timestamp: Date.now()
      });
      
      // Count API calls
      if (url.includes('/api/')) {
        const endpoint = url.split('/api/')[1].split('?')[0];
        apiCallCounts[endpoint] = (apiCallCounts[endpoint] || 0) + 1;
      }
    });

    // Enable console logging
    const consoleLogs = [];
    page.on('console', msg => {
      const message = `${msg.type()}: ${msg.text()}`;
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      });
      console.log(`🖥️  ${message}`);
    });

    console.log('🔐 Step 1: Admin Login and Initial Load');
    const startTime = Date.now();
    
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    const loginTime = Date.now() - startTime;
    console.log(`✅ Login completed in ${loginTime}ms`);

    console.log('📊 Step 2: Monitor API Calls for 30 seconds');
    const monitorStart = Date.now();
    
    // Wait and monitor for 30 seconds
    await page.waitForTimeout(30000);
    
    const monitorEnd = Date.now();
    const monitorDuration = monitorEnd - monitorStart;
    
    console.log('\n📈 PERFORMANCE ANALYSIS RESULTS:');
    console.log(`Monitor Duration: ${monitorDuration}ms`);
    console.log(`Total Network Requests: ${networkRequests.length}`);
    console.log(`Total Console Logs: ${consoleLogs.length}`);
    
    console.log('\n🔍 API CALL FREQUENCY:');
    Object.entries(apiCallCounts).forEach(([endpoint, count]) => {
      const callsPerSecond = (count / (monitorDuration / 1000)).toFixed(2);
      console.log(`  ${endpoint}: ${count} calls (${callsPerSecond}/sec)`);
      
      // Flag excessive API calls
      if (count > 10) {
        console.log(`  ⚠️  WARNING: ${endpoint} called ${count} times in 30 seconds!`);
      }
    });
    
    console.log('\n🔍 CONSOLE LOG ANALYSIS:');
    const logTypes = {};
    consoleLogs.forEach(log => {
      logTypes[log.type] = (logTypes[log.type] || 0) + 1;
    });
    
    Object.entries(logTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} messages`);
    });
    
    // Check for specific issues
    const renderLogs = consoleLogs.filter(log => 
      log.text.includes('OverviewPage rendering') || 
      log.text.includes('rendering with')
    );
    
    const sseConnectionLogs = consoleLogs.filter(log =>
      log.text.includes('SSE connection') ||
      log.text.includes('Connecting to SSE')
    );
    
    const pollingLogs = consoleLogs.filter(log =>
      log.text.includes('Polling tick') ||
      log.text.includes('Setting up polling')
    );
    
    console.log('\n🔍 SPECIFIC ISSUE DETECTION:');
    console.log(`  Component Re-renders: ${renderLogs.length}`);
    console.log(`  SSE Connection Events: ${sseConnectionLogs.length}`);
    console.log(`  Polling Events: ${pollingLogs.length}`);
    
    // Flag potential issues
    if (renderLogs.length > 50) {
      console.log(`  ⚠️  EXCESSIVE RE-RENDERS: ${renderLogs.length} renders in 30 seconds!`);
    }
    
    if (sseConnectionLogs.length > 5) {
      console.log(`  ⚠️  SSE CONNECTION ISSUES: ${sseConnectionLogs.length} connection events!`);
    }
    
    if (pollingLogs.length > 10) {
      console.log(`  ⚠️  EXCESSIVE POLLING: ${pollingLogs.length} polling events!`);
    }
    
    // Check for both SSE and polling active
    const hasSSE = sseConnectionLogs.length > 0;
    const hasPolling = pollingLogs.length > 0;
    
    if (hasSSE && hasPolling) {
      console.log(`  ⚠️  CONFLICT: Both SSE and polling are active simultaneously!`);
    }
    
    console.log('\n✅ Phase 1 Performance Analysis Complete');
  });

  test('Phase 2: Functional Flow Testing', async ({ page }) => {
    console.log('\n🔍 PHASE 2: FUNCTIONAL FLOW TESTING\n');
    
    page.on('console', msg => console.log(`🖥️  ${msg.text()}`));
    
    console.log('🔐 Step 1: Admin Authentication');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    console.log('✅ Admin login successful');
    
    console.log('📊 Step 2: Overview Page Functionality');
    
    // Check if overview page loads correctly
    const overviewTitle = await page.textContent('h1');
    console.log(`Overview title: ${overviewTitle}`);
    
    // Check stats display
    const statsElements = await page.locator('.bg-gray-800').count();
    console.log(`Stats sections found: ${statsElements}`);
    
    // Check now playing section
    const nowPlayingSection = page.locator('text=Now Playing').first();
    const nowPlayingExists = await nowPlayingSection.count() > 0;
    console.log(`Now Playing section exists: ${nowPlayingExists}`);
    
    if (nowPlayingExists) {
      const trackName = await page.locator('h3').first().textContent();
      console.log(`Current track: ${trackName}`);
    }
    
    console.log('🎵 Step 3: Spotify Integration Test');
    
    // Navigate to Spotify setup
    await page.click('text=🎵 Spotify Setup');
    await page.waitForURL('**/admin/spotify-setup');
    console.log('✅ Navigated to Spotify setup');
    
    // Check connection status
    const connectionStatus = await page.textContent('.bg-gray-800');
    console.log(`Spotify connection status: ${connectionStatus}`);
    
    console.log('📋 Step 4: Requests Management');
    
    // Navigate to requests
    await page.click('text=📋 Song Requests');
    await page.waitForURL('**/admin/requests');
    console.log('✅ Navigated to requests page');
    
    // Check if requests load
    const requestsCount = await page.locator('[data-testid="request-item"], .bg-gray-800').count();
    console.log(`Requests found: ${requestsCount}`);
    
    console.log('⚙️ Step 5: Settings Configuration');
    
    // Navigate to settings
    await page.click('text=⚙️ Settings');
    await page.waitForURL('**/admin/settings');
    console.log('✅ Navigated to settings page');
    
    // Check force polling setting
    const forcePollingCheckbox = page.locator('#force_polling');
    const isForcePollingChecked = await forcePollingCheckbox.isChecked();
    console.log(`Force polling enabled: ${isForcePollingChecked}`);
    
    console.log('📺 Step 6: Display Screen Test');
    
    // Open display screen in new tab
    const displayPage = await page.context().newPage();
    await displayPage.goto('http://localhost:3000/display');
    await displayPage.waitForLoadState('networkidle');
    console.log('✅ Display screen loaded');
    
    // Check display content
    const displayContent = await displayPage.textContent('body');
    const hasNowPlaying = displayContent.includes('Now Playing') || displayContent.includes('Mock Song');
    console.log(`Display shows now playing: ${hasNowPlaying}`);
    
    await displayPage.close();
    
    console.log('🌐 Step 7: Public Request Form');
    
    // Test public request form
    const publicPage = await page.context().newPage();
    await publicPage.goto('http://localhost:3000');
    await publicPage.waitForLoadState('networkidle');
    console.log('✅ Public request form loaded');
    
    // Check if search works
    const searchInput = publicPage.locator('input[type="text"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('test song');
      console.log('✅ Search input functional');
    }
    
    await publicPage.close();
    
    console.log('\n✅ Phase 2 Functional Testing Complete');
  });

  test('Phase 3: Real-time Updates Testing', async ({ page }) => {
    console.log('\n🔍 PHASE 3: REAL-TIME UPDATES TESTING\n');
    
    const updateEvents = [];
    
    page.on('console', msg => {
      const text = msg.text();
      console.log(`🖥️  ${text}`);
      
      // Track update-related events
      if (text.includes('SSE') || text.includes('polling') || text.includes('update')) {
        updateEvents.push({
          message: text,
          timestamp: Date.now()
        });
      }
    });
    
    console.log('🔐 Step 1: Setup and Login');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    console.log('📡 Step 2: Monitor Real-time Updates');
    
    // Monitor for 20 seconds
    const monitorStart = Date.now();
    await page.waitForTimeout(20000);
    const monitorEnd = Date.now();
    
    console.log('\n📊 REAL-TIME UPDATE ANALYSIS:');
    console.log(`Total update events: ${updateEvents.length}`);
    
    // Analyze update patterns
    const sseEvents = updateEvents.filter(e => e.message.includes('SSE'));
    const pollingEvents = updateEvents.filter(e => e.message.includes('polling'));
    const connectionEvents = updateEvents.filter(e => 
      e.message.includes('connection') || e.message.includes('connected')
    );
    
    console.log(`SSE events: ${sseEvents.length}`);
    console.log(`Polling events: ${pollingEvents.length}`);
    console.log(`Connection events: ${connectionEvents.length}`);
    
    // Check for issues
    if (sseEvents.length > 0 && pollingEvents.length > 0) {
      console.log('⚠️  ISSUE: Both SSE and polling are active');
    }
    
    if (connectionEvents.length > 5) {
      console.log(`⚠️  ISSUE: Too many connection events (${connectionEvents.length})`);
    }
    
    console.log('🔄 Step 3: Test Connection Switching');
    
    // Navigate to settings and toggle force polling
    await page.click('text=⚙️ Settings');
    await page.waitForURL('**/admin/settings');
    
    const forcePollingCheckbox = page.locator('#force_polling');
    const wasChecked = await forcePollingCheckbox.isChecked();
    
    // Toggle the setting
    if (wasChecked) {
      await forcePollingCheckbox.uncheck();
      console.log('🔄 Disabled force polling');
    } else {
      await forcePollingCheckbox.check();
      console.log('🔄 Enabled force polling');
    }
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Go back to overview and monitor changes
    await page.click('text=📊 Overview');
    await page.waitForURL('**/admin/overview');
    
    const switchMonitorStart = Date.now();
    await page.waitForTimeout(10000);
    
    const postSwitchEvents = updateEvents.filter(e => e.timestamp > switchMonitorStart);
    console.log(`Events after toggle: ${postSwitchEvents.length}`);
    
    console.log('\n✅ Phase 3 Real-time Updates Testing Complete');
  });

  test('Phase 4: Error Handling and Edge Cases', async ({ page }) => {
    console.log('\n🔍 PHASE 4: ERROR HANDLING AND EDGE CASES\n');
    
    const errors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log(`❌ ERROR: ${msg.text()}`);
      } else {
        console.log(`🖥️  ${msg.text()}`);
      }
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log(`❌ PAGE ERROR: ${error.message}`);
    });
    
    console.log('🔐 Step 1: Login and Setup');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    console.log('🌐 Step 2: Test Network Interruption Simulation');
    
    // Simulate network issues by intercepting requests
    await page.route('**/api/admin/**', route => {
      // Randomly fail some requests to test error handling
      if (Math.random() < 0.1) { // 10% failure rate
        route.abort();
      } else {
        route.continue();
      }
    });
    
    // Monitor for 15 seconds with simulated network issues
    await page.waitForTimeout(15000);
    
    console.log('🔄 Step 3: Test Rapid Navigation');
    
    // Rapidly navigate between pages to test state management
    for (let i = 0; i < 5; i++) {
      await page.click('text=📋 Song Requests');
      await page.waitForTimeout(500);
      await page.click('text=📊 Overview');
      await page.waitForTimeout(500);
      await page.click('text=⚙️ Settings');
      await page.waitForTimeout(500);
    }
    
    console.log('📱 Step 4: Test Responsive Design');
    
    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 667, name: 'Mobile' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1920, height: 1080, name: 'Desktop' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000);
      console.log(`✅ Tested ${viewport.name} viewport (${viewport.width}x${viewport.height})`);
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    console.log('\n📊 ERROR ANALYSIS:');
    console.log(`Total errors detected: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('❌ ERRORS FOUND:');
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log('✅ No errors detected during testing');
    }
    
    console.log('\n✅ Phase 4 Error Handling Testing Complete');
  });

  test('Phase 5: Performance Benchmarking', async ({ page }) => {
    console.log('\n🔍 PHASE 5: PERFORMANCE BENCHMARKING\n');
    
    const performanceMetrics = {
      pageLoadTime: 0,
      apiCallCount: 0,
      memoryUsage: 0,
      renderCount: 0
    };
    
    let renderCount = 0;
    
    page.on('console', msg => {
      if (msg.text().includes('rendering with')) {
        renderCount++;
      }
    });
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        performanceMetrics.apiCallCount++;
      }
    });
    
    console.log('⏱️ Step 1: Page Load Performance');
    
    const loadStart = Date.now();
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    await page.waitForLoadState('networkidle');
    
    performanceMetrics.pageLoadTime = Date.now() - loadStart;
    console.log(`Page load time: ${performanceMetrics.pageLoadTime}ms`);
    
    console.log('📊 Step 2: Runtime Performance Monitoring');
    
    const monitorStart = Date.now();
    const initialApiCount = performanceMetrics.apiCallCount;
    const initialRenderCount = renderCount;
    
    // Monitor for 30 seconds
    await page.waitForTimeout(30000);
    
    const monitorDuration = Date.now() - monitorStart;
    const apiCallsDuringMonitor = performanceMetrics.apiCallCount - initialApiCount;
    const rendersDuringMonitor = renderCount - initialRenderCount;
    
    console.log('\n📈 PERFORMANCE METRICS:');
    console.log(`Monitor Duration: ${monitorDuration}ms`);
    console.log(`API Calls: ${apiCallsDuringMonitor} (${(apiCallsDuringMonitor / (monitorDuration / 1000)).toFixed(2)}/sec)`);
    console.log(`Component Renders: ${rendersDuringMonitor} (${(rendersDuringMonitor / (monitorDuration / 1000)).toFixed(2)}/sec)`);
    
    // Performance thresholds
    const apiCallsPerSecond = apiCallsDuringMonitor / (monitorDuration / 1000);
    const rendersPerSecond = rendersDuringMonitor / (monitorDuration / 1000);
    
    console.log('\n🎯 PERFORMANCE EVALUATION:');
    
    if (performanceMetrics.pageLoadTime > 5000) {
      console.log('❌ SLOW: Page load time exceeds 5 seconds');
    } else if (performanceMetrics.pageLoadTime > 2000) {
      console.log('⚠️  MODERATE: Page load time exceeds 2 seconds');
    } else {
      console.log('✅ GOOD: Page load time under 2 seconds');
    }
    
    if (apiCallsPerSecond > 2) {
      console.log('❌ EXCESSIVE: API calls exceed 2 per second');
    } else if (apiCallsPerSecond > 1) {
      console.log('⚠️  HIGH: API calls exceed 1 per second');
    } else {
      console.log('✅ OPTIMAL: API call frequency is reasonable');
    }
    
    if (rendersPerSecond > 5) {
      console.log('❌ EXCESSIVE: Component renders exceed 5 per second');
    } else if (rendersPerSecond > 2) {
      console.log('⚠️  HIGH: Component renders exceed 2 per second');
    } else {
      console.log('✅ OPTIMAL: Component render frequency is reasonable');
    }
    
    console.log('\n✅ Phase 5 Performance Benchmarking Complete');
  });
});
