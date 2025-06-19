"use client"

import { useState } from "react"
import { AudioPlayerCard } from "@/components/audio-player-card"
import { Button } from "@/components/ui/button"

// Test audio data - a simple sine wave tone
function generateTestAudio(): string {
  const sampleRate = 44100
  const duration = 30 // 30 seconds
  const frequency = 440 // A4 note
  const samples = sampleRate * duration
  
  // WAV header
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  
  // "RIFF" chunk descriptor
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size
  view.setUint16(20, 1, true) // AudioFormat (PCM)
  view.setUint16(22, 1, true) // NumChannels
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // ByteRate
  view.setUint16(32, 2, true) // BlockAlign
  view.setUint16(34, 16, true) // BitsPerSample
  writeString(36, 'data')
  view.setUint32(40, samples * 2, true)
  
  // Generate sine wave
  let offset = 44
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.3
    view.setInt16(offset, sample * 32767, true)
    offset += 2
  }
  
  // Convert to base64
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export default function TestVolumePage() {
  const [audioData] = useState(() => generateTestAudio())
  
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Audio Volume Control Test</h1>
      
      <div className="space-y-6">
        <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Test Instructions:</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Click the play button to start the audio (30-second test tone)</li>
            <li>While audio is playing, drag the volume slider</li>
            <li>Audio should continue playing smoothly without interruption</li>
            <li>Volume should change in real-time as you drag</li>
            <li>Check browser console for debug logs</li>
          </ol>
        </div>
        
        <AudioPlayerCard
          id="test-audio"
          audioBase64={audioData}
          mimeType="audio/wav"
          text="This is a 30-second test tone at 440Hz (A4 note) for testing volume control. The audio should play continuously without interruption while you adjust the volume slider."
          voiceName="Test Voice"
          timestamp={Date.now()}
          duration={30}
          isGenerating={false}
          provider="test"
        />
        
        <div className="mt-8 p-4 bg-gray-800 rounded-lg">
          <h3 className="font-semibold mb-2">Expected Behavior:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
            <li>✅ Audio plays without stopping when volume is adjusted</li>
            <li>✅ Volume changes smoothly in real-time</li>
            <li>✅ No clicking or popping sounds during volume changes</li>
            <li>✅ Slider doesn't lose focus or jump around</li>
            <li>✅ Console shows Web Audio is active after first play</li>
          </ul>
        </div>
        
        <div className="mt-4 p-4 bg-gray-800 rounded-lg">
          <h3 className="font-semibold mb-2">Technical Details:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
            <li>Uses Web Audio API GainNode for volume control</li>
            <li>Audio element stays at 100% volume</li>
            <li>Volume changes applied through gain node</li>
            <li>Exponential ramping prevents audio artifacts</li>
            <li>Focus events prevented to avoid browser pause behavior</li>
          </ul>
        </div>
      </div>
    </div>
  )
}