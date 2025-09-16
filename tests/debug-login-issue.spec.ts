import { test, expect } from '@playwright/test';

test.describe('Debug Login Issue', () => {
  test('Debug admin login flow step by step', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`🖥️  BROWSER: ${msg.type()}: ${msg.text()}`);
    });

    // Enable network logging
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`📥 RESPONSE: ${response.status()} ${response.url()}`);
      }
    });

    console.log('\n🔍 Debugging login issue...\n');

    // Step 1: Navigate to admin login
    console.log('📍 Step 1: Navigate to admin login');
    await page.goto('http://localhost:3000/admin');
    await page.waitForLoadState('networkidle');

    // Check what's on the page
    const pageTitle = await page.title();
    const pageContent = await page.textContent('body');
    console.log('📄 Page title:', pageTitle);
    console.log('📄 Page contains "Admin Panel":', pageContent?.includes('Admin Panel'));
    console.log('📄 Page contains login form:', pageContent?.includes('Username') || pageContent?.includes('Password'));

    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-login-page.png', fullPage: true });
    console.log('📸 Screenshot saved as debug-login-page.png');

    // Check if login form exists
    const usernameInput = page.locator('input[type="text"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    const hasUsernameInput = await usernameInput.isVisible();
    const hasPasswordInput = await passwordInput.isVisible();
    const hasSubmitButton = await submitButton.isVisible();

    console.log('🔍 Form elements:', {
      usernameInput: hasUsernameInput,
      passwordInput: hasPasswordInput,
      submitButton: hasSubmitButton
    });

    if (hasUsernameInput && hasPasswordInput && hasSubmitButton) {
      console.log('🔐 Step 2: Filling login form');
      
      await usernameInput.fill('admin');
      await passwordInput.fill('admin123');
      
      console.log('🔐 Step 3: Submitting form');
      await submitButton.click();
      
      // Wait a bit and check what happens
      await page.waitForTimeout(2000);
      
      // Check current URL and page content
      const currentUrl = page.url();
      const newPageContent = await page.textContent('body');
      
      console.log('📍 After login:');
      console.log('   URL:', currentUrl);
      console.log('   Contains "Admin Panel":', newPageContent?.includes('Admin Panel'));
      console.log('   Contains error:', newPageContent?.includes('error') || newPageContent?.includes('Invalid'));
      
      // Take another screenshot
      await page.screenshot({ path: 'debug-after-login.png', fullPage: true });
      console.log('📸 After-login screenshot saved as debug-after-login.png');
      
      // Check localStorage for token
      const adminToken = await page.evaluate(() => localStorage.getItem('admin_token'));
      console.log('🔑 Admin token in localStorage:', {
        exists: !!adminToken,
        length: adminToken?.length,
        starts: adminToken?.substring(0, 20) + '...'
      });
      
    } else {
      console.log('❌ Login form not found - checking if already logged in');
      
      // Check if we're already on admin panel
      const isAdminPanel = pageContent?.includes('Admin Panel');
      if (isAdminPanel) {
        console.log('✅ Already on admin panel');
      } else {
        console.log('❌ Not on admin panel and no login form - something is wrong');
      }
    }

    console.log('\n✅ Login debug test completed');
  });

  test('Test direct API call to login endpoint', async ({ page }) => {
    console.log('\n🔍 Testing login API directly...\n');
    
    await page.goto('http://localhost:3000/admin');
    
    const loginResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: 'admin',
            password: 'admin123'
          })
        });
        
        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }
        
        return {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          data: responseData
        };
      } catch (error) {
        return {
          error: error.message
        };
      }
    });

    console.log('🔍 Direct login API result:', JSON.stringify(loginResult, null, 2));
    
    if (loginResult.ok && loginResult.data?.token) {
      console.log('✅ Login API works - token received');
      
      // Test if we can use the token
      const tokenTest = await page.evaluate(async (token) => {
        try {
          const response = await fetch('/api/admin/events?token=' + encodeURIComponent(token));
          return {
            status: response.status,
            ok: response.ok
          };
        } catch (error) {
          return {
            error: error.message
          };
        }
      }, loginResult.data.token);
      
      console.log('🔑 Token validation result:', tokenTest);
    } else {
      console.log('❌ Login API failed');
    }
  });
});
