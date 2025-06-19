#!/usr/bin/env node

// Debug script to test video deletion in browser console

console.log('=== Video Deletion Debug Script ===\n');

// Function to check videos in storage
function checkVideos() {
  const videos = JSON.parse(localStorage.getItem('gemini-chat-videos') || '[]');
  console.log('\n📹 Current videos in localStorage:');
  console.log('Total:', videos.length);
  videos.forEach((v, i) => {
    console.log(`${i + 1}. ${v.id} - ${v.prompt?.substring(0, 30)}... (${v.status})`);
  });
  return videos;
}

// Function to manually delete a video
function deleteVideoManually(videoId) {
  console.log(`\n🗑️ Manually deleting video: ${videoId}`);
  
  // Get current videos
  const videos = JSON.parse(localStorage.getItem('gemini-chat-videos') || '[]');
  console.log('Videos before:', videos.length);
  
  // Filter out the video
  const filtered = videos.filter(v => v.id !== videoId);
  console.log('Videos after filter:', filtered.length);
  
  // Save back
  localStorage.setItem('gemini-chat-videos', JSON.stringify(filtered));
  console.log('✅ Saved to localStorage');
  
  // Verify
  const afterVideos = JSON.parse(localStorage.getItem('gemini-chat-videos') || '[]');
  console.log('Verification - videos now:', afterVideos.length);
  
  return filtered;
}

// Instructions
console.log('Commands to run:\n');
console.log('1. Check current videos:');
console.log('   checkVideos();\n');
console.log('2. Delete a specific video:');
console.log('   deleteVideoManually("video-id-here");\n');
console.log('3. Clear all videos:');
console.log('   localStorage.setItem("gemini-chat-videos", "[]");\n');
console.log('4. Watch for handleGeneratedVideosChange calls:');
console.log('   // Look for [PAGE] debug logs in console\n');

// Export functions to window for easy access
window.checkVideos = checkVideos;
window.deleteVideoManually = deleteVideoManually;

// Initial check
checkVideos();
