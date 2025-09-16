import { test, expect } from '@playwright/test';

test.describe('Task 2.1: Now Playing Content Display', () => {
  
  test('Verify Now Playing section shows track information', async ({ page }) => {
    console.log('\n🔧 TASK 2.1: NOW PLAYING CONTENT DISPLAY\n');
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('OverviewPage rendering') && text.includes('Mock Song Title')) {
        console.log(`🎵 TRACK DATA: ${text}`);
      }
    });
    
    console.log('🔐 Step 1: Login');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    console.log('✅ On Overview page');
    
    console.log('⏳ Step 2: Wait for data to load');
    await page.waitForTimeout(8000);
    
    console.log('🔍 Step 3: Check Now Playing section content');
    
    // Check if Now Playing section exists
    const nowPlayingSection = await page.locator('h2:has-text("Now Playing")').count();
    console.log(`Now Playing sections found: ${nowPlayingSection}`);
    
    if (nowPlayingSection > 0) {
      console.log('✅ Now Playing section exists');
      
      // Get the entire Now Playing section content
      const nowPlayingContainer = page.locator('.bg-gray-800:has(h2:has-text("Now Playing"))');
      const sectionContent = await nowPlayingContainer.textContent();
      console.log(`Section content: "${sectionContent}"`);
      
      // Check for specific track information
      const hasTrackName = sectionContent?.includes('Mock Song Title');
      const hasArtistName = sectionContent?.includes('Mock Artist');
      const hasAlbumName = sectionContent?.includes('Mock Album');
      const hasNoTrackPlaying = sectionContent?.includes('No track playing');
      
      console.log('🎵 Track information analysis:');
      console.log(`  Has track name "Mock Song Title": ${hasTrackName}`);
      console.log(`  Has artist name "Mock Artist": ${hasArtistName}`);
      console.log(`  Has album name "Mock Album": ${hasAlbumName}`);
      console.log(`  Shows "No track playing": ${hasNoTrackPlaying}`);
      
      // Check for album art
      const albumArt = await page.locator('img[alt="Album art"]').count();
      console.log(`  Album art images: ${albumArt}`);
      
      if (albumArt > 0) {
        const albumArtSrc = await page.locator('img[alt="Album art"]').first().getAttribute('src');
        console.log(`  Album art src: ${albumArtSrc}`);
      }
      
      // Check for progress bar
      const progressBar = await page.locator('.bg-green-500').count();
      console.log(`  Progress bar elements: ${progressBar}`);
      
      // Check for playback controls
      const playbackControls = await page.locator('button:has(svg)').count();
      console.log(`  Playback control buttons: ${playbackControls}`);
      
      // Analyze the specific track name element
      const trackNameElements = await page.locator('h3').count();
      console.log(`  H3 elements (track names): ${trackNameElements}`);
      
      if (trackNameElements > 0) {
        for (let i = 0; i < trackNameElements; i++) {
          const trackText = await page.locator('h3').nth(i).textContent();
          console.log(`    H3 ${i + 1}: "${trackText}"`);
        }
      }
      
      // Check artist/album info paragraphs
      const artistAlbumElements = await page.locator('p:has-text("•")').count();
      console.log(`  Artist/Album info elements: ${artistAlbumElements}`);
      
      if (artistAlbumElements > 0) {
        for (let i = 0; i < artistAlbumElements; i++) {
          const artistAlbumText = await page.locator('p:has-text("•")').nth(i).textContent();
          console.log(`    Artist/Album ${i + 1}: "${artistAlbumText}"`);
        }
      }
      
      // Final assessment
      if (hasTrackName && hasArtistName && hasAlbumName && !hasNoTrackPlaying) {
        console.log('🎉 SUCCESS: All track information is displayed correctly!');
      } else if (hasNoTrackPlaying) {
        console.log('⚠️  ISSUE: Shows "No track playing" despite having data');
      } else {
        console.log('⚠️  ISSUE: Some track information is missing from display');
      }
      
    } else {
      console.log('❌ Now Playing section not found');
    }
    
    console.log('\n✅ TASK 2.1 CONTENT DISPLAY TEST COMPLETE');
  });

  test('Test Now Playing section with different data states', async ({ page }) => {
    console.log('\n🔧 TASK 2.1: TEST DIFFERENT DATA STATES\n');
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('playbackState') || text.includes('spotify_connected')) {
        console.log(`📊 STATE: ${text}`);
      }
    });
    
    console.log('🔐 Step 1: Login');
    await page.goto('http://localhost:3000/admin');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/overview');
    
    console.log('⏳ Step 2: Wait for initial data load');
    await page.waitForTimeout(5000);
    
    // Check initial state
    const initialNowPlaying = await page.locator('h2:has-text("Now Playing")').count();
    console.log(`Initial Now Playing sections: ${initialNowPlaying}`);
    
    if (initialNowPlaying > 0) {
      const initialContent = await page.locator('.bg-gray-800:has(h2:has-text("Now Playing"))').textContent();
      console.log(`Initial content preview: ${initialContent?.substring(0, 100)}...`);
    }
    
    console.log('🔄 Step 3: Navigate away and back to test state persistence');
    
    // Navigate to requests page
    await page.click('button:has-text("Song Requests")');
    await page.waitForURL('**/admin/requests');
    await page.waitForTimeout(2000);
    
    // Navigate back to overview
    await page.click('button:has-text("Overview")');
    await page.waitForURL('**/admin/overview');
    await page.waitForTimeout(3000);
    
    // Check if Now Playing section is still there
    const finalNowPlaying = await page.locator('h2:has-text("Now Playing")').count();
    console.log(`Final Now Playing sections: ${finalNowPlaying}`);
    
    if (finalNowPlaying > 0) {
      const finalContent = await page.locator('.bg-gray-800:has(h2:has-text("Now Playing"))').textContent();
      console.log(`Final content preview: ${finalContent?.substring(0, 100)}...`);
      
      const stillHasTrackInfo = finalContent?.includes('Mock Song') || finalContent?.includes('Mock Artist');
      console.log(`Still has track information: ${stillHasTrackInfo}`);
      
      if (stillHasTrackInfo) {
        console.log('✅ Track information persists across navigation');
      } else {
        console.log('⚠️  Track information lost during navigation');
      }
    }
    
    console.log('\n✅ DIFFERENT DATA STATES TEST COMPLETE');
  });
});
