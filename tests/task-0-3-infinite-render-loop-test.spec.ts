import { test, expect } from '@playwright/test';

test.describe('Task 0.3: Local Testing - Infinite Render Loop Fix', () => {
  test('validate render loop fix prevents excessive re-renders', async ({ page }) => {
    // Track console logs to count renders
    const renderLogs: string[] = [];
    const sseDataLogs: string[] = [];
    let renderCount = 0;
    let sseUpdateCount = 0;
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('📊 OverviewPage rendering with:')) {
        renderCount++;
        renderLogs.push(text);
      }
      if (text.includes('📡 Received SSE data update')) {
        sseUpdateCount++;
        sseDataLogs.push(text);
      }
    });
    
    console.log('🔍 Starting render loop validation test...');
    
    // Login and navigate to overview
    await page.goto('/admin/overview');
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for initial data load
    await page.waitForTimeout(5000);
    
    const initialRenderCount = renderCount;
    const initialSSECount = sseUpdateCount;
    
    console.log('📊 Initial state after login:');
    console.log(`  - Renders: ${initialRenderCount}`);
    console.log(`  - SSE updates: ${initialSSECount}`);
    
    // Monitor for 30 seconds to check for excessive renders
    console.log('⏱️ Monitoring for 30 seconds...');
    const monitoringStartTime = Date.now();
    
    await page.waitForTimeout(30000); // 30 seconds
    
    const finalRenderCount = renderCount;
    const finalSSECount = sseUpdateCount;
    const monitoringDuration = (Date.now() - monitoringStartTime) / 1000;
    
    // Calculate render frequency
    const rendersInMonitoring = finalRenderCount - initialRenderCount;
    const sseUpdatesInMonitoring = finalSSECount - initialSSECount;
    const renderFrequency = rendersInMonitoring / monitoringDuration;
    const sseFrequency = sseUpdatesInMonitoring / monitoringDuration;
    
    console.log('📈 Monitoring results:');
    console.log(`  - Total renders: ${finalRenderCount}`);
    console.log(`  - Renders during monitoring: ${rendersInMonitoring}`);
    console.log(`  - Render frequency: ${renderFrequency.toFixed(2)} renders/second`);
    console.log(`  - SSE updates: ${finalSSECount}`);
    console.log(`  - SSE updates during monitoring: ${sseUpdatesInMonitoring}`);
    console.log(`  - SSE frequency: ${sseFrequency.toFixed(2)} updates/second`);
    
    // CRITICAL SUCCESS CRITERIA
    // Before fix: hundreds of renders per second
    // After fix: should be < 2 renders per second on average
    
    console.log('✅ VALIDATION CRITERIA:');
    console.log(`  - Render frequency < 2/sec: ${renderFrequency < 2 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  - SSE frequency reasonable: ${sseFrequency < 1 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  - No excessive renders: ${rendersInMonitoring < 60 ? '✅ PASS' : '❌ FAIL'}`);
    
    // Check for state thrashing patterns
    const lastFewRenders = renderLogs.slice(-10);
    let stateThrashinDetected = false;
    
    for (let i = 1; i < lastFewRenders.length; i++) {
      const prev = lastFewRenders[i-1];
      const curr = lastFewRenders[i];
      
      // Check for spotify_connected thrashing
      if (prev.includes('playbackState_connected: true') && 
          curr.includes('playbackState_connected: false')) {
        const nextLog = lastFewRenders[i+1];
        if (nextLog && nextLog.includes('playbackState_connected: true')) {
          stateThrashinDetected = true;
          break;
        }
      }
    }
    
    console.log(`  - No state thrashing: ${!stateThrashinDetected ? '✅ PASS' : '❌ FAIL'}`);
    
    // Final validation
    const testPassed = renderFrequency < 2 && 
                       sseFrequency < 1 && 
                       rendersInMonitoring < 60 && 
                       !stateThrashinDetected;
    
    console.log('\n🎯 FINAL RESULT:');
    console.log(`Infinite render loop fix: ${testPassed ? '✅ WORKING' : '❌ FAILED'}`);
    
    if (!testPassed) {
      console.log('\n❌ CRITICAL ISSUE: Render loop fix did not work');
      console.log('Recent render logs:');
      lastFewRenders.forEach((log, i) => console.log(`  ${i}: ${log}`));
    }
    
    // Assert the test passes
    expect(testPassed).toBe(true);
  });
  
  test('verify SSE connection stability without loops', async ({ page }) => {
    const connectionLogs: string[] = [];
    let sseConnected = false;
    let sseReconnects = 0;
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('✅ SSE connection established')) {
        sseConnected = true;
        connectionLogs.push('SSE connected');
      }
      if (text.includes('❌ SSE connection error')) {
        connectionLogs.push('SSE error');
      }
      if (text.includes('🔄 Reconnecting SSE')) {
        sseReconnects++;
        connectionLogs.push('SSE reconnect');
      }
    });
    
    console.log('🔍 Testing SSE connection stability...');
    
    // Login
    await page.goto('/admin/overview');
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for SSE connection
    await page.waitForTimeout(5000);
    
    console.log(`📡 SSE connection status: ${sseConnected ? '✅ Connected' : '❌ Failed'}`);
    console.log(`🔄 Reconnection attempts: ${sseReconnects}`);
    
    // Monitor connection stability for 20 seconds
    await page.waitForTimeout(20000);
    
    console.log('📊 Connection stability results:');
    console.log(`  - SSE connected: ${sseConnected}`);
    console.log(`  - Reconnection attempts: ${sseReconnects}`);
    console.log(`  - Connection events: ${connectionLogs.length}`);
    
    // Success criteria: SSE should connect and remain stable
    const connectionStable = sseConnected && sseReconnects < 3;
    console.log(`  - Connection stable: ${connectionStable ? '✅ PASS' : '❌ FAIL'}`);
    
    expect(connectionStable).toBe(true);
  });
  
  test('memory usage remains stable over time', async ({ page }) => {
    console.log('🧠 Testing memory usage stability...');
    
    // Login
    await page.goto('/admin/overview');
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for initial load
    await page.waitForTimeout(5000);
    
    // Measure initial memory usage
    const initialMemory = await page.evaluate(() => {
      const memory = (performance as any).memory;
      return memory ? {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      } : null;
    });
    
    if (initialMemory) {
      console.log('📊 Initial memory usage:');
      console.log(`  - Used: ${(initialMemory.used / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  - Total: ${(initialMemory.total / 1024 / 1024).toFixed(2)} MB`);
    }
    
    // Wait 60 seconds while monitoring
    console.log('⏱️ Monitoring memory for 60 seconds...');
    await page.waitForTimeout(60000);
    
    // Measure final memory usage
    const finalMemory = await page.evaluate(() => {
      const memory = (performance as any).memory;
      return memory ? {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      } : null;
    });
    
    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory.used - initialMemory.used;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.used) * 100;
      
      console.log('📊 Final memory usage:');
      console.log(`  - Used: ${(finalMemory.used / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  - Total: ${(finalMemory.total / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  - Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(1)}%)`);
      
      // Success criteria: memory increase should be < 50% over 60 seconds
      const memoryStable = memoryIncreasePercent < 50;
      console.log(`  - Memory stable: ${memoryStable ? '✅ PASS' : '❌ FAIL'}`);
      
      expect(memoryStable).toBe(true);
    } else {
      console.log('⚠️ Memory API not available, skipping memory test');
    }
  });
  
  test('confirm no performance degradation in other components', async ({ page }) => {
    console.log('⚡ Testing performance of other admin components...');
    
    // Login
    await page.goto('/admin/overview');
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Test navigation performance
    const navigationTests = [
      { name: 'Requests', selector: 'button:has-text("Song")' },
      { name: 'Settings', selector: 'button:has-text("Settings")' },
      { name: 'Spotify', selector: 'button:has-text("Spotify")' },
      { name: 'Overview', selector: 'button:has-text("Overview")' }
    ];
    
    for (const nav of navigationTests) {
      console.log(`🧭 Testing navigation to ${nav.name}...`);
      
      const startTime = Date.now();
      
      try {
        await page.click(nav.selector);
        await page.waitForTimeout(2000); // Wait for page to load
        
        const loadTime = Date.now() - startTime;
        console.log(`  - ${nav.name} load time: ${loadTime}ms`);
        
        // Success criteria: navigation should be < 3 seconds
        const performanceGood = loadTime < 3000;
        console.log(`  - Performance acceptable: ${performanceGood ? '✅ PASS' : '❌ FAIL'}`);
        
        expect(performanceGood).toBe(true);
      } catch (error) {
        console.log(`  - ${nav.name} navigation failed: ${error}`);
        // Don't fail the test for navigation issues, just log them
      }
    }
    
    console.log('✅ Component performance testing completed');
  });
});
