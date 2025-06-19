import { test, expect } from '@playwright/test'

test.describe('Audio Volume Control Test', () => {
  test('volume slider should not interrupt audio playback', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`[BROWSER LOG ${msg.type()}]:`, msg.text())
    })
    
    // Navigate to the app
    await page.goto('http://localhost:3000')
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="chat-input"], textarea')
    
    // Type a message that will generate audio
    const input = await page.locator('[data-testid="chat-input"], textarea').first()
    await input.click()
    await input.fill('Please say: Testing audio volume control. One two three four five.')
    await input.press('Enter')
    
    // Wait for response
    await page.waitForTimeout(3000)
    
    // Switch to Audio tab
    await page.click('text=Audio')
    
    // Wait for audio to be generated
    await page.waitForTimeout(5000)
    
    // Look for audio player
    const audioPlayer = await page.locator('[data-testid="audio-player"], .audio-player-card, [class*="audio"]').first()
    
    if (await audioPlayer.count() > 0) {
      console.log('Audio player found')
      
      // Click play button
      const playButton = await audioPlayer.locator('button:has-text("Play"), button:has(svg[class*="play"]), [aria-label="Play"]').first()
      await playButton.click()
      
      // Wait for audio to start playing
      await page.waitForTimeout(1000)
      
      // Check if audio is playing by monitoring console logs
      const volumeSlider = await audioPlayer.locator('input[type="range"], [role="slider"]').nth(1) // Second slider is volume
      
      if (await volumeSlider.count() > 0) {
        console.log('Volume slider found')
        
        // Get initial volume
        const initialVolume = await volumeSlider.evaluate(el => (el as HTMLInputElement).value)
        console.log('Initial volume:', initialVolume)
        
        // Drag volume slider multiple times
        for (let i = 0; i < 5; i++) {
          await page.waitForTimeout(500)
          
          // Drag slider to different positions
          const newValue = 0.2 + (i * 0.15)
          await volumeSlider.evaluate((el, val) => {
            (el as HTMLInputElement).value = String(val)
            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))
          }, newValue)
          
          console.log(`Set volume to: ${newValue}`)
          
          // Check if audio is still playing
          const isPlaying = await page.evaluate(() => {
            const audioElements = document.querySelectorAll('audio')
            return Array.from(audioElements).some(audio => !audio.paused)
          })
          
          console.log(`Audio still playing: ${isPlaying}`)
          expect(isPlaying).toBe(true)
        }
      } else {
        console.log('Volume slider not found')
      }
    } else {
      console.log('Audio player not found - checking for audio generation issues')
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'audio-test-debug.png', fullPage: true })
    }
  })
})
