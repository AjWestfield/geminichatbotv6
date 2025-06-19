#!/usr/bin/env node

/**
 * Environment verification script for TTS e2e tests
 * Verifies that required API keys are configured before running tests
 */

import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
config({ path: join(__dirname, '..', '.env.local') });

const requiredEnvVars = {
  GEMINI_API_KEY: 'Required for chat functionality',
  WAVESPEED_API_KEY: 'Required for TTS generation'
};

const optionalEnvVars = {
  OPENAI_API_KEY: 'Optional for additional AI features',
  ELEVENLABS_API_KEY: 'Optional for alternative TTS'
};

console.log('🔍 Verifying TTS Test Environment...\n');

let hasErrors = false;

// Check required variables
console.log('📋 Required Environment Variables:');
for (const [key, description] of Object.entries(requiredEnvVars)) {
  const value = process.env[key];
  if (value && value.trim() !== '') {
    console.log(`✅ ${key}: Configured`);
  } else {
    console.log(`❌ ${key}: Missing - ${description}`);
    hasErrors = true;
  }
}

// Check optional variables
console.log('\n📋 Optional Environment Variables:');
for (const [key, description] of Object.entries(optionalEnvVars)) {
  const value = process.env[key];
  if (value && value.trim() !== '') {
    console.log(`✅ ${key}: Configured`);
  } else {
    console.log(`⚠️  ${key}: Not configured - ${description}`);
  }
}

// Test basic API connectivity if keys are present
if (process.env.WAVESPEED_API_KEY) {
  console.log('\n🌐 Testing WaveSpeed API connectivity...');
  try {
    const response = await fetch('https://api.wavespeed.ai/api/v3/wavespeed-ai/dia-tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WAVESPEED_API_KEY}`
      },
      body: JSON.stringify({
        prompt: '[S1] Test connection'
      })
    });

    if (response.ok) {
      console.log('✅ WaveSpeed API: Connection successful');
    } else if (response.status === 401) {
      console.log('❌ WaveSpeed API: Invalid API key');
      hasErrors = true;
    } else {
      console.log(`⚠️  WaveSpeed API: Unexpected response (${response.status})`);
    }
  } catch (error) {
    console.log(`⚠️  WaveSpeed API: Connection test failed - ${error.message}`);
  }
}

console.log('\n🔧 Test Environment Check:');
console.log(`📍 Base URL: http://localhost:3007`);
console.log(`🎭 Test Runner: Playwright`);
console.log(`🧪 Test Location: tests/e2e/`);

if (hasErrors) {
  console.log('\n❌ Environment verification failed!');
  console.log('Please configure the missing API keys in .env.local before running TTS tests.');
  process.exit(1);
} else {
  console.log('\n✅ Environment verification successful!');
  console.log('Ready to run TTS e2e tests.');
  process.exit(0);
}