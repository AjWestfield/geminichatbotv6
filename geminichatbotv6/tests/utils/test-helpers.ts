import { Page, expect } from '@playwright/test';

/**
 * Test helper utilities for reliable element selection and common operations
 */

/**
 * Wait for the chat interface to be ready for interaction
 */
export async function waitForChatReady(page: Page): Promise<void> {
  console.log('[Test Helper] Waiting for chat interface to be ready...');

  // Wait for the main heading to be visible
  await page.waitForSelector('text=AI Assistant', { timeout: 15000 });

  // Wait for the chat input to be visible and enabled using data-testid
  await page.waitForSelector('[data-testid="chat-input"]', {
    state: 'visible',
    timeout: 10000
  });

  // Wait for the send button to be visible using data-testid
  await page.waitForSelector('[data-testid="send-button"]', {
    state: 'visible',
    timeout: 5000
  });

  // Wait for any initial loading to complete
  await page.waitForTimeout(2000);

  console.log('[Test Helper] Chat interface is ready');
}

/**
 * Fill the chat input with text
 */
export async function fillChatInput(page: Page, text: string): Promise<void> {
  const chatInput = page.locator('[data-testid="chat-input"]');
  await chatInput.fill(text);
}

/**
 * Click the send message button
 */
export async function clickSendButton(page: Page): Promise<void> {
  await page.click('[data-testid="send-button"]');
}

/**
 * Send a chat message (fill input and click send)
 */
export async function sendChatMessage(page: Page, message: string): Promise<void> {
  await fillChatInput(page, message);
  await clickSendButton(page);
}

/**
 * Wait for a message to appear in the chat
 */
export async function waitForMessage(page: Page, messageText: string, timeout: number = 10000): Promise<void> {
  await expect(page.locator(`text=${messageText}`)).toBeVisible({ timeout });
}

/**
 * Wait for AI response (looks for any new message that's not the user's)
 */
export async function waitForAIResponse(page: Page, timeout: number = 15000): Promise<void> {
  // Wait for at least 2 messages (user + AI)
  const messages = page.locator('[data-testid="message"], .message, [role="article"]');
  await expect(messages).toHaveCount(2, { timeout });
}

/**
 * Open settings dialog
 */
export async function openSettings(page: Page): Promise<void> {
  await page.click('[data-testid="settings-button"]');
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
}

/**
 * Close settings dialog
 */
export async function closeSettings(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
}

/**
 * Navigate to a specific settings tab
 */
export async function navigateToSettingsTab(page: Page, tabName: string): Promise<void> {
  await openSettings(page);
  const tabButton = page.locator(`button:has-text("${tabName}")`);
  if (await tabButton.isVisible()) {
    await tabButton.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Switch to a canvas tab (Images, Videos, etc.)
 */
export async function switchToCanvasTab(page: Page, tabName: string): Promise<void> {
  // Use data-testid for more reliable tab selection where available
  const tabMap: Record<string, string> = {
    'Images': '[data-testid="images-tab"]',
    'Videos': '[data-testid="videos-tab"]',
    'Preview': '[role="tab"]:has-text("Preview")',
    'Code': '[role="tab"]:has-text("Code")',
    'Browser': '[role="tab"]:has-text("Browser")',
    'Audio': '[role="tab"]:has-text("Audio")',
    'Docs': '[role="tab"]:has-text("Docs")'
  };

  const selector = tabMap[tabName] || `[role="tab"]:has-text("${tabName}")`;

  await page.click(selector);
  await page.waitForTimeout(1000);
}

/**
 * Check if element exists without throwing
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    const element = page.locator(selector);
    return await element.count() > 0;
  } catch {
    return false;
  }
}
