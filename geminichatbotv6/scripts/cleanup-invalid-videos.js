#!/usr/bin/env node

// Script to clean up invalid videos from localStorage
// Run this in the browser console to fix existing videos

function cleanupInvalidVideos() {
  console.log('🧹 Starting video cleanup...\n');
  
  const videosJson = localStorage.getItem('gemini-chat-videos');
  if (!videosJson) {
    console.log('No videos found in localStorage');
    return;
  }
  
  try {
    const videos = JSON.parse(videosJson);
    const originalCount = videos.length;
    
    console.log(`Found ${originalCount} videos in localStorage\n`);
    
    // Analyze videos
    const analysis = {
      total: originalCount,
      generating: 0,
      completed: 0,
      failed: 0,
      withBlobUrl: 0,
      withValidUrl: 0,
      withoutUrl: 0
    };
    
    videos.forEach(video => {
      if (video.status === 'generating') analysis.generating++;
      else if (video.status === 'completed') analysis.completed++;
      else if (video.status === 'failed') analysis.failed++;
      
      if (video.url) {
        if (video.url.startsWith('blob:')) analysis.withBlobUrl++;
        else if (video.url.startsWith('http')) analysis.withValidUrl++;
      } else {
        analysis.withoutUrl++;
      }
    });
    
    console.log('📊 Analysis:');
    console.log(`  - Generating: ${analysis.generating}`);
    console.log(`  - Completed: ${analysis.completed}`);
    console.log(`  - Failed: ${analysis.failed}`);
    console.log(`  - With blob URLs: ${analysis.withBlobUrl}`);
    console.log(`  - With valid URLs: ${analysis.withValidUrl}`);
    console.log(`  - Without URLs: ${analysis.withoutUrl}\n`);
    
    // Filter out invalid videos
    const validVideos = videos.filter(video => {
      // Keep non-completed videos
      if (video.status !== 'completed') return true;
      
      // Only keep completed videos with valid URLs
      if (!video.url || video.url.startsWith('blob:')) {
        console.log(`❌ Removing video "${video.prompt?.substring(0, 30)}..." (${video.id}) - invalid URL`);
        return false;
      }
      
      return true;
    });
    
    const removedCount = originalCount - validVideos.length;
    
    if (removedCount > 0) {
      // Save cleaned videos
      localStorage.setItem('gemini-chat-videos', JSON.stringify(validVideos));
      
      console.log(`\n✅ Cleanup complete!`);
      console.log(`  - Removed ${removedCount} invalid videos`);
      console.log(`  - Kept ${validVideos.length} valid videos`);
      console.log('\n⚠️  Please refresh the page to see the changes.');
    } else {
      console.log('\n✅ No cleanup needed - all videos are valid!');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Run the cleanup
cleanupInvalidVideos();
