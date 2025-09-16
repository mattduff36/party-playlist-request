import { test, expect } from '@playwright/test';

test.describe('Critical Issues Analysis', () => {
  
  test('Issue 1: Endless API Calls Investigation', async ({ page }) => {
    console.log('\n🚨 CRITICAL ISSUE 1: ENDLESS API CALLS INVESTIGATION\n');
    
    const apiCalls = [];
    const renderCounts = {};
    
    // Track all API calls
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        const endpoint = request.url().split('/api/')[1].split('?')[0];
        apiCalls.push({
          endpoint,
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });
    
    // Track component renders
    page.on('console', msg => {
      const text = msg.text();
      
      if (text.includes('OverviewPage rendering')) {
        renderCounts.overview = (renderCounts.overview || 0) + 1;
      }
      
      if (text.includes('SSE connection') || text.includes('Connecting to SSE')) {
        console.log(`🔗 SSE EVENT: ${text}`);
      }
      
      if (text.includes('polling') || text.includes('Polling tick')) {
        console.log(`🔄 POLLING EVENT: ${text}`);
      }
      
      if (text.includes('Setting up polling interval')) {
        console.log(`⚙️  POLLING SETUP: ${text}`);
      }
      
      if (text.includes('Force polling')) {
        console.log(`🔧 FORCE POLLING: ${text}`);
      }
    });
    
    console.log('🔐 Step 1: Login (monitoring API calls)');
    const loginStart = Date.now();
    
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    const loginEnd = Date.now();
    const loginDuration = loginEnd - loginStart;
    const loginApiCalls = apiCalls.length;
    
    console.log(`✅ Login completed in ${loginDuration}ms with ${loginApiCalls} API calls`);
    
    console.log('📊 Step 2: Monitor for 10 seconds (short duration to avoid timeout)');
    const monitorStart = Date.now();
    const initialApiCount = apiCalls.length;
    const initialRenderCount = renderCounts.overview || 0;
    
    // Monitor for just 10 seconds to avoid timeout
    await page.waitForTimeout(10000);
    
    const monitorEnd = Date.now();
    const monitorDuration = monitorEnd - monitorStart;
    const apiCallsDuringMonitor = apiCalls.length - initialApiCount;
    const rendersDuringMonitor = (renderCounts.overview || 0) - initialRenderCount;
    
    console.log('\n🔍 CRITICAL FINDINGS:');
    console.log(`Monitor Duration: ${monitorDuration}ms`);
    console.log(`API Calls During Monitor: ${apiCallsDuringMonitor}`);
    console.log(`Component Renders During Monitor: ${rendersDuringMonitor}`);
    console.log(`API Calls Per Second: ${(apiCallsDuringMonitor / (monitorDuration / 1000)).toFixed(2)}`);
    console.log(`Renders Per Second: ${(rendersDuringMonitor / (monitorDuration / 1000)).toFixed(2)}`);
    
    // Analyze API call patterns
    const endpointCounts = {};
    apiCalls.slice(initialApiCount).forEach(call => {
      endpointCounts[call.endpoint] = (endpointCounts[call.endpoint] || 0) + 1;
    });
    
    console.log('\n📈 API CALL BREAKDOWN:');
    Object.entries(endpointCounts).forEach(([endpoint, count]) => {
      const callsPerSecond = (count / (monitorDuration / 1000)).toFixed(2);
      console.log(`  ${endpoint}: ${count} calls (${callsPerSecond}/sec)`);
      
      if (count > 5) {
        console.log(`    ⚠️  EXCESSIVE: ${endpoint} called ${count} times in 10 seconds!`);
      }
    });
    
    // Check for specific patterns
    const recentCalls = apiCalls.slice(-20); // Last 20 calls
    console.log('\n🔍 RECENT API CALLS PATTERN:');
    recentCalls.forEach((call, index) => {
      console.log(`  ${index + 1}. ${call.endpoint} (${call.method})`);
    });
    
    console.log('\n✅ Issue 1 Analysis Complete');
  });

  test('Issue 2: SSE vs Polling Conflict Detection', async ({ page }) => {
    console.log('\n🚨 CRITICAL ISSUE 2: SSE VS POLLING CONFLICT\n');
    
    const connectionEvents = [];
    
    page.on('console', msg => {
      const text = msg.text();
      
      // Track all connection-related events
      if (text.includes('SSE') || text.includes('polling') || text.includes('connection')) {
        connectionEvents.push({
          message: text,
          timestamp: Date.now(),
          type: text.includes('SSE') ? 'SSE' : text.includes('polling') ? 'POLLING' : 'CONNECTION'
        });
        console.log(`📡 ${text}`);
      }
    });
    
    console.log('🔐 Step 1: Login and initial setup');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    console.log('📊 Step 2: Monitor connection behavior for 8 seconds');
    await page.waitForTimeout(8000);
    
    console.log('\n🔍 CONNECTION EVENT ANALYSIS:');
    console.log(`Total connection events: ${connectionEvents.length}`);
    
    const sseEvents = connectionEvents.filter(e => e.type === 'SSE');
    const pollingEvents = connectionEvents.filter(e => e.type === 'POLLING');
    const connectionGeneral = connectionEvents.filter(e => e.type === 'CONNECTION');
    
    console.log(`SSE events: ${sseEvents.length}`);
    console.log(`Polling events: ${pollingEvents.length}`);
    console.log(`General connection events: ${connectionGeneral.length}`);
    
    // Check for conflicts
    const hasSSEActive = sseEvents.some(e => e.message.includes('established') || e.message.includes('connected'));
    const hasPollingActive = pollingEvents.some(e => e.message.includes('Setting up polling') || e.message.includes('Polling tick'));
    
    console.log('\n🔍 CONFLICT DETECTION:');
    console.log(`SSE Active: ${hasSSEActive}`);
    console.log(`Polling Active: ${hasPollingActive}`);
    
    if (hasSSEActive && hasPollingActive) {
      console.log('🚨 CRITICAL CONFLICT: Both SSE and Polling are active simultaneously!');
      
      // Show the sequence of events
      console.log('\n📋 EVENT SEQUENCE:');
      connectionEvents.forEach((event, index) => {
        console.log(`  ${index + 1}. [${event.type}] ${event.message}`);
      });
    } else {
      console.log('✅ No simultaneous SSE/Polling conflict detected');
    }
    
    console.log('\n✅ Issue 2 Analysis Complete');
  });

  test('Issue 3: Component Re-render Loop Detection', async ({ page }) => {
    console.log('\n🚨 CRITICAL ISSUE 3: COMPONENT RE-RENDER LOOPS\n');
    
    const renderEvents = [];
    const stateChanges = [];
    
    page.on('console', msg => {
      const text = msg.text();
      
      if (text.includes('rendering with')) {
        renderEvents.push({
          message: text,
          timestamp: Date.now()
        });
      }
      
      if (text.includes('Updating') || text.includes('state')) {
        stateChanges.push({
          message: text,
          timestamp: Date.now()
        });
      }
    });
    
    console.log('🔐 Step 1: Login');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    console.log('📊 Step 2: Monitor renders for 8 seconds');
    const monitorStart = Date.now();
    await page.waitForTimeout(8000);
    const monitorEnd = Date.now();
    
    const monitorDuration = monitorEnd - monitorStart;
    const rendersPerSecond = (renderEvents.length / (monitorDuration / 1000)).toFixed(2);
    
    console.log('\n🔍 RENDER ANALYSIS:');
    console.log(`Total renders: ${renderEvents.length}`);
    console.log(`Renders per second: ${rendersPerSecond}`);
    console.log(`State changes: ${stateChanges.length}`);
    
    if (renderEvents.length > 20) {
      console.log('🚨 EXCESSIVE RENDERS DETECTED!');
      
      // Show recent render events
      console.log('\n📋 RECENT RENDER EVENTS:');
      renderEvents.slice(-10).forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.message}`);
      });
      
      // Check for identical consecutive renders (render loops)
      let consecutiveIdentical = 0;
      let maxConsecutive = 0;
      
      for (let i = 1; i < renderEvents.length; i++) {
        if (renderEvents[i].message === renderEvents[i-1].message) {
          consecutiveIdentical++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveIdentical);
        } else {
          consecutiveIdentical = 0;
        }
      }
      
      if (maxConsecutive > 3) {
        console.log(`🚨 RENDER LOOP DETECTED: ${maxConsecutive} consecutive identical renders!`);
      }
    } else {
      console.log('✅ Render frequency is within acceptable limits');
    }
    
    console.log('\n✅ Issue 3 Analysis Complete');
  });

  test('Issue 4: Memory Leak and Performance Degradation', async ({ page }) => {
    console.log('\n🚨 CRITICAL ISSUE 4: MEMORY LEAK DETECTION\n');
    
    const performanceMetrics = [];
    
    console.log('🔐 Step 1: Initial setup');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    console.log('📊 Step 2: Performance monitoring over time');
    
    // Take performance measurements at intervals
    for (let i = 0; i < 5; i++) {
      const metrics = await page.evaluate(() => {
        return {
          timestamp: Date.now(),
          memory: (performance as any).memory ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
          } : null,
          timing: performance.timing ? {
            loadEventEnd: performance.timing.loadEventEnd,
            navigationStart: performance.timing.navigationStart
          } : null
        };
      });
      
      performanceMetrics.push(metrics);
      console.log(`📈 Measurement ${i + 1}: Memory used: ${metrics.memory ? Math.round(metrics.memory.usedJSHeapSize / 1024 / 1024) : 'N/A'}MB`);
      
      // Wait 2 seconds between measurements
      await page.waitForTimeout(2000);
    }
    
    console.log('\n🔍 MEMORY ANALYSIS:');
    
    if (performanceMetrics[0].memory && performanceMetrics[4].memory) {
      const initialMemory = performanceMetrics[0].memory.usedJSHeapSize;
      const finalMemory = performanceMetrics[4].memory.usedJSHeapSize;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePercent = ((memoryIncrease / initialMemory) * 100).toFixed(2);
      
      console.log(`Initial memory: ${Math.round(initialMemory / 1024 / 1024)}MB`);
      console.log(`Final memory: ${Math.round(finalMemory / 1024 / 1024)}MB`);
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${memoryIncreasePercent}%)`);
      
      if (memoryIncrease > 5 * 1024 * 1024) { // 5MB increase
        console.log('🚨 POTENTIAL MEMORY LEAK: Significant memory increase detected!');
      } else {
        console.log('✅ Memory usage appears stable');
      }
    } else {
      console.log('⚠️  Memory metrics not available in this browser');
    }
    
    console.log('\n✅ Issue 4 Analysis Complete');
  });

  test('Issue 5: Navigation and UI Responsiveness', async ({ page }) => {
    console.log('\n🚨 CRITICAL ISSUE 5: NAVIGATION RESPONSIVENESS\n');
    
    const navigationTimes = [];
    
    console.log('🔐 Step 1: Login');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    console.log('🧭 Step 2: Test navigation responsiveness');
    
    // Test navigation to different pages
    const pages = [
      { name: 'Settings', selector: 'text=⚙️ Settings', url: '**/admin/settings' },
      { name: 'Overview', selector: 'text=📊 Overview', url: '**/admin/overview' },
      { name: 'Requests', selector: 'text=📋 Song Requests', url: '**/admin/requests' },
      { name: 'Spotify', selector: 'text=🎵 Spotify Setup', url: '**/admin/spotify-setup' }
    ];
    
    for (const pageInfo of pages) {
      try {
        const startTime = Date.now();
        
        // Try to click the navigation link with a shorter timeout
        await page.click(pageInfo.selector, { timeout: 5000 });
        await page.waitForURL(pageInfo.url, { timeout: 5000 });
        
        const navigationTime = Date.now() - startTime;
        navigationTimes.push({
          page: pageInfo.name,
          time: navigationTime,
          success: true
        });
        
        console.log(`✅ ${pageInfo.name}: ${navigationTime}ms`);
        
      } catch (error) {
        navigationTimes.push({
          page: pageInfo.name,
          time: 5000, // timeout time
          success: false,
          error: error.message
        });
        
        console.log(`❌ ${pageInfo.name}: Failed (${error.message})`);
      }
      
      // Small delay between navigations
      await page.waitForTimeout(500);
    }
    
    console.log('\n🔍 NAVIGATION ANALYSIS:');
    const successfulNavigations = navigationTimes.filter(n => n.success);
    const failedNavigations = navigationTimes.filter(n => !n.success);
    
    console.log(`Successful navigations: ${successfulNavigations.length}/${navigationTimes.length}`);
    console.log(`Failed navigations: ${failedNavigations.length}`);
    
    if (successfulNavigations.length > 0) {
      const avgTime = successfulNavigations.reduce((sum, n) => sum + n.time, 0) / successfulNavigations.length;
      console.log(`Average navigation time: ${Math.round(avgTime)}ms`);
      
      if (avgTime > 2000) {
        console.log('🚨 SLOW NAVIGATION: Average time exceeds 2 seconds!');
      } else {
        console.log('✅ Navigation times are acceptable');
      }
    }
    
    if (failedNavigations.length > 0) {
      console.log('🚨 NAVIGATION FAILURES:');
      failedNavigations.forEach(nav => {
        console.log(`  - ${nav.page}: ${nav.error}`);
      });
    }
    
    console.log('\n✅ Issue 5 Analysis Complete');
  });
});
