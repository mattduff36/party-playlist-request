import { test, expect } from '@playwright/test';

test.describe('Debug Production Settings', () => {
  test('Compare production vs local settings behavior', async ({ page }) => {
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

    console.log('\n🔍 Testing production settings behavior...\n');

    // Test on production site
    const PRODUCTION_URL = 'https://partyplaylist.co.uk';
    
    console.log('🌐 Step 1: Login to production admin');
    await page.goto(`${PRODUCTION_URL}/admin`);
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    console.log('✅ Production admin login successful');

    // Step 2: Get current settings via API
    console.log('📋 Step 2: Get current production settings');
    const currentSettings = await page.evaluate(async () => {
      const token = localStorage.getItem('admin_token');
      
      try {
        const response = await fetch('/api/admin/event-settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        const settings = await response.json();
        console.log('📋 Current production settings:', settings);
        return settings;
      } catch (error) {
        console.error('❌ Failed to get settings:', error);
        return null;
      }
    });

    console.log('📋 Production settings result:', currentSettings);

    // Step 3: Navigate to settings page
    console.log('⚙️ Step 3: Navigate to production settings page');
    await page.goto(`${PRODUCTION_URL}/admin/settings`);
    await page.waitForLoadState('networkidle');

    // Step 4: Check if force_polling checkbox exists and its state
    console.log('🔍 Step 4: Check force polling checkbox');
    
    const checkboxExists = await page.locator('#force_polling').count() > 0;
    console.log('📋 Force polling checkbox exists:', checkboxExists);
    
    if (checkboxExists) {
      const isChecked = await page.locator('#force_polling').isChecked();
      console.log('📋 Force polling checkbox checked:', isChecked);
      
      // Step 5: Try to enable it if not checked
      if (!isChecked) {
        console.log('✅ Step 5: Enabling force polling checkbox');
        await page.locator('#force_polling').check();
        
        const isCheckedAfter = await page.locator('#force_polling').isChecked();
        console.log('📋 Checkbox after check:', isCheckedAfter);
      } else {
        console.log('✅ Step 5: Force polling already enabled');
      }
      
      // Step 6: Submit the form
      console.log('💾 Step 6: Submitting production settings form');
      const saveButton = page.locator('button[type="submit"]');
      await saveButton.click();
      
      // Wait for processing
      await page.waitForTimeout(3000);
      
      // Step 7: Verify the setting persisted
      console.log('🔄 Step 7: Refreshing to check persistence');
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const checkboxAfterRefresh = await page.locator('#force_polling').isChecked();
      console.log('📋 Force polling after refresh:', checkboxAfterRefresh);
      
      // Step 8: Test the actual behavior
      console.log('🔍 Step 8: Testing production polling behavior');
      
      // Wait and check for polling logs
      await page.waitForTimeout(5000);
      
      const pollingBehavior = await page.evaluate(() => {
        // Check if we can find evidence of polling vs SSE
        const logs = [];
        const originalLog = console.log;
        
        // Capture logs for a few seconds
        return new Promise((resolve) => {
          console.log = (...args) => {
            const message = args.join(' ');
            logs.push(message);
            originalLog(...args);
          };
          
          setTimeout(() => {
            console.log = originalLog;
            
            const hasSSELogs = logs.some(log => 
              log.includes('SSE connection') || 
              log.includes('Connecting to SSE')
            );
            
            const hasPollingLogs = logs.some(log => 
              log.includes('Setting up polling interval') ||
              log.includes('force polling enabled')
            );
            
            const hasForcePollingSwitch = logs.some(log =>
              log.includes('Force polling enabled - switching from SSE to polling')
            );
            
            resolve({
              hasSSELogs,
              hasPollingLogs,
              hasForcePollingSwitch,
              recentLogs: logs.slice(-15)
            });
          }, 3000);
        });
      });
      
      console.log('🔍 Production polling behavior:', pollingBehavior);
      
      // Analysis
      console.log('\n🔬 PRODUCTION ANALYSIS:');
      if (pollingBehavior.hasForcePollingSwitch) {
        console.log('✅ SUCCESS: Force polling is working in production');
      } else if (pollingBehavior.hasPollingLogs) {
        console.log('⚠️  PARTIAL: Polling is active but may not be due to force setting');
      } else if (pollingBehavior.hasSSELogs) {
        console.log('❌ ISSUE: Still using SSE despite force polling enabled');
      } else {
        console.log('❓ UNCLEAR: No clear polling or SSE activity detected');
      }
      
    } else {
      console.log('❌ CRITICAL: Force polling checkbox not found in production');
      console.log('🔍 This suggests the UI wasn\'t deployed or there\'s a rendering issue');
    }

    console.log('\n✅ Production settings debug completed');
  });

  test('Direct production API test', async ({ page }) => {
    console.log('\n🌐 Testing production API directly...\n');
    
    page.on('console', msg => console.log(`🖥️  ${msg.text()}`));

    // Login to production
    await page.goto('https://partyplaylist.co.uk/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');

    // Test production API directly
    const productionApiTest = await page.evaluate(async () => {
      const token = localStorage.getItem('admin_token');
      
      console.log('🔑 Testing production API with admin token:', !!token);
      
      try {
        // Get current settings
        const getResponse = await fetch('/api/admin/event-settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        const currentSettings = await getResponse.json();
        console.log('📋 Current production settings:', {
          hasForcePolling: 'force_polling' in currentSettings,
          forcePollingValue: currentSettings.force_polling,
          hasAutoApprove: 'auto_approve' in currentSettings,
          hasRequestLimit: 'request_limit' in currentSettings
        });
        
        // Try to update with force_polling = true
        const updateData = {
          ...currentSettings,
          force_polling: true,
          auto_approve: false,
          request_limit: 10
        };
        
        console.log('📤 Sending production update:', {
          force_polling: updateData.force_polling,
          auto_approve: updateData.auto_approve,
          request_limit: updateData.request_limit
        });
        
        const updateResponse = await fetch('/api/admin/event-settings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        });
        
        const updateResult = await updateResponse.json();
        console.log('📥 Production update response:', updateResult);
        
        // Verify the update
        const verifyResponse = await fetch('/api/admin/event-settings', {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        const verifiedSettings = await verifyResponse.json();
        console.log('🔍 Production settings after update:', {
          force_polling: verifiedSettings.force_polling,
          auto_approve: verifiedSettings.auto_approve,
          request_limit: verifiedSettings.request_limit
        });
        
        return {
          success: true,
          currentHadForcePolling: 'force_polling' in currentSettings,
          updateSucceeded: updateResponse.ok,
          finalForcePolling: verifiedSettings.force_polling,
          settingPersisted: verifiedSettings.force_polling === true
        };
        
      } catch (error) {
        console.error('❌ Production API test error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });

    console.log('🔍 Production API test result:', productionApiTest);

    if (productionApiTest.success) {
      if (productionApiTest.settingPersisted) {
        console.log('✅ SUCCESS: Production API can save force_polling setting');
      } else {
        console.log('❌ ISSUE: Production API cannot persist force_polling setting');
      }
    } else {
      console.log('❌ FAILED: Production API test failed');
    }

    console.log('\n✅ Production API test completed');
  });
});
