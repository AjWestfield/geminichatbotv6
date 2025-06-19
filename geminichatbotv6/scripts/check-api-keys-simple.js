// Simple script to check API keys configuration
require('dotenv').config({ path: '.env.local' });

console.log('Checking API Keys Configuration...');
console.log('=================================');

// Check GEMINI_API_KEY
if (process.env.GEMINI_API_KEY) {
    console.log('✓ GEMINI_API_KEY: Configured');
} else {
    console.log('✗ GEMINI_API_KEY: Missing (REQUIRED for chat functionality)');
}

// Check OPENAI_API_KEY
if (process.env.OPENAI_API_KEY) {
    console.log('✓ OPENAI_API_KEY: Configured');
} else {
    console.log('✗ OPENAI_API_KEY: Missing (Optional - needed for audio/video transcription)');
}

// Check WAVESPEED_API_KEY
if (process.env.WAVESPEED_API_KEY) {
    console.log('✓ WAVESPEED_API_KEY: Configured');
} else {
    console.log('✗ WAVESPEED_API_KEY: Missing (Optional - needed for image generation)');
}

console.log('=================================');

// Summary
const hasGemini = !!process.env.GEMINI_API_KEY;
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasWaveSpeed = !!process.env.WAVESPEED_API_KEY;

if (hasGemini && hasOpenAI && hasWaveSpeed) {
    console.log('✨ All API keys configured! All features will be available.');
} else if (hasGemini) {
    console.log('✅ Basic chat functionality will work.');
    if (!hasOpenAI) console.log('⚠️  Audio/video transcription will not be available.');
    if (!hasWaveSpeed) console.log('⚠️  Image generation will not be available.');
} else {
    console.log('❌ GEMINI_API_KEY is required for the chat to function.');
}
