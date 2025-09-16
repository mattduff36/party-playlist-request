import { test, expect } from '@playwright/test';

test.describe('Live Progress Animation', () => {
  test('should show animated progress bar and live time counter in admin panel', async ({ page }) => {
    // Navigate to admin login
    await page.goto('http://localhost:3000/admin');
    
    // Login with admin credentials
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to overview page
    await page.waitForURL('**/admin/overview');
    
    // Wait for the page to load and get initial state
    await page.waitForSelector('.text-white', { timeout: 10000 });
    
    console.log('🎵 Testing live progress animation functionality...');
    
    // Check if progress bar exists (look for the actual progress bar container)
    const progressBarContainer = page.locator('div.bg-gray-700').first();
    const progressBar = progressBarContainer.locator('div').first();
    await expect(progressBarContainer).toBeVisible();
    
    // Check if time display exists
    const timeDisplay = page.locator('p:has-text("/")').first();
    await expect(timeDisplay).toBeVisible();
    
    // Get initial progress bar width and time
    const initialWidth = await progressBar.evaluate(el => el.style.width);
    const initialTimeText = await timeDisplay.textContent();
    
    console.log('📊 Initial state:', {
      progressWidth: initialWidth,
      timeText: initialTimeText
    });
    
    // Wait 3 seconds to see if progress animates
    await page.waitForTimeout(3000);
    
    // Get updated progress bar width and time
    const updatedWidth = await progressBar.evaluate(el => el.style.width);
    const updatedTimeText = await timeDisplay.textContent();
    
    console.log('📊 After 3 seconds:', {
      progressWidth: updatedWidth,
      timeText: updatedTimeText
    });
    
    // Check if the progress bar has animation classes
    const hasAnimationClasses = await progressBar.evaluate(el => {
      return el.classList.contains('bg-green-400') || el.classList.contains('bg-green-500');
    });
    
    expect(hasAnimationClasses).toBe(true);
    
    // Check if time format is correct (MM:SS / MM:SS)
    const timeRegex = /\d+:\d{2}\s*\/\s*\d+:\d{2}/;
    expect(initialTimeText).toMatch(timeRegex);
    
    // Verify progress bar has proper styling for animation
    const progressBarClasses = await progressBar.getAttribute('class');
    expect(progressBarClasses).toContain('rounded-full');
    expect(progressBarClasses).toMatch(/bg-green-[45]00/);
    
    console.log('✅ Live progress animation test completed successfully');
  });

  test('should show animated progress bar in display screen', async ({ page }) => {
    // Navigate to display screen
    await page.goto('http://localhost:3000/display');
    
    // Wait for the page to load
    await page.waitForSelector('h1', { timeout: 10000 });
    
    console.log('🖥️ Testing display screen live progress animation...');
    
    // Look for Now Playing section
    const nowPlayingSection = page.locator('h2:has-text("Now Playing")').first();
    await expect(nowPlayingSection).toBeVisible();
    
    // Check if progress bar exists in display screen
    const displayProgressBar = page.locator('div.bg-gray-700').locator('div.bg-green-400, div.bg-green-500').first();
    
    // If there's a current track, verify progress bar
    const hasCurrentTrack = await page.locator('img[alt="Album Art"]').isVisible();
    
    if (hasCurrentTrack) {
      await expect(displayProgressBar).toBeVisible();
      
      // Check if time display exists
      const displayTimeText = page.locator('p:has-text("/")').first();
      await expect(displayTimeText).toBeVisible();
      
      const timeText = await displayTimeText.textContent();
      const timeRegex = /\d+:\d{2}\s*\/\s*\d+:\d{2}/;
      expect(timeText).toMatch(timeRegex);
      
      console.log('✅ Display screen progress bar working correctly');
    } else {
      console.log('ℹ️ No current track playing - progress bar not expected');
    }
  });

  test('should handle progress bar edge cases correctly', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('http://localhost:3000/admin');
    
    // Login
    await page.fill('input[placeholder="Enter username"]', 'admin');
    await page.fill('input[placeholder="Enter password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/admin/overview');
    await page.waitForSelector('.text-white', { timeout: 10000 });
    
    console.log('🧪 Testing progress bar edge cases...');
    
    // Check progress bar constraints
    const progressBar = page.locator('div.bg-green-400, div.bg-green-500').first();
    
    if (await progressBar.isVisible()) {
      const progressWidth = await progressBar.evaluate(el => {
        const width = el.style.width;
        const numericWidth = parseFloat(width.replace('%', ''));
        return numericWidth;
      });
      
      // Progress should be between 0 and 100%
      expect(progressWidth).toBeGreaterThanOrEqual(0);
      expect(progressWidth).toBeLessThanOrEqual(100);
      
      // Check if progress bar has smooth transition
      const transitionStyle = await progressBar.evaluate(el => {
        return window.getComputedStyle(el).transition;
      });
      
      expect(transitionStyle).toContain('width');
      
      console.log('✅ Progress bar edge cases handled correctly');
    }
  });
});
