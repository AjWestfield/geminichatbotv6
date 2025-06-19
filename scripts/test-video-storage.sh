#!/bin/bash

# Script to test video functionality in the browser console
# Copy and paste this into your browser console

echo "Testing video functionality..."
echo "1. Check localStorage for videos:"
echo "   Run: localStorage.getItem('gemini-chat-videos')"
echo ""
echo "2. Parse and inspect videos:"
echo "   Run the following:"

cat << 'EOF'
// Get videos from localStorage
const videosJson = localStorage.getItem('gemini-chat-videos');
if (videosJson) {
  const videos = JSON.parse(videosJson);
  console.log('Total videos:', videos.length);
  
  videos.forEach((video, index) => {
    console.log(`\nVideo ${index + 1}:`);
    console.log('  ID:', video.id);
    console.log('  Status:', video.status);
    console.log('  URL:', video.url);
    console.log('  URL valid:', video.url && !video.url.startsWith('blob:'));
    console.log('  Prompt:', video.prompt?.substring(0, 50) + '...');
    
    if (video.url && video.url.startsWith('blob:')) {
      console.warn('  ⚠️  This video has a blob URL that is no longer valid!');
    }
  });
  
  // Check for blob URLs
  const blobVideos = videos.filter(v => v.url && v.url.startsWith('blob:'));
  if (blobVideos.length > 0) {
    console.warn(`\n⚠️  Found ${blobVideos.length} videos with invalid blob URLs`);
  }
} else {
  console.log('No videos found in localStorage');
}
EOF

echo ""
echo "3. To clear invalid videos from localStorage:"
cat << 'EOF'
// Remove videos with blob URLs
const videosJson = localStorage.getItem('gemini-chat-videos');
if (videosJson) {
  const videos = JSON.parse(videosJson);
  const validVideos = videos.filter(v => {
    if (v.status === 'completed' && v.url && v.url.startsWith('blob:')) {
      console.log('Removing video with blob URL:', v.id);
      return false;
    }
    return true;
  });
  
  localStorage.setItem('gemini-chat-videos', JSON.stringify(validVideos));
  console.log(`Cleaned up. Kept ${validVideos.length} valid videos.`);
  console.log('Refresh the page to see the changes.');
}
EOF
