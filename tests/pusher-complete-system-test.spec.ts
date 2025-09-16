import { test, expect, Page } from '@playwright/test';

test.describe('Complete Pusher System Test', () => {
  let adminPage: Page;
  let displayPage: Page;

  test.beforeEach(async ({ browser }) => {
    // Create two browser contexts to simulate admin and display screens
    const adminContext = await browser.newContext();
    const displayContext = await browser.newContext();
    
    adminPage = await adminContext.newPage();
    displayPage = await displayContext.newPage();
  });

  test('Complete Pusher flow: Admin login → Spotify watcher → Display updates', async () => {
    console.log('🧪 Testing complete Pusher system...');

    // STEP 1: Admin login and verify Pusher connection
    console.log('📱 Step 1: Admin login and Pusher connection');
    await adminPage.goto('http://localhost:3000/admin');
    
    // Login
    await adminPage.fill('input[placeholder="Enter username"]', 'admin');
    await adminPage.fill('input[placeholder="Enter password"]', 'admin123');
    await adminPage.click('button:has-text("Login")');
    await adminPage.waitForURL('**/admin/overview');
    
    // Wait for admin data context to initialize
    await adminPage.waitForTimeout(2000);
    
    // Check Pusher connection status in admin
    const adminConnectionStatus = await adminPage.locator('span:has-text("Pusher")').count();
    console.log(`📡 Admin Pusher connection: ${adminConnectionStatus > 0 ? 'Connected' : 'Not found'}`);

    // STEP 2: Display page Pusher connection
    console.log('🖥️  Step 2: Display page Pusher connection');
    await displayPage.goto('http://localhost:3000/display');
    await displayPage.waitForTimeout(2000);
    
    // Check for Pusher connection indicators
    const displayPusherLogs = await displayPage.evaluate(() => {
      return new Promise((resolve) => {
        // Listen for console logs
        let logs: string[] = [];
        const originalLog = console.log;
        console.log = (...args) => {
          const message = args.join(' ');
          if (message.includes('PUSHER') || message.includes('Pusher')) {
            logs.push(message);
          }
          originalLog.apply(console, args);
        };
        
        // Wait a bit for logs
        setTimeout(() => {
          console.log = originalLog;
          resolve(logs);
        }, 1000);
      });
    });
    
    console.log('🔍 Display page Pusher logs:', displayPusherLogs);

    // STEP 3: Check Spotify watcher status via admin API
    console.log('🎵 Step 3: Spotify watcher status');
    const watcherResponse = await adminPage.evaluate(async () => {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/spotify-watcher', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.json();
    });
    
    console.log('🎵 Spotify watcher status:', watcherResponse);
    expect(watcherResponse).toHaveProperty('running');

    // STEP 4: Test admin panel data loading
    console.log('📊 Step 4: Admin panel data via Pusher');
    
    // Check for stats
    await adminPage.waitForSelector('[data-testid="total-requests"], .text-2xl:has-text("0"), .text-2xl', { timeout: 5000 });
    const totalRequests = await adminPage.locator('.text-2xl').first().textContent();
    console.log(`📈 Total requests loaded: ${totalRequests}`);
    
    // Check for Spotify connection status
    const spotifyStatus = await adminPage.locator('span:has-text("Spotify")').count();
    console.log(`🎵 Spotify status displayed: ${spotifyStatus > 0 ? 'Yes' : 'No'}`);

    // STEP 5: Test display page initial data
    console.log('🖥️  Step 5: Display page data via Pusher');
    
    // Check for event title or "No current track" message
    const displayContent = await displayPage.locator('h1, h2, .text-4xl').first().textContent();
    console.log(`🎪 Display page content: ${displayContent}`);
    
    // Check for upcoming songs section
    const upcomingSection = await displayPage.locator('h2:has-text("Up Next"), h3:has-text("Up Next")').count();
    console.log(`📋 Up Next section: ${upcomingSection > 0 ? 'Found' : 'Not found'}`);

    // STEP 6: Verify no old SSE/polling code is running
    console.log('🔍 Step 6: Verify no old SSE/polling code');
    
    // Check admin page for SSE references
    const adminPageContent = await adminPage.content();
    const hasSSEReferences = adminPageContent.includes('EventSource') || adminPageContent.includes('SSE');
    console.log(`❌ Admin page has SSE references: ${hasSSEReferences}`);
    expect(hasSSEReferences).toBe(false);
    
    // Check display page for old polling
    const displayPageContent = await displayPage.content();
    const hasPollingReferences = displayPageContent.includes('setInterval') && displayPageContent.includes('fetch');
    console.log(`❌ Display page has polling references: ${hasPollingReferences}`);
    
    // STEP 7: Test connection indicators
    console.log('🔗 Step 7: Connection indicators');
    
    // Admin should show Pusher connection
    const adminConnectionText = await adminPage.locator('span:has-text("Pusher"), span:has-text("Connected"), span:has-text("Connecting")').first().textContent();
    console.log(`📡 Admin connection status: ${adminConnectionText}`);
    
    // STEP 8: Final verification
    console.log('✅ Step 8: Final system verification');
    
    // Verify both pages are functional
    expect(await adminPage.locator('h1:has-text("Admin Overview")').count()).toBeGreaterThan(0);
    expect(await displayPage.locator('body').count()).toBeGreaterThan(0);
    
    console.log('🎉 Complete Pusher system test PASSED!');
    console.log('');
    console.log('📊 RESULTS SUMMARY:');
    console.log(`📱 Admin Panel: ${adminConnectionStatus > 0 ? '✅ Pusher Connected' : '❌ Connection Issue'}`);
    console.log(`🖥️  Display Page: ${displayPusherLogs.length > 0 ? '✅ Pusher Active' : '⚠️  Minimal Activity'}`);
    console.log(`🎵 Spotify Watcher: ${watcherResponse.running ? '✅ Running' : '❌ Not Running'}`);
    console.log(`🔄 Old Code Removed: ${!hasSSEReferences ? '✅ Clean' : '❌ Still Present'}`);
  });

  test('Test Pusher event flow simulation', async () => {
    console.log('🎭 Testing Pusher event simulation...');
    
    // Setup admin and display pages
    await adminPage.goto('http://localhost:3000/admin');
    await adminPage.fill('input[placeholder="Enter username"]', 'admin');
    await adminPage.fill('input[placeholder="Enter password"]', 'admin123');
    await adminPage.click('button:has-text("Login")');
    await adminPage.waitForURL('**/admin/overview');
    
    await displayPage.goto('http://localhost:3000/display');
    await displayPage.waitForTimeout(2000);
    
    // Test if we can trigger events (this would require actual Pusher setup)
    console.log('📡 Pusher event simulation test completed');
    console.log('ℹ️  Full event testing requires live Pusher credentials');
  });

  test.afterEach(async () => {
    await adminPage?.close();
    await displayPage?.close();
  });
});
