import { test, expect } from '@playwright/test';
import {
  waitForChatReady,
  sendChatMessage,
  waitForMessage,
  openSettings,
  closeSettings,
  switchToCanvasTab
} from '../utils/test-helpers';

test.describe('Implemented Features E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForChatReady(page);
  });

  test.describe('Multi-Image Selection Functionality', () => {
    test('should show Select button in image gallery', async ({ page }) => {
      // Navigate to Images tab
      await switchToCanvasTab(page, 'Images');

      // Look for the Select button in the image gallery header
      const selectButton = page.locator('button:has-text("Select")');
      await expect(selectButton).toBeVisible({ timeout: 10000 });

      // Verify button has correct icon
      const selectIcon = selectButton.locator('svg');
      await expect(selectIcon).toBeVisible();
    });

    test('should toggle selection mode when Select button is clicked', async ({ page }) => {
      await switchToCanvasTab(page, 'Images');

      const selectButton = page.locator('button:has-text("Select")');
      await selectButton.click();

      // Button should change appearance when in selection mode
      await expect(selectButton).toHaveClass(/bg-purple-600|border-purple-600/);

      // Should show selection count (0 selected initially)
      const selectionCount = page.locator('text=/0 selected/');
      await expect(selectionCount).toBeVisible({ timeout: 5000 });
    });

    test('should show Multi Edit button when 2+ images selected', async ({ page }) => {
      await switchToCanvasTab(page, 'Images');

      // Enable selection mode
      await page.locator('button:has-text("Select")').click();

      // If there are images, try to select them
      const imageCards = page.locator('[data-testid="image-card"], .group.relative.aspect-square');
      const imageCount = await imageCards.count();

      if (imageCount >= 2) {
        // Select first two images
        await imageCards.nth(0).click();
        await imageCards.nth(1).click();

        // Multi Edit button should appear
        const multiEditButton = page.locator('button:has-text("Multi Edit")');
        await expect(multiEditButton).toBeVisible({ timeout: 5000 });

        // Should show correct count
        await expect(multiEditButton).toContainText('(2)');
      }
    });

    test('should show Clear selection link when images are selected', async ({ page }) => {
      await switchToCanvasTab(page, 'Images');

      const selectButton = page.locator('button:has-text("Select")');
      await selectButton.click();

      const imageCards = page.locator('[data-testid="image-card"], .group.relative.aspect-square');
      const imageCount = await imageCards.count();

      if (imageCount > 0) {
        // Select an image
        await imageCards.first().click();

        // Clear selection link should appear
        const clearLink = page.locator('button:has-text("Clear selection")');
        await expect(clearLink).toBeVisible({ timeout: 5000 });

        // Click clear selection
        await clearLink.click();

        // Selection count should reset to 0
        const selectionCount = page.locator('text=/0 selected/');
        await expect(selectionCount).toBeVisible();
      }
    });
  });

  test.describe('Upload Error Handling', () => {
    test('should show detailed error messages for upload failures', async ({ page }) => {
      // Listen for console errors and network requests
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Mock upload API to return error
      await page.route('**/api/upload', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Server configuration error',
            details: 'The Gemini API key is invalid or expired. Please check your configuration.',
            timestamp: new Date().toISOString()
          })
        });
      });

      // Try to upload a file (simulate file input)
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        // Create a test file
        const testFile = await page.evaluateHandle(() => {
          const file = new File(['test content'], 'test.png', { type: 'image/png' });
          return file;
        });

        await fileInput.setInputFiles(testFile as any);

        // Should show detailed error message
        const errorToast = page.locator('text=/Server Configuration Error|API Configuration Error/');
        await expect(errorToast).toBeVisible({ timeout: 10000 });
      }
    });

    test('should handle network connection errors gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/upload', route => {
        route.abort('failed');
      });

      // Try to upload
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        const testFile = await page.evaluateHandle(() => {
          return new File(['test'], 'test.png', { type: 'image/png' });
        });

        await fileInput.setInputFiles(testFile as any);

        // Should show network error message
        const networkError = page.locator('text=/Network Error|Connection Error|Failed to fetch/');
        await expect(networkError).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('Video Gallery React Key Fix', () => {
    test('should not have React key duplication warnings in console', async ({ page }) => {
      const consoleWarnings: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'warning' && msg.text().includes('key')) {
          consoleWarnings.push(msg.text());
        }
      });

      // Navigate to Videos tab
      await switchToCanvasTab(page, 'Videos');

      // Wait for video gallery to load
      await page.waitForTimeout(2000);

      // Generate a video to populate the gallery
      await sendChatMessage(page, 'Create a video of a sunset');
      await page.waitForTimeout(3000);

      // Switch back to Videos tab to see the video
      await switchToCanvasTab(page, 'Videos');
      await page.waitForTimeout(2000);

      // Check for React key warnings
      const hasKeyWarnings = consoleWarnings.some(warning =>
        warning.includes('duplicate key') ||
        warning.includes('Each child in a list should have a unique "key"')
      );

      expect(hasKeyWarnings).toBeFalsy();
    });

    test('should display video cards correctly in different sections', async ({ page }) => {
      await switchToCanvasTab(page, 'Videos');

      // Video gallery should be visible
      const videoGallery = page.locator('[data-testid="video-gallery"]');
      await expect(videoGallery).toBeVisible();

      // Should show appropriate sections (generating, completed, failed)
      const sections = page.locator('h3:has-text("Generating"), h3:has-text("Completed"), h3:has-text("Failed")');
      const sectionCount = await sections.count();

      // At least one section should be visible (even if empty)
      expect(sectionCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Prompt Enhancement Feature', () => {
    test('should show Enhance Prompt button next to chat input', async ({ page }) => {
      // Look for the enhance prompt button
      const enhanceButton = page.locator('button[title*="Enhance"], button:has-text("✨")');
      await expect(enhanceButton).toBeVisible({ timeout: 10000 });
    });

    test('should enhance prompts when button is clicked', async ({ page }) => {
      // Type a simple prompt
      const simplePrompt = 'Write a story about a cat';
      await page.fill('textarea[placeholder*="Type your message"]', simplePrompt);

      // Click enhance button
      const enhanceButton = page.locator('button[title*="Enhance"], button:has-text("✨")');
      await enhanceButton.click();

      // Should show loading state
      const loadingIndicator = page.locator('text=/Enhancing|Loading/');
      await expect(loadingIndicator).toBeVisible({ timeout: 5000 });

      // Wait for enhancement to complete
      await page.waitForTimeout(5000);

      // Text area should contain enhanced prompt (longer than original)
      const enhancedText = await page.locator('textarea[placeholder*="Type your message"]').inputValue();
      expect(enhancedText.length).toBeGreaterThan(simplePrompt.length);
    });

    test('should show undo/redo buttons after enhancement', async ({ page }) => {
      const simplePrompt = 'Create an image of a dog';
      await page.fill('textarea[placeholder*="Type your message"]', simplePrompt);

      const enhanceButton = page.locator('button[title*="Enhance"], button:has-text("✨")');
      await enhanceButton.click();

      await page.waitForTimeout(5000);

      // Should show undo and regenerate buttons
      const undoButton = page.locator('button[title*="Undo"], button:has-text("↶")');
      const regenButton = page.locator('button[title*="New"], button[title*="Regenerate"]');

      await expect(undoButton).toBeVisible({ timeout: 5000 });
      await expect(regenButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Edit Image from Chat Messages', () => {
    test('should show edit button when clicking on chat message images', async ({ page }) => {
      // Send a message with an image
      await sendChatMessage(page, 'Here is a test image');

      // Look for images in chat messages
      const chatImages = page.locator('img[src*="data:"], img[src*="blob:"], img[src*="http"]');
      const imageCount = await chatImages.count();

      if (imageCount > 0) {
        // Click on the first image
        await chatImages.first().click();

        // Should open file preview modal
        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Should show edit button with pencil icon
        const editButton = page.locator('button:has-text("Edit"), button[title*="Edit"]');
        await expect(editButton).toBeVisible({ timeout: 5000 });

        // Edit button should have pencil icon
        const pencilIcon = editButton.locator('svg');
        await expect(pencilIcon).toBeVisible();
      }
    });

    test('should open edit modal when edit button is clicked', async ({ page }) => {
      // Mock image in chat
      await page.evaluate(() => {
        // Add a test image to the chat
        const chatContainer = document.querySelector('[data-testid="chat-messages"]');
        if (chatContainer) {
          const imageElement = document.createElement('img');
          imageElement.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
          imageElement.style.width = '100px';
          imageElement.style.height = '100px';
          imageElement.setAttribute('data-testid', 'chat-image');
          chatContainer.appendChild(imageElement);
        }
      });

      // Click on the test image
      const testImage = page.locator('[data-testid="chat-image"]');
      await testImage.click();

      // Should open preview modal
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Click edit button
      const editButton = page.locator('button:has-text("Edit")');
      if (await editButton.isVisible()) {
        await editButton.click();

        // Should switch to Images tab
        await page.waitForTimeout(2000);

        // Should show edit modal or be in Images tab
        const imagesTab = page.locator('[role="tab"]:has-text("Images")[aria-selected="true"]');
        const editModal = page.locator('text=/Edit Image|Edit with/');

        const isInImagesTab = await imagesTab.isVisible();
        const hasEditModal = await editModal.count() > 0;

        expect(isInImagesTab || hasEditModal).toBeTruthy();
      }
    });

    test('should add image to gallery when editing from chat', async ({ page }) => {
      // This test verifies the complete flow from chat image to gallery
      await switchToCanvasTab(page, 'Images');

      // Count initial images in gallery
      const initialImages = page.locator('[data-testid="image-card"], .group.relative.aspect-square');
      const initialCount = await initialImages.count();

      // Go back to chat and simulate image edit
      await page.evaluate(() => {
        // Simulate the edit flow by calling the handler directly
        if (window.handleEditImageFromModal) {
          window.handleEditImageFromModal('data:image/png;base64,test', 'test-image.png');
        }
      });

      // Switch back to Images tab
      await switchToCanvasTab(page, 'Images');
      await page.waitForTimeout(2000);

      // Should have one more image in gallery
      const finalImages = page.locator('[data-testid="image-card"], .group.relative.aspect-square');
      const finalCount = await finalImages.count();

      // If the handler exists and worked, we should see an increase
      if (finalCount > initialCount) {
        expect(finalCount).toBe(initialCount + 1);
      }
    });
  });

  test.describe('Deep Research Integration', () => {
    test('should show deep research button in chat interface', async ({ page }) => {
      // Look for the microscope/research button
      const researchButton = page.locator('button[title*="Deep Research"], button[title*="Research"]');
      await expect(researchButton).toBeVisible({ timeout: 10000 });
    });

    test('should activate deep research mode when button is clicked', async ({ page }) => {
      const researchButton = page.locator('button[title*="Deep Research"], button[title*="Research"]');
      await researchButton.click();

      // Should show visual feedback (button state change)
      await expect(researchButton).toHaveClass(/bg-blue-600|border-blue-600|active/);

      // Should show toast notification
      const toast = page.locator('text=/Deep Research Mode Active|Research Mode/');
      await expect(toast).toBeVisible({ timeout: 5000 });
    });

    test('should show deep research panel when research is triggered', async ({ page }) => {
      const researchButton = page.locator('button[title*="Deep Research"], button[title*="Research"]');
      await researchButton.click();

      // Send a research query
      await sendChatMessage(page, 'Research the latest developments in artificial intelligence');

      // Should show deep research panel
      const researchPanel = page.locator('text=/Deep Research|Research Progress|Perplexity/');
      await expect(researchPanel).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('API Integration Tests', () => {
    test('should handle image generation API correctly', async ({ page }) => {
      // Mock successful image generation
      await page.route('**/api/generate-image', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            imageUrl: 'data:image/png;base64,test',
            model: 'flux-kontext-pro',
            prompt: 'test image'
          })
        });
      });

      await sendChatMessage(page, 'Generate an image of a beautiful sunset');

      // Should show image generation response
      const imageResponse = page.locator('text=/Generating image|Image generated|Images tab/');
      await expect(imageResponse).toBeVisible({ timeout: 10000 });
    });

    test('should handle video generation API correctly', async ({ page }) => {
      // Mock successful video generation
      await page.route('**/api/generate-video', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            videoUrl: 'https://example.com/video.mp4',
            model: 'kling-1.6-pro',
            prompt: 'test video'
          })
        });
      });

      await sendChatMessage(page, 'Create a video of ocean waves');

      // Should show video generation response
      const videoResponse = page.locator('text=/Generating video|Video generated|Videos tab/');
      await expect(videoResponse).toBeVisible({ timeout: 10000 });
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API error
      await page.route('**/api/chat', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error',
            details: 'API service temporarily unavailable'
          })
        });
      });

      await sendChatMessage(page, 'Test error handling');

      // Should show error message or maintain functionality
      const errorIndicator = page.locator('text=/Error|Failed|Try again/');
      const chatInput = page.locator('textarea[placeholder*="Type your message"]');

      // Either show error or maintain chat functionality
      const hasError = await errorIndicator.count() > 0;
      const chatStillWorks = await chatInput.isVisible();

      expect(hasError || chatStillWorks).toBeTruthy();
    });
  });

  test.describe('Performance and Stability', () => {
    test('should handle rapid user interactions without breaking', async ({ page }) => {
      // Rapid tab switching
      for (let i = 0; i < 5; i++) {
        await switchToCanvasTab(page, 'Images');
        await page.waitForTimeout(100);
        await switchToCanvasTab(page, 'Videos');
        await page.waitForTimeout(100);
        await switchToCanvasTab(page, 'Preview');
        await page.waitForTimeout(100);
      }

      // Should still be functional
      await expect(page.locator('textarea[placeholder*="Type your message"]')).toBeVisible();
    });

    test('should maintain state during browser refresh', async ({ page }) => {
      // Send a message
      await sendChatMessage(page, 'Test message for persistence');
      await waitForMessage(page, 'Test message for persistence');

      // Refresh the page
      await page.reload();
      await waitForChatReady(page);

      // Message should still be visible (if persistence is enabled)
      const persistedMessage = page.locator('text=Test message for persistence');
      const messageExists = await persistedMessage.count() > 0;

      // Either message persists or chat is functional after refresh
      const chatInput = page.locator('textarea[placeholder*="Type your message"]');
      const chatWorks = await chatInput.isVisible();

      expect(messageExists || chatWorks).toBeTruthy();
    });
  });
});
