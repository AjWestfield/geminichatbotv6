import { test, expect } from '@playwright/test';
import {
  waitForChatReady,
  fillChatInput,
  clickSendButton,
  sendChatMessage,
  waitForMessage,
  waitForAIResponse,
  openSettings,
  closeSettings,
  navigateToSettingsTab,
  switchToCanvasTab
} from '../utils/test-helpers';

test.describe('Core Functionality E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the chat interface to be ready
    await waitForChatReady(page);
  });

  test.describe('Chat Interface', () => {
    test('should load chat interface successfully', async ({ page }) => {
      // Verify main chat elements are present (already verified by waitForChatReady)
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="send-button"]')).toBeVisible();

      // Check for canvas tabs (the actual tabs in the UI)
      await expect(page.locator('[role="tab"]:has-text("Images")')).toBeVisible();
      await expect(page.locator('[role="tab"]:has-text("Videos")')).toBeVisible();
      await expect(page.locator('[role="tab"]:has-text("Preview")')).toBeVisible();

      // Verify AI Assistant heading is present
      await expect(page.locator('h1:has-text("AI Assistant")')).toBeVisible();
    });

    test('should send and receive basic chat message', async ({ page }) => {
      const testMessage = 'Hello, this is a test message';

      // Send message using helper
      await sendChatMessage(page, testMessage);

      // Verify message appears in chat
      await waitForMessage(page, testMessage);

      // Wait for AI response
      await waitForAIResponse(page);
    });

    test('should handle long messages gracefully', async ({ page }) => {
      const longMessage = 'This is a very long message that tests the chat interface handling of extended text content. '.repeat(10);

      await sendChatMessage(page, longMessage);

      // Verify message is sent and displayed
      await expect(page.locator('text=This is a very long message')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Settings Dialog', () => {
    test('should open and close settings dialog', async ({ page }) => {
      // Open settings using helper
      await openSettings(page);

      // Verify dialog is open
      await expect(page.locator('text=Settings')).toBeVisible();

      // Close settings using helper
      await closeSettings(page);
    });

    test('should navigate between settings tabs', async ({ page }) => {
      await openSettings(page);

      // Test different tabs
      const tabs = ['General', 'Image Generation', 'Video Generation', 'Audio Generation'];

      for (const tab of tabs) {
        const tabButton = page.locator(`button:has-text("${tab}")`);
        if (await tabButton.isVisible()) {
          await tabButton.click();
          await page.waitForTimeout(500); // Allow tab to load

          // Verify tab content is visible (basic check)
          await expect(page.locator('[role="dialog"]')).toBeVisible();
        }
      }

      await closeSettings(page);
    });
  });

  test.describe('Video Settings Persistence', () => {
    test('should persist video settings changes', async ({ page }) => {
      // Navigate to Video Generation settings
      await navigateToSettingsTab(page, 'Video Generation');

      // Change video model setting
      const modelSelect = page.locator('select').filter({ hasText: /standard|pro|fast/ }).first();
      if (await modelSelect.isVisible()) {
        await modelSelect.selectOption('pro');
      }

      // Change duration setting
      const durationSelect = page.locator('select').filter({ hasText: /5|10/ }).first();
      if (await durationSelect.isVisible()) {
        await durationSelect.selectOption('10');
      }

      // Close settings
      await closeSettings(page);

      // Reload page to test persistence
      await page.reload();
      await waitForChatReady(page);

      // Reopen settings and verify persistence
      await navigateToSettingsTab(page, 'Video Generation');

      // Verify settings were persisted
      if (await modelSelect.isVisible()) {
        await expect(modelSelect).toHaveValue('pro');
      }
      if (await durationSelect.isVisible()) {
        await expect(durationSelect).toHaveValue('10');
      }

      await closeSettings(page);
    });
  });

  test.describe('Tab Navigation', () => {
    test('should switch between canvas tabs', async ({ page }) => {
      const tabs = ['Images', 'Videos', 'Preview'];

      for (const tab of tabs) {
        await switchToCanvasTab(page, tab);

        // Verify tab is active using the selected attribute
        const activeTab = page.locator(`tab:has-text("${tab}")[selected], [role="tab"]:has-text("${tab}")[aria-selected="true"]`);
        await expect(activeTab).toBeVisible();
      }
    });

    test('should display appropriate content in each tab', async ({ page }) => {
      // Chat interface should always be visible (not a tab)
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();

      // Images tab
      await switchToCanvasTab(page, 'Images');
      // Should show image gallery or empty state
      const imageContent = page.locator('[data-testid="image-gallery"]');
      await expect(imageContent).toBeVisible({ timeout: 5000 });

      // Videos tab
      await switchToCanvasTab(page, 'Videos');
      // Should show video gallery or empty state
      const videoContent = page.locator('[data-testid="video-gallery"]');
      await expect(videoContent).toBeVisible({ timeout: 5000 });

      // Preview tab
      await switchToCanvasTab(page, 'Preview');
      // Should show preview content
      const previewContent = page.locator('text=Canvas Preview');
      await expect(previewContent).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept API calls and simulate network error
      await page.route('**/api/chat', route => {
        route.abort('failed');
      });

      // Try to send a message
      await sendChatMessage(page, 'Test network error');

      // Should show some error indication
      await page.waitForTimeout(3000);

      // Look for error messages or retry buttons
      const errorIndicators = page.locator('[data-testid="error"], .error');
      const hasError = await errorIndicators.count() > 0;

      // If no explicit error UI, at least verify the message didn't disappear
      if (!hasError) {
        await expect(page.locator('text=Test network error')).toBeVisible();
      }
    });

    test('should handle invalid input gracefully', async ({ page }) => {
      // Test with very long input
      const veryLongMessage = 'x'.repeat(10000);

      await sendChatMessage(page, veryLongMessage);

      // Should either send successfully or show appropriate error
      await page.waitForTimeout(2000);

      // Verify app is still functional
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Verify main elements are still accessible
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="send-button"]')).toBeVisible();

      // Test sending a message on mobile
      await sendChatMessage(page, 'Mobile test message');

      await waitForMessage(page, 'Mobile test message');
    });

    test('should work on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Verify layout adapts properly
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();

      // Test tab navigation on tablet
      await switchToCanvasTab(page, 'Images');
      await switchToCanvasTab(page, 'Videos');
      await switchToCanvasTab(page, 'Preview');

      // Should still be functional
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    });
  });
});
