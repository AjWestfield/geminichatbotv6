// Debug script to understand image generation flow
console.log('🔍 Image Generation Debug Script Loaded');

// Monitor localStorage changes
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  if (key === 'generatedImages') {
    console.log('📦 LocalStorage updated:', {
      key,
      imageCount: JSON.parse(value || '[]').length,
      timestamp: new Date().toISOString()
    });
  }
  return originalSetItem.apply(this, arguments);
};

// Monitor fetch requests to image generation API
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (typeof url === 'string' && url.includes('/api/generate-image')) {
    console.log('🎨 Image generation API called:', url);
    return originalFetch.apply(this, args).then(response => {
      console.log('🎨 Image generation API response:', response.status);
      return response;
    });
  }
  return originalFetch.apply(this, arguments);
};

// Monitor IMAGE_GENERATION_COMPLETED markers in messages
let lastMessageContent = '';
setInterval(() => {
  // Find the chat messages container
  const messagesContainer = document.querySelector('[data-testid="chat-messages"]') || 
                           document.querySelector('.space-y-4') ||
                           document.querySelector('[class*="space-y"]');
  
  if (messagesContainer) {
    const messages = messagesContainer.querySelectorAll('[class*="rounded"]');
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage && lastMessage.textContent !== lastMessageContent) {
      lastMessageContent = lastMessage.textContent || '';
      
      if (lastMessageContent.includes('IMAGE_GENERATION_COMPLETED')) {
        console.log('🔍 Found IMAGE_GENERATION_COMPLETED marker in DOM');
        
        // Try to extract the marker content
        const match = lastMessageContent.match(/\[IMAGE_GENERATION_COMPLETED\]([\s\S]*?)\[\/IMAGE_GENERATION_COMPLETED\]/);
        if (match) {
          console.log('✅ Successfully extracted image data from marker');
          try {
            const imageData = JSON.parse(match[1]);
            console.log('📊 Image data:', {
              success: imageData.success,
              imageCount: imageData.images?.length,
              model: imageData.metadata?.model
            });
          } catch (e) {
            console.log('❌ Failed to parse image data:', e.message);
            console.log('📝 Raw marker content:', match[1].substring(0, 200) + '...');
          }
        } else {
          console.log('❌ Could not extract image data from marker');
          console.log('📝 Message content preview:', lastMessageContent.substring(0, 500) + '...');
        }
      }
    }
  }
}, 1000);

// Function to manually check current state
window.debugImageState = function() {
  console.log('\n=== CURRENT IMAGE STATE ===');
  
  // Check localStorage
  const localImages = JSON.parse(localStorage.getItem('generatedImages') || '[]');
  console.log('📦 LocalStorage images:', localImages.length);
  
  // Check if Images tab shows any images
  const imagesTab = document.querySelector('[data-value="images"]') || 
                   document.querySelector('[role="tab"][aria-selected="true"]');
  console.log('🖼️ Images tab active:', imagesTab?.getAttribute('aria-selected') === 'true');
  
  // Check for "Generating..." text
  const generatingText = document.querySelector('*:contains("Generating...")') ||
                        Array.from(document.querySelectorAll('*')).find(el => 
                          el.textContent?.includes('Generating...'));
  console.log('⏳ Shows "Generating...":', !!generatingText);
  
  // Check for actual image elements
  const imageElements = document.querySelectorAll('img[src*="blob:"], img[src*="data:"], img[src*="http"]');
  console.log('🖼️ Image elements found:', imageElements.length);
  
  console.log('\n=== RECENT MESSAGES ===');
  const messagesContainer = document.querySelector('[data-testid="chat-messages"]') || 
                           document.querySelector('.space-y-4');
  if (messagesContainer) {
    const messages = messagesContainer.querySelectorAll('[class*="rounded"]');
    const lastFewMessages = Array.from(messages).slice(-3);
    lastFewMessages.forEach((msg, i) => {
      const content = msg.textContent || '';
      console.log(`Message ${i + 1}:`, content.substring(0, 100) + '...');
      if (content.includes('IMAGE_GENERATION_COMPLETED')) {
        console.log('  ↳ Contains IMAGE_GENERATION_COMPLETED marker');
      }
    });
  }
  
  console.log('\nRun window.debugImageState() to check again');
};

console.log('🚀 Debug script ready. Run window.debugImageState() to check current state');
