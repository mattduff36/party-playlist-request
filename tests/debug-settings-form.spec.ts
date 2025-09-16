import { test, expect } from '@playwright/test';

test.describe('Debug Settings Form', () => {
  test('Test force polling checkbox and form submission', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`🖥️  BROWSER: ${msg.type()}: ${msg.text()}`);
    });

    // Enable network logging
    page.on('request', request => {
      if (request.url().includes('/api/admin/event-settings')) {
        console.log(`📤 SETTINGS API REQUEST: ${request.method()} ${request.url()}`);
        if (request.postData()) {
          console.log(`📤 SETTINGS POST DATA:`, request.postData());
        }
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/admin/event-settings')) {
        console.log(`📥 SETTINGS API RESPONSE: ${response.status()} ${response.url()}`);
      }
    });

    console.log('\n🔧 Testing settings form force polling checkbox...\n');

    // Step 1: Login to admin
    console.log('🔐 Step 1: Admin login');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    console.log('✅ Admin login successful');

    // Step 2: Navigate to settings
    console.log('⚙️ Step 2: Navigate to settings');
    await page.goto('http://localhost:3000/admin/settings');
    await page.waitForLoadState('networkidle');

    // Step 3: Check current state of checkbox
    console.log('🔍 Step 3: Check current checkbox state');
    const checkboxBefore = page.locator('#force_polling');
    const isCheckedBefore = await checkboxBefore.isChecked();
    console.log('📋 Force polling checkbox before:', isCheckedBefore);

    // Step 4: Check the force polling checkbox
    console.log('✅ Step 4: Checking force polling checkbox');
    if (!isCheckedBefore) {
      await checkboxBefore.check();
      console.log('✅ Checkbox checked');
    } else {
      console.log('✅ Checkbox was already checked');
    }

    // Verify it's checked
    const isCheckedAfter = await checkboxBefore.isChecked();
    console.log('📋 Force polling checkbox after check:', isCheckedAfter);

    // Step 5: Submit the form
    console.log('💾 Step 5: Submitting settings form');
    const saveButton = page.locator('button[type="submit"]');
    await saveButton.click();

    // Step 6: Wait for form processing
    console.log('⏳ Step 6: Waiting for form processing...');
    await page.waitForTimeout(3000);

    // Step 7: Check if setting persisted by refreshing page
    console.log('🔄 Step 7: Refreshing page to check persistence');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Step 8: Check checkbox state after refresh
    const checkboxAfterRefresh = page.locator('#force_polling');
    const isCheckedAfterRefresh = await checkboxAfterRefresh.isChecked();
    console.log('📋 Force polling checkbox after refresh:', isCheckedAfterRefresh);

    // Step 9: Analysis
    console.log('\n🔬 ANALYSIS:');
    if (isCheckedAfterRefresh) {
      console.log('✅ SUCCESS: Force polling setting persisted after refresh');
      console.log('🎯 The checkbox state is being saved correctly');
    } else {
      console.log('❌ ISSUE: Force polling setting did NOT persist');
      console.log('🔍 The setting is not being saved to the database');
    }

    // Step 10: Test the actual polling behavior
    console.log('\n🔍 Step 8: Testing polling behavior');
    
    // Check if force polling is actually working
    const pollingTest = await page.evaluate(async () => {
      // Wait a bit and check console logs for polling messages
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
          
          const hasForcePollingLog = logs.some(log => 
            log.includes('force polling enabled') || 
            log.includes('Force polling enabled')
          );
          
          const hasPollingIntervalLog = logs.some(log => 
            log.includes('Setting up polling interval') && 
            log.includes('force polling enabled')
          );
          
          resolve({
            hasForcePollingLog,
            hasPollingIntervalLog,
            recentLogs: logs.slice(-10) // Last 10 logs
          });
        }, 2000);
      });
    });

    console.log('🔍 Polling behavior test:', pollingTest);

    if (pollingTest.hasForcePollingLog) {
      console.log('✅ Force polling is active in the system');
    } else {
      console.log('❌ Force polling is NOT active in the system');
    }

    console.log('\n✅ Settings form debug test completed');
  });

  test('Test settings API directly', async ({ page }) => {
    console.log('\n🔍 Testing settings API directly...\n');
    
    page.on('console', msg => console.log(`🖥️  ${msg.text()}`));

    // Login first
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');

    // Test API directly
    const apiTest = await page.evaluate(async () => {
      const token = localStorage.getItem('admin_token');
      
      console.log('🔑 Testing with admin token:', !!token);
      
      // First, get current settings
      try {
        const getResponse = await fetch('/api/admin/event-settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        const currentSettings = await getResponse.json();
        console.log('📋 Current settings from API:', currentSettings);
        
        // Now try to update with force_polling
        const updateData = {
          ...currentSettings,
          force_polling: true,
          auto_approve: false,
          request_limit: 10
        };
        
        console.log('📤 Sending update with data:', updateData);
        
        const updateResponse = await fetch('/api/admin/event-settings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        });
        
        const updateResult = await updateResponse.json();
        console.log('📥 Update response:', updateResult);
        
        // Get settings again to verify
        const verifyResponse = await fetch('/api/admin/event-settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        const verifiedSettings = await verifyResponse.json();
        console.log('🔍 Settings after update:', verifiedSettings);
        
        return {
          success: true,
          currentSettings,
          updateResult,
          verifiedSettings,
          forcePollingPersisted: verifiedSettings.force_polling === true
        };
        
      } catch (error) {
        console.error('❌ API test error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });

    console.log('🔍 Direct API test result:', apiTest);

    if (apiTest.success) {
      if (apiTest.forcePollingPersisted) {
        console.log('✅ SUCCESS: force_polling setting persisted via direct API');
      } else {
        console.log('❌ ISSUE: force_polling setting did NOT persist via direct API');
        console.log('🔍 This indicates a database or API processing issue');
      }
    } else {
      console.log('❌ FAILED: Could not test API directly');
    }

    console.log('\n✅ Direct API test completed');
  });
});
