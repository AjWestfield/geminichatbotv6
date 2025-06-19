import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_API_KEY;

async function testDirectAPI() {
  console.log('Testing direct Supabase API connection...\n');
  
  // Test with service role key
  console.log('1. Testing with service role key:');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/chats?limit=1`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });
    
    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', text.substring(0, 200));
    
    if (response.ok) {
      console.log('✅ Service role key works!');
    } else {
      console.log('❌ Service role key failed');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test with anon key
  console.log('\n2. Testing with anon key:');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/chats?limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });
    
    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', text.substring(0, 200));
    
    if (response.ok) {
      console.log('✅ Anon key works!');
    } else {
      console.log('❌ Anon key failed');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDirectAPI();
