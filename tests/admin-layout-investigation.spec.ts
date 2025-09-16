import { test, expect } from '@playwright/test';

test.describe('Admin Layout Investigation', () => {
  
  test('Investigate what is actually rendering on admin page', async ({ page }) => {
    console.log('\n🔍 ADMIN LAYOUT INVESTIGATION\n');
    
    // Track console messages
    page.on('console', msg => {
      console.log(`🖥️  ${msg.type()}: ${msg.text()}`);
    });
    
    console.log('🔐 Step 1: Login and capture page state');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    console.log('📄 Step 2: Analyze page content');
    
    // Get the full page HTML
    const pageContent = await page.content();
    console.log(`Page HTML length: ${pageContent.length} characters`);
    
    // Get visible text content
    const bodyText = await page.textContent('body');
    console.log(`Body text length: ${bodyText?.length} characters`);
    console.log(`Body text preview: ${bodyText?.substring(0, 200)}...`);
    
    // Check for specific elements
    const title = await page.textContent('h1');
    console.log(`Page title: ${title}`);
    
    // Look for navigation elements
    const navElements = await page.locator('nav, [role="navigation"], .nav, .navigation').count();
    console.log(`Navigation elements found: ${navElements}`);
    
    // Look for links
    const allLinks = await page.locator('a').count();
    console.log(`Total links found: ${allLinks}`);
    
    if (allLinks > 0) {
      console.log('🔗 Link analysis:');
      for (let i = 0; i < Math.min(allLinks, 10); i++) {
        const linkText = await page.locator('a').nth(i).textContent();
        const linkHref = await page.locator('a').nth(i).getAttribute('href');
        console.log(`  ${i + 1}. "${linkText}" -> ${linkHref}`);
      }
    }
    
    // Look for buttons
    const allButtons = await page.locator('button').count();
    console.log(`Total buttons found: ${allButtons}`);
    
    if (allButtons > 0) {
      console.log('🔘 Button analysis:');
      for (let i = 0; i < Math.min(allButtons, 10); i++) {
        const buttonText = await page.locator('button').nth(i).textContent();
        const buttonType = await page.locator('button').nth(i).getAttribute('type');
        console.log(`  ${i + 1}. "${buttonText}" (type: ${buttonType})`);
      }
    }
    
    // Check for specific admin elements
    const adminElements = {
      'Overview text': await page.locator('text=Overview').count(),
      'Settings text': await page.locator('text=Settings').count(),
      'Requests text': await page.locator('text=Requests').count(),
      'Spotify text': await page.locator('text=Spotify').count(),
      'DJ Admin text': await page.locator('text=DJ Admin').count(),
      'Now Playing text': await page.locator('text=Now Playing').count()
    };
    
    console.log('🔍 Admin element detection:');
    Object.entries(adminElements).forEach(([element, count]) => {
      console.log(`  ${element}: ${count} found`);
    });
    
    // Check for loading states
    const loadingElements = await page.locator('text=Loading, text=loading, .loading, .spinner').count();
    console.log(`Loading indicators: ${loadingElements}`);
    
    // Check for error messages
    const errorElements = await page.locator('text=Error, text=error, .error').count();
    console.log(`Error indicators: ${errorElements}`);
    
    // Take a screenshot for visual inspection
    await page.screenshot({ path: 'admin-layout-debug.png', fullPage: true });
    console.log('📸 Screenshot saved as admin-layout-debug.png');
    
    console.log('🔍 Step 3: Check component loading states');
    
    // Wait a bit more and check if anything changes
    await page.waitForTimeout(3000);
    
    const updatedBodyText = await page.textContent('body');
    const textChanged = updatedBodyText !== bodyText;
    console.log(`Content changed after 3s wait: ${textChanged}`);
    
    if (textChanged) {
      console.log(`Updated body text preview: ${updatedBodyText?.substring(0, 200)}...`);
    }
    
    // Check if we can find any React components
    const reactElements = await page.evaluate(() => {
      // Look for React-related attributes
      const elementsWithReactProps = document.querySelectorAll('[data-reactroot], [data-react-*]');
      return elementsWithReactProps.length;
    });
    console.log(`React elements found: ${reactElements}`);
    
    // Check for any JavaScript errors
    const jsErrors = await page.evaluate(() => {
      return window.console ? 'Console available' : 'No console';
    });
    console.log(`JavaScript environment: ${jsErrors}`);
    
    console.log('\n✅ Admin Layout Investigation Complete');
  });

  test('Test admin authentication and data loading', async ({ page }) => {
    console.log('\n🔍 ADMIN AUTHENTICATION AND DATA LOADING\n');
    
    const apiCalls = [];
    const authStates = [];
    
    // Track API calls
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
        console.log(`📡 API: ${request.method()} ${request.url()}`);
      }
    });
    
    // Track responses
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`📡 RESPONSE: ${response.status()} ${response.url()}`);
      }
    });
    
    // Track console messages about authentication
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('auth') || text.includes('token') || text.includes('login')) {
        authStates.push(text);
        console.log(`🔐 AUTH: ${text}`);
      } else {
        console.log(`🖥️  ${text}`);
      }
    });
    
    console.log('🔐 Step 1: Login process');
    await page.goto('http://localhost:3000/admin');
    
    // Check login form
    const loginForm = await page.locator('form').count();
    console.log(`Login forms found: ${loginForm}`);
    
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    console.log('⏳ Waiting for redirect...');
    await page.waitForURL('**/admin/overview');
    console.log('✅ Redirected to overview');
    
    console.log('📊 Step 2: Check authentication state');
    
    // Check localStorage for admin token
    const hasToken = await page.evaluate(() => {
      const token = localStorage.getItem('admin_token');
      return {
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 20) + '...' : null
      };
    });
    
    console.log(`Admin token: ${hasToken.hasToken ? 'Present' : 'Missing'}`);
    if (hasToken.hasToken) {
      console.log(`Token length: ${hasToken.tokenLength}`);
      console.log(`Token preview: ${hasToken.tokenPreview}`);
    }
    
    console.log('📡 Step 3: Monitor data loading');
    
    // Wait for potential data loading
    await page.waitForTimeout(5000);
    
    console.log('\n📊 SUMMARY:');
    console.log(`Total API calls: ${apiCalls.length}`);
    console.log(`Auth-related messages: ${authStates.length}`);
    
    if (apiCalls.length > 0) {
      console.log('API calls made:');
      apiCalls.forEach((call, index) => {
        console.log(`  ${index + 1}. ${call.method} ${call.url}`);
      });
    }
    
    if (authStates.length > 0) {
      console.log('Auth messages:');
      authStates.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg}`);
      });
    }
    
    console.log('\n✅ Authentication and Data Loading Test Complete');
  });

  test('Test specific admin components loading', async ({ page }) => {
    console.log('\n🔍 ADMIN COMPONENTS LOADING TEST\n');
    
    page.on('console', msg => console.log(`🖥️  ${msg.text()}`));
    
    console.log('🔐 Step 1: Login');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    console.log('🧩 Step 2: Check for specific components');
    
    // Wait for components to potentially load
    await page.waitForTimeout(3000);
    
    // Check for AdminLayout component
    const adminLayoutIndicators = {
      'Header with DJ Admin': await page.locator('text=DJ Admin').count(),
      'Navigation sidebar': await page.locator('nav, .nav, .sidebar').count(),
      'Main content area': await page.locator('main, .main, .content').count(),
      'Overview heading': await page.locator('h1, h2').count(),
      'Stats cards': await page.locator('.bg-gray-800, .card, .stat').count(),
      'Now Playing section': await page.locator('text=Now Playing').count()
    };
    
    console.log('🔍 Component detection:');
    Object.entries(adminLayoutIndicators).forEach(([component, count]) => {
      console.log(`  ${component}: ${count} found`);
    });
    
    // Check for useAdminData hook indicators
    const dataHookIndicators = {
      'Loading state': await page.locator('text=Loading, text=loading').count(),
      'Stats numbers': await page.locator('text=/\\d+/').count(),
      'Spotify connected': await page.locator('text=Connected, text=connected').count(),
      'Request items': await page.locator('[data-testid*="request"], .request').count()
    };
    
    console.log('🔍 Data hook indicators:');
    Object.entries(dataHookIndicators).forEach(([indicator, count]) => {
      console.log(`  ${indicator}: ${count} found`);
    });
    
    // Try to find any text that might indicate what's actually loaded
    const pageText = await page.textContent('body');
    const words = pageText?.split(/\\s+/).filter(word => word.length > 3) || [];
    const uniqueWords = [...new Set(words)].slice(0, 20);
    
    console.log('🔍 Key words found on page:');
    console.log(`  ${uniqueWords.join(', ')}`);
    
    // Check for React hydration
    const reactHydrated = await page.evaluate(() => {
      return document.querySelector('[data-reactroot]') !== null || 
             document.querySelector('#__next') !== null ||
             document.querySelector('#root') !== null;
    });
    console.log(`React hydrated: ${reactHydrated}`);
    
    console.log('\n✅ Components Loading Test Complete');
  });
});
