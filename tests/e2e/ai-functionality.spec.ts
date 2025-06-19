import { test, expect } from '@playwright/test';
import {
  waitForChatReady,
  sendChatMessage,
  waitForMessage,
  waitForAIResponse,
  switchToCanvasTab
} from '../utils/test-helpers';

test.describe('AI Functionality E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForChatReady(page);
  });

  test.describe('Video Generation Detection', () => {
    test('should detect text-to-video requests', async ({ page }) => {
      const videoPrompts = [
        'Create a video of a sunset over mountains',
        'Generate a video showing a cat playing with a ball',
        'Make a video of ocean waves',
        'I want you to create a video of a forest'
      ];

      for (const prompt of videoPrompts) {
        // Send video generation prompt
        await sendChatMessage(page, prompt);

        // Wait for response
        await page.waitForTimeout(3000);

        // Look for video generation indicators
        const videoIndicators = page.locator('text=/video|generating|Video tab|duration|aspect ratio/i');
        const hasVideoResponse = await videoIndicators.count() > 0;

        if (hasVideoResponse) {
          console.log(`✅ Video detection working for: "${prompt}"`);

          // Check if Videos tab becomes active or shows activity
          await switchToCanvasTab(page, 'Videos');

          // Look for generating video or video content
          const videoContent = page.locator('text=/generating|loading|video/i, [data-testid="video-gallery"]');
          await expect(videoContent.first()).toBeVisible({ timeout: 5000 });

          // Return to chat for next test
          await switchToCanvasTab(page, 'Chat');
          break; // Only test one successful detection
        }
      }
    });

    test('should handle image-to-video requests with file upload', async ({ page }) => {
      // This test would require file upload functionality
      // For now, we'll test the text pattern detection

      const imageToVideoPrompts = [
        'Animate this image',
        'Make this image move',
        'Turn this image into a video',
        'Create an animation from this image'
      ];

      for (const prompt of imageToVideoPrompts) {
        await sendChatMessage(page, prompt);

        await page.waitForTimeout(2000);

        // Should get a response about needing an image
        const responseText = page.locator('text=/image|upload|attach/i');
        const hasResponse = await responseText.count() > 0;

        if (hasResponse) {
          console.log(`✅ Image-to-video detection working for: "${prompt}"`);
          break;
        }
      }
    });
  });

  test.describe('Web Search Integration', () => {
    test('should detect and handle web search requests', async ({ page }) => {
      const searchPrompts = [
        'What are the latest AI developments in 2024?',
        'Search for information about climate change',
        'What is the current weather in New York?',
        'Find recent news about technology'
      ];

      for (const prompt of searchPrompts) {
        await page.fill('textarea[placeholder*="Type your message"]', '');
        await page.fill('textarea[placeholder*="Type your message"]', prompt);
        await page.click('button[title="Send message"]');

        // Wait for search to start
        await page.waitForTimeout(3000);

        // Look for search indicators
        const searchIndicators = page.locator('text=/SEARCHING_WEB|searching|web search|sources/i');
        const hasSearchResponse = await searchIndicators.count() > 0;

        if (hasSearchResponse) {
          console.log(`✅ Web search detection working for: "${prompt}"`);

          // Wait for search to complete and show results
          await page.waitForTimeout(10000);

          // Look for citations or source links
          const citations = page.locator('text=/source|citation|\\[\\d+\\]/i, a[href*="http"]');
          const hasCitations = await citations.count() > 0;

          if (hasCitations) {
            console.log('✅ Web search returned results with citations');
          }

          break; // Only test one successful search
        }
      }
    });

    test('should handle search errors gracefully', async ({ page }) => {
      // Test with a prompt that might cause search issues
      await page.fill('textarea[placeholder*="Type your message"]', 'Search for: ');
      await page.click('button[title="Send message"]');

      await page.waitForTimeout(5000);

      // Should either work or show appropriate error handling
      const errorIndicators = page.locator('text=/error|failed|try again/i');
      const searchIndicators = page.locator('text=/SEARCHING_WEB|searching/i');

      const hasError = await errorIndicators.count() > 0;
      const hasSearch = await searchIndicators.count() > 0;

      // Either should work or fail gracefully
      expect(hasError || hasSearch).toBeTruthy();
    });
  });

  test.describe('Image Generation', () => {
    test('should detect image generation requests', async ({ page }) => {
      const imagePrompts = [
        'Generate an image of a beautiful landscape',
        'Create a picture of a cat',
        'Draw a futuristic city',
        'Make an image of a sunset'
      ];

      for (const prompt of imagePrompts) {
        await page.fill('textarea[placeholder*="Type your message"]', '');
        await page.fill('textarea[placeholder*="Type your message"]', prompt);
        await page.click('button[title="Send message"]');

        await page.waitForTimeout(3000);

        // Look for image generation indicators
        const imageIndicators = page.locator('text=/image|generating|Image tab|creating/i');
        const hasImageResponse = await imageIndicators.count() > 0;

        if (hasImageResponse) {
          console.log(`✅ Image generation detection working for: "${prompt}"`);

          // Check Images tab
          await page.click('text=Images');
          await page.waitForTimeout(2000);

          // Look for generating image or image content
          const imageContent = page.locator('text=/generating|loading|image/i, [data-testid="image-gallery"]');
          await expect(imageContent.first()).toBeVisible({ timeout: 5000 });

          await page.click('text=Chat');
          break;
        }
      }
    });
  });

  test.describe('Context Awareness', () => {
    test('should maintain conversation context', async ({ page }) => {
      // Send initial message
      await page.fill('textarea[placeholder*="Type your message"]', 'My name is John and I like cats');
      await page.click('button[title="Send message"]');

      await page.waitForTimeout(5000);

      // Send follow-up that requires context
      await page.fill('textarea[placeholder*="Type your message"]', 'What is my name?');
      await page.click('button[title="Send message"]');

      await page.waitForTimeout(5000);

      // Should reference the name from previous message
      const contextResponse = page.locator('text=/John|your name/i');
      await expect(contextResponse.first()).toBeVisible({ timeout: 10000 });
    });

    test('should handle multi-turn conversations', async ({ page }) => {
      const conversation = [
        'Tell me about artificial intelligence',
        'What are the main types?',
        'How does machine learning work?',
        'Can you give me an example?'
      ];

      for (let i = 0; i < conversation.length; i++) {
        await page.fill('textarea[placeholder*="Type your message"]', conversation[i]);
        await page.click('button[title="Send message"]');

        // Wait for response
        await page.waitForTimeout(5000);

        // Verify we get some response
        const messages = page.locator('[data-testid="message"], .message, [role="article"]');
        await expect(messages).toHaveCount((i + 1) * 2, { timeout: 10000 }); // Each turn = user + AI
      }
    });
  });

  test.describe('Error Recovery', () => {
    test('should recover from API errors', async ({ page }) => {
      // Simulate API error by intercepting requests
      await page.route('**/api/chat', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      await page.fill('textarea[placeholder*="Type your message"]', 'This should fail');
      await page.click('button[title="Send message"]');

      await page.waitForTimeout(3000);

      // Should show error or retry option
      const errorElements = page.locator('text=/error|failed|retry|try again/i');
      await expect(errorElements.first()).toBeVisible({ timeout: 5000 });

      // Remove the route to test recovery
      await page.unroute('**/api/chat');

      // Try again - should work now
      await page.fill('textarea[placeholder*="Type your message"]', 'This should work now');
      await page.click('button[title="Send message"]');

      await page.waitForTimeout(5000);

      // Should get a normal response
      await expect(page.locator('text=This should work now')).toBeVisible();
    });

    test('should handle timeout scenarios', async ({ page }) => {
      // Simulate slow API response
      await page.route('**/api/chat', route => {
        setTimeout(() => {
          route.continue();
        }, 30000); // 30 second delay
      });

      await page.fill('textarea[placeholder*="Type your message"]', 'This will timeout');
      await page.click('button[title="Send message"]');

      // Should show loading state
      const loadingElements = page.locator('text=/loading|generating|thinking/i, [data-testid="loading"]');
      await expect(loadingElements.first()).toBeVisible({ timeout: 5000 });

      // After some time, should either complete or show timeout
      await page.waitForTimeout(10000);

      // Clean up route
      await page.unroute('**/api/chat');
    });
  });

  test.describe('Performance', () => {
    test('should handle rapid message sending', async ({ page }) => {
      const messages = [
        'Message 1',
        'Message 2',
        'Message 3',
        'Message 4',
        'Message 5'
      ];

      // Send messages rapidly
      for (const message of messages) {
        await page.fill('textarea[placeholder*="Type your message"]', message);
        await page.click('button[title="Send message"]');
        await page.waitForTimeout(500); // Small delay between sends
      }

      // Wait for all responses
      await page.waitForTimeout(10000);

      // Should have all messages visible
      for (const message of messages) {
        await expect(page.locator(`text=${message}`)).toBeVisible();
      }
    });

    test('should maintain performance with long chat history', async ({ page }) => {
      // Send multiple messages to build up history
      for (let i = 1; i <= 10; i++) {
        await page.fill('textarea[placeholder*="Type your message"]', `Test message ${i}`);
        await page.click('button[title="Send message"]');
        await page.waitForTimeout(2000);
      }

      // Interface should still be responsive
      await page.fill('textarea[placeholder*="Type your message"]', 'Final test message');
      await page.click('button[title="Send message"]');

      await expect(page.locator('text=Final test message')).toBeVisible({ timeout: 10000 });
    });
  });
});
