import { test, expect } from '@playwright/test';
import { 
  navigateToApp,
  submitTTSCommand,
  waitForAIResponse,
  waitForTTSGeneration,
  verifyAudioTabSwitch,
  verifyAudioPlayerElements,
  testAudioPlayback,
  verifyMultiSpeakerFormat,
  verifyMultiSpeakerButton,
  monitorTTSNetworkRequests,
  captureDebugScreenshot,
  cleanupAudioState
} from '../utils/tts-helpers';
import { 
  TTS_TEST_SCRIPTS, 
  TTS_ERROR_TEST_CASES, 
  countSpeakers 
} from '../data/tts-scripts';

test.describe('TTS Multi-Speaker Functionality', () => {
  
  test.beforeEach(async ({ page }) => {
    console.log('🧪 Starting TTS test setup...');
    
    // Set up network monitoring
    await monitorTTSNetworkRequests(page);
    
    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[BROWSER ERROR] ${msg.text()}`);
      } else if (msg.text().includes('TTS') || msg.text().includes('audio')) {
        console.log(`[BROWSER LOG] ${msg.text()}`);
      }
    });
    
    // Navigate to app
    await navigateToApp(page);
    
    // Clean up any existing audio state
    await cleanupAudioState(page);
    
    console.log('✅ TTS test setup complete');
  });

  test.afterEach(async ({ page }) => {
    // Clean up after each test
    await cleanupAudioState(page);
  });

  test('should generate multi-speaker TTS and display in audio tab', async ({ page }) => {
    const testScript = TTS_TEST_SCRIPTS[0]; // Basic dialogue
    console.log(`🎭 Testing: ${testScript.name}`);
    
    // Submit TTS command
    await submitTTSCommand(page, testScript.command);
    
    // Wait for TTS generation (this includes waiting for the process to start and complete)
    const result = await waitForTTSGeneration(page);
    expect(result.success).toBe(true);
    
    // Verify automatic switch to audio tab
    await verifyAudioTabSwitch(page);
    
    // Verify audio player elements
    await verifyAudioPlayerElements(page);
    
    // Verify multi-speaker format
    const expectedSpeakers = countSpeakers(testScript.script);
    await verifyMultiSpeakerFormat(page, expectedSpeakers);
    
    console.log('✅ Multi-speaker TTS generation test passed');
  });

  test('should display purple multi-speaker button and dialog', async ({ page }) => {
    console.log('🟣 Testing purple multi-speaker button functionality');
    
    // Navigate to audio tab
    await page.click('button:has-text("Audio")');
    
    // Test multi-speaker button functionality
    await verifyMultiSpeakerButton(page);
    
    console.log('✅ Purple multi-speaker button test passed');
  });

  test('should handle single speaker fallback', async ({ page }) => {
    console.log('👤 Testing single speaker fallback');
    
    const fallbackCase = TTS_ERROR_TEST_CASES[1]; // Single speaker fallback
    
    await submitTTSCommand(page, fallbackCase.command);
    
    const result = await waitForTTSGeneration(page);
    expect(result.success).toBe(true);
    
    await verifyAudioTabSwitch(page);
    await verifyAudioPlayerElements(page);
    
    // Should show single speaker (not multi-speaker)
    await verifyMultiSpeakerFormat(page, 1);
    
    console.log('✅ Single speaker fallback test passed');
  });

  test.afterAll(async () => {
    console.log('🧹 TTS test suite completed');
  });
});