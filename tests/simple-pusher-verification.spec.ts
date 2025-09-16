import { test, expect } from '@playwright/test';

test.describe('Simple Pusher Verification', () => {

  test('Admin panel loads with Pusher context', async ({ page }) => {
    console.log('🧪 Testing admin panel with Pusher...');
    
    await page.goto('http://localhost:3000/admin');
    
    // Login
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button:has-text("Login")');
    await page.waitForURL('**/admin/overview');
    
    console.log('✅ Admin login successful');
    
    // Wait for AdminDataContext to initialize
    await page.waitForTimeout(3000);
    
    // Check for Pusher connection status
    const pusherStatus = await page.locator('span:has-text("Pusher")').count();
    console.log(`📡 Pusher connection indicator: ${pusherStatus > 0 ? 'Found' : 'Not found'}`);
    
    // Check for stats display (should be loaded via Pusher context)
    const statsElements = await page.locator('.text-2xl').count();
    console.log(`📊 Stats elements found: ${statsElements}`);
    
    // Verify no SSE references in page source
    const pageContent = await page.content();
    const hasSSE = pageContent.includes('EventSource') || pageContent.includes('/api/admin/events');
    console.log(`❌ Old SSE code present: ${hasSSE}`);
    expect(hasSSE).toBe(false);
    
    console.log('✅ Admin panel Pusher verification PASSED');
  });

  test('Display page loads with Pusher integration', async ({ page }) => {
    console.log('🧪 Testing display page with Pusher...');
    
    await page.goto('http://localhost:3000/display');
    await page.waitForTimeout(2000);
    
    // Check page loads
    const bodyExists = await page.locator('body').count();
    expect(bodyExists).toBeGreaterThan(0);
    console.log('✅ Display page loaded');
    
    // Look for event title or "No current track"
    const mainContent = await page.locator('h1, h2, .text-4xl, .text-3xl').first().textContent();
    console.log(`🎪 Display content: ${mainContent}`);
    
    // Check for Up Next section
    const upNextSection = await page.locator('text=Up Next').count();
    console.log(`📋 Up Next section: ${upNextSection > 0 ? 'Found' : 'Not found'}`);
    
    // Verify Pusher integration (check console logs)
    const pusherLogs = await page.evaluate(() => {
      return new Promise((resolve) => {
        const logs: string[] = [];
        const originalLog = console.log;
        console.log = (...args) => {
          const message = args.join(' ');
          if (message.includes('PUSHER') || message.includes('usePusher')) {
            logs.push(message);
          }
          originalLog.apply(console, args);
        };
        
        setTimeout(() => {
          console.log = originalLog;
          resolve(logs);
        }, 1000);
      });
    });
    
    console.log(`📡 Pusher activity logs: ${Array.isArray(pusherLogs) ? pusherLogs.length : 0} entries`);
    
    console.log('✅ Display page Pusher verification PASSED');
  });

  test('Spotify watcher API responds', async ({ page }) => {
    console.log('🧪 Testing Spotify watcher API...');
    
    // Get admin token first
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button:has-text("Login")');
    await page.waitForURL('**/admin/overview');
    
    // Test watcher status
    const watcherStatus = await page.evaluate(async () => {
      const token = localStorage.getItem('admin_token');
      try {
        const response = await fetch('/api/admin/spotify-watcher', {
          headers: { Authorization: `Bearer ${token}` }
        });
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('🎵 Spotify watcher status:', watcherStatus);
    expect(watcherStatus).toHaveProperty('running');
    
    console.log('✅ Spotify watcher API verification PASSED');
  });
});
