import { GeneratedVideo } from "./video-generation-types"

// Debug script to diagnose video display issues
// Add this to your page.tsx temporarily to debug

export function debugVideos(videos: GeneratedVideo[]) {
  console.group('🎥 Video Debug Information');
  
  console.log('Total videos:', videos.length);
  
  // Check for duplicates
  const idCounts = new Map<string, number>();
  videos.forEach(video => {
    idCounts.set(video.id, (idCounts.get(video.id) || 0) + 1);
  });
  
  const duplicates = Array.from(idCounts.entries()).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.error('❌ Duplicate video IDs found:', duplicates);
  } else {
    console.log('✅ No duplicate IDs');
  }
  
  // Check video data integrity
  videos.forEach((video, index) => {
    const issues = [];
    
    if (!video.id) issues.push('Missing ID');
    if (!video.status) issues.push('Missing status');
    if (!video.prompt) issues.push('Missing prompt');
    if (video.status === 'completed') {
      if (!video.url) {
        issues.push('Completed but no URL');
      } else if (video.url.startsWith('blob:')) {
        issues.push('URL is blob (temporary) - will not work after page reload');
      } else if (!video.url.startsWith('http')) {
        issues.push('Invalid URL format');
      }
    }
    
    if (issues.length > 0) {
      console.warn(`Video ${index} (${video.id}) has issues:`, issues);
      console.log('Video data:', video);
    }
  });
  
  // Group by status
  const byStatus = {
    generating: videos.filter(v => v.status === 'generating'),
    completed: videos.filter(v => v.status === 'completed'),
    failed: videos.filter(v => v.status === 'failed')
  };
  
  console.log('Videos by status:', {
    generating: byStatus.generating.length,
    completed: byStatus.completed.length,
    failed: byStatus.failed.length
  });
  
  // Check completed videos
  if (byStatus.completed.length > 0) {
    console.log('Completed videos:');
    byStatus.completed.forEach(video => {
      console.log(`- ${video.id}: ${video.url}`);
      if (video.url && video.url.startsWith('blob:')) {
        console.warn('  ⚠️  This video URL will expire when the page is reloaded!');
      }
    });
  }
  
  console.groupEnd();
}
