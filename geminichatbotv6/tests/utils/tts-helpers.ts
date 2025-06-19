/**
 * Test helper utilities for TTS e2e tests
 * Provides reusable functions for testing TTS functionality
 */

import { Page, expect, Locator } from '@playwright/test';

export interface TTSGenerationResult {
  success: boolean;
  audioData?: string;
  duration?: number;
  error?: string;
  speakers?: number;
}

export interface AudioPlayerElements {
  container: Locator;
  playButton: Locator;
  pauseButton: Locator;
  volumeSlider: Locator;
  downloadButton: Locator;
  timestamp: Locator;
  audioElement: Locator;
}

/**
 * Navigate to the app and wait for it to load
 */
export async function navigateToApp(page: Page): Promise<void> {
  await page.goto('/');
  
  // Wait for the main app to load - look for chat interface
  await page.waitForSelector('textarea[placeholder*="What can I do for you"]', { timeout: 10000 });
  
  // Also wait for any loading states to complete
  await page.waitForTimeout(1000);
  
  console.log('[TTS Helper] App loaded successfully');
}

/**
 * Submit a TTS command through the chat interface
 */
export async function submitTTSCommand(page: Page, command: string): Promise<void> {
  console.log(`[TTS Helper] Submitting command: ${command}`);
  
  // Find the chat input
  const input = page.locator('textarea[placeholder*="What can I do for you"]').first();
  await input.click();
  await input.clear();
  await input.fill(command);
  
  // Submit the message
  await input.press('Enter');
  
  console.log('[TTS Helper] Command submitted');
}

/**
 * Wait for AI response to appear
 */
export async function waitForAIResponse(page: Page, timeout: number = 15000): Promise<void> {
  console.log('[TTS Helper] Waiting for AI response...');
  
  // Count existing AI responses before waiting
  const initialCount = await page.locator('.flex.justify-start .bg-\\[\\#2B2B2B\\]').count();
  console.log(`[TTS Helper] Initial AI response count: ${initialCount}`);
  
  // Wait for a new AI response to appear (count increases)
  await page.waitForFunction(
    (expectedCount) => {
      const currentCount = document.querySelectorAll('.flex.justify-start .bg-\\[\\#2B2B2B\\]').length;
      return currentCount > expectedCount;
    },
    initialCount,
    { timeout }
  );
  
  // Wait a bit longer to ensure response is complete
  await page.waitForTimeout(2000);
  
  const finalCount = await page.locator('.flex.justify-start .bg-\\[\\#2B2B2B\\]').count();
  console.log(`[TTS Helper] New AI response received. Final count: ${finalCount}`);
}

/**
 * Wait for TTS generation to complete
 */
export async function waitForTTSGeneration(page: Page, timeout: number = 60000): Promise<TTSGenerationResult> {
  console.log('[TTS Helper] Waiting for TTS generation...');
  
  const startTime = Date.now();
  
  try {
    // First, wait for "Generating audio..." indicator to appear (with emoji)
    console.log('[TTS Helper] Waiting for generation to start...');
    await page.waitForSelector(':has-text("🎙️ Generating audio")', { timeout: 10000 });
    console.log('[TTS Helper] TTS generation started');
    
    // Wait for the generation process to complete by watching for the indicator to disappear
    // and audio elements to appear
    await page.waitForFunction(
      () => {
        // Check if generation is still in progress using text content
        const allElements = document.querySelectorAll('*');
        let isGenerating = false;
        for (const el of allElements) {
          if (el.textContent && (
            el.textContent.includes('🎙️ Generating audio') ||
            el.textContent.includes('Generating Audio') ||
            el.textContent.includes('Processing with WaveSpeed') ||
            el.textContent.includes('Initializing WaveSpeed')
          )) {
            isGenerating = true;
            break;
          }
        }
        if (isGenerating) return false; // Still generating
        
        // Check if audio elements exist
        const audioElements = document.querySelectorAll('audio[src*="data:audio"], audio[src*="blob:"]');
        if (audioElements.length > 0) return true;
        
        // Check for audio player cards
        const audioCards = document.querySelectorAll('.audio-player-card, [data-testid="audio-player"]');
        if (audioCards.length > 0) return true;
        
        // Check if we're still on audio tab with content
        const audioTab = document.querySelector('button[aria-selected="true"]');
        if (audioTab && audioTab.textContent && audioTab.textContent.includes('Audio')) {
          // Look for any audio-related content
          const audioContent = document.querySelector('.audio-gallery, .generated-audio');
          return audioContent !== null;
        }
        
        return false;
      },
      { timeout }
    );

    const duration = Date.now() - startTime;
    console.log(`[TTS Helper] TTS generation completed in ${duration}ms`);
    
    return {
      success: true,
      duration,
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`[TTS Helper] TTS generation failed after ${duration}ms: ${error}`);
    
    // Take debug screenshot on failure
    await page.screenshot({ path: `debug-tts-generation-failed-${Date.now()}.png` });
    
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Verify that the audio tab is active and switched to
 */
export async function verifyAudioTabSwitch(page: Page): Promise<void> {
  console.log('[TTS Helper] Verifying audio tab switch...');
  
  // Wait for audio tab to be active
  await page.waitForSelector('button:has-text("Audio")[aria-selected="true"]', {
    timeout: 10000
  });
  
  // Verify audio tab content is visible
  await expect(page.locator('button:has-text("Audio")[aria-selected="true"]')).toBeVisible();
  
  console.log('[TTS Helper] Audio tab is active');
}

/**
 * Get audio player elements for testing
 */
export async function getAudioPlayerElements(page: Page): Promise<AudioPlayerElements> {
  console.log('[TTS Helper] Getting audio player elements...');
  
  // Wait for audio player to appear - look for the actual audio ready container
  await page.waitForSelector('h3:has-text("Audio Ready"), :has-text("00:"), button[aria-label*="play"], button:has(svg)', {
    timeout: 10000
  });
  
  const container = page.locator('h3:has-text("Audio Ready")').locator('..').first(); // Get parent of heading
  
  return {
    container,
    playButton: container.locator('button:has(svg), button[aria-label*="play"], button[aria-label*="Play"]').first(),
    pauseButton: container.locator('button:has(svg), button[aria-label*="pause"], button[aria-label*="Pause"]').first(),
    volumeSlider: container.locator('input[type="range"], [role="slider"]').first(),
    downloadButton: container.locator('button:has-text("Download"), button[aria-label*="Download"], button:has(svg[data-icon="download"])').first(),
    timestamp: container.locator(':has-text("00:"), :has-text("Duration"), .timestamp').first(),
    audioElement: page.locator('audio').first() // Audio element might be outside the container
  };
}

/**
 * Verify audio player functionality
 */
export async function verifyAudioPlayerElements(page: Page): Promise<void> {
  console.log('[TTS Helper] Verifying audio player elements...');
  
  // Simply verify that audio content exists by checking for key indicators
  // Look for audio duration/timestamp which indicates audio is loaded
  await expect(page.locator(':has-text("00:")').first()).toBeVisible();
  
  // Look for any audio elements on the page (they might be created dynamically)
  const audioCount = await page.locator('audio').count();
  console.log(`[TTS Helper] Found ${audioCount} audio elements on page`);
  
  // Verify we have audio-related content indicating successful generation
  const hasAudioContent = await page.locator(':has-text("Multi-Speaker"), :has-text("WaveSpeed"), :has-text("Audio Ready")').count();
  expect(hasAudioContent).toBeGreaterThan(0);
  
  // Look for play controls (any button with SVG is likely a play button)
  const playControls = await page.locator('button:has(svg)').count();
  console.log(`[TTS Helper] Found ${playControls} control buttons`);
  expect(playControls).toBeGreaterThan(0);
  
  console.log('[TTS Helper] Audio player elements verified');
}

/**
 * Test audio playback functionality
 */
export async function testAudioPlayback(page: Page): Promise<void> {
  console.log('[TTS Helper] Testing audio playback...');
  
  const elements = await getAudioPlayerElements(page);
  
  // Click play button
  await elements.playButton.click();
  
  // Wait a moment for audio to start
  await page.waitForTimeout(1000);
  
  // Verify audio is playing
  const isPlaying = await page.evaluate(() => {
    const audioElements = document.querySelectorAll('audio');
    return Array.from(audioElements).some(audio => !audio.paused);
  });
  
  expect(isPlaying).toBe(true);
  console.log('[TTS Helper] Audio playback verified');
  
  // Test pause functionality
  if (await elements.pauseButton.isVisible()) {
    await elements.pauseButton.click();
    await page.waitForTimeout(500);
    
    const isPaused = await page.evaluate(() => {
      const audioElements = document.querySelectorAll('audio');
      return Array.from(audioElements).every(audio => audio.paused);
    });
    
    expect(isPaused).toBe(true);
    console.log('[TTS Helper] Audio pause verified');
  }
}

/**
 * Verify multi-speaker format in generated audio
 */
export async function verifyMultiSpeakerFormat(page: Page, expectedSpeakers: number): Promise<void> {
  console.log(`[TTS Helper] Verifying multi-speaker format (expected: ${expectedSpeakers} speakers)...`);
  
  // Look for multi-speaker indicators in the UI
  const multiSpeakerIndicator = page.locator('[data-testid="multi-speaker"], .multi-speaker, :has-text("Multi-Speaker")');
  
  if (expectedSpeakers > 1) {
    await expect(multiSpeakerIndicator).toBeVisible();
    console.log('[TTS Helper] Multi-speaker indicator found');
  }
  
  // Check if the generated audio metadata indicates multi-speaker
  const audioData = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      if (script.textContent?.includes('isMultiSpeaker')) {
        return script.textContent;
      }
    }
    return null;
  });
  
  if (audioData && expectedSpeakers > 1) {
    expect(audioData).toContain('isMultiSpeaker');
    console.log('[TTS Helper] Multi-speaker metadata verified');
  }
}

/**
 * Verify purple multi-speaker button functionality
 */
export async function verifyMultiSpeakerButton(page: Page): Promise<void> {
  console.log('[TTS Helper] Verifying multi-speaker button...');
  
  // Navigate to audio tab first
  await page.click('button:has-text("Audio")');
  
  // Look for the purple multi-speaker button
  const multiSpeakerButton = page.locator('button:has-text("Multi-Speaker"), button:has-text("Create Multi-Speaker")').first();
  
  await expect(multiSpeakerButton).toBeVisible();
  
  // Verify button has purple styling
  const buttonClass = await multiSpeakerButton.getAttribute('class');
  expect(buttonClass).toMatch(/purple|bg-purple/);
  
  // Test button click opens dialog
  await multiSpeakerButton.click();
  
  // Wait for dialog to open
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  
  console.log('[TTS Helper] Multi-speaker button verified');
  
  // Close dialog
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

/**
 * Monitor network requests for TTS data
 */
export async function monitorTTSNetworkRequests(page: Page): Promise<void> {
  console.log('[TTS Helper] Setting up network monitoring...');
  
  page.on('request', request => {
    if (request.url().includes('/api/chat') || request.url().includes('/api/generate-speech')) {
      console.log(`[Network] Request: ${request.method()} ${request.url()}`);
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/chat') || response.url().includes('/api/generate-speech')) {
      console.log(`[Network] Response: ${response.status()} ${response.url()}`);
    }
  });
}

/**
 * Capture screenshot for debugging
 */
export async function captureDebugScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `debug-${name}-${timestamp}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`[TTS Helper] Debug screenshot saved: ${filename}`);
}

/**
 * Clean up audio state between tests
 */
export async function cleanupAudioState(page: Page): Promise<void> {
  console.log('[TTS Helper] Cleaning up audio state...');
  
  // Stop any playing audio
  await page.evaluate(() => {
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  });
  
  // Clear any TTS-related local storage
  await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes('audio') || key.includes('tts')) {
        localStorage.removeItem(key);
      }
    });
  });
}