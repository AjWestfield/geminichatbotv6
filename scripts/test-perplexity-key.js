#!/usr/bin/env node

/**
 * Quick utility to test Perplexity API key validity
 * Usage: node scripts/test-perplexity-key.js [API_KEY]
 * If no API key provided, reads from .env.local
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const API_KEY = process.argv[2] || process.env.PERPLEXITY_API_KEY;
const BASE_URL = 'https://api.perplexity.ai';

console.log('🔑 Perplexity API Key Validator\n');

if (!API_KEY) {
  console.error('❌ No API key provided.');
  console.error('Usage: node scripts/test-perplexity-key.js [API_KEY]');
  console.error('Or set PERPLEXITY_API_KEY in .env.local');
  process.exit(1);
}

console.log('✅ API Key:', API_KEY.substring(0, 10) + '...');
console.log('🔍 Length:', API_KEY.length);
console.log('🔍 Format:', API_KEY.startsWith('pplx-') ? '✅ Valid prefix' : '❌ Invalid prefix');

async function testAPIKey() {
  try {
    console.log('\n📡 Testing API key with simple request...');
    
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: 'Hello, can you confirm this API key is working?'
          }
        ],
        max_tokens: 50
      })
    });

    console.log('📥 Status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS! API key is working correctly.');
      console.log('💬 Response:', data.choices?.[0]?.message?.content || 'No content');
      console.log('\n🎉 You can now use this API key in your .env.local file:');
      console.log(`PERPLEXITY_API_KEY=${API_KEY}`);
      return true;
    } else {
      const error = await response.text();
      console.log('❌ FAILED! API key is not working.');
      console.log('🔍 Error:', error.substring(0, 200) + '...');
      
      if (response.status === 401) {
        console.log('\n💡 Solutions:');
        console.log('1. Generate a new API key at: https://www.perplexity.ai/account/api/group');
        console.log('2. Check your account billing and status');
        console.log('3. Verify the API key was copied correctly');
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return false;
  }
}

// Test different models to check permissions
async function testModels() {
  const models = ['sonar', 'sonar-pro'];
  console.log('\n🧪 Testing model access...');
  
  for (const model of models) {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 10
        })
      });
      
      if (response.ok) {
        console.log(`✅ ${model}: Access granted`);
      } else {
        console.log(`❌ ${model}: Access denied (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${model}: Error - ${error.message}`);
    }
  }
}

async function main() {
  const isWorking = await testAPIKey();
  
  if (isWorking) {
    await testModels();
  }
  
  console.log('\n🏁 Testing completed!');
  process.exit(isWorking ? 0 : 1);
}

main().catch(console.error);
