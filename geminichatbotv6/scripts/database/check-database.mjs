import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_API_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_API_KEY in .env.local');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

async function checkDatabaseStatus() {
  console.log('\n🔍 Checking database status...\n');
  
  const tables = [
    { name: 'chats', required: true },
    { name: 'messages', required: true },
    { name: 'images', required: true },
    { name: 'videos', required: true },
    { name: 'audios', required: false },
    { name: 'social_media_cookies', required: false }
  ];
  
  const results = {
    working: [],
    missing: [],
    errors: []
  };
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table.name)
        .select('count')
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === '42P01') {
          results.missing.push(table.name);
          console.log(`❌ Table '${table.name}' does not exist${table.required ? ' (REQUIRED)' : ''}`);
        } else if (error.code === 'PGRST116') {
          // Table exists but is empty
          results.working.push(table.name);
          console.log(`✅ Table '${table.name}' exists (empty)`);
        } else {
          results.errors.push({ table: table.name, error });
          console.log(`⚠️  Table '${table.name}' error:`, error.message);
        }
      } else {
        results.working.push(table.name);
        console.log(`✅ Table '${table.name}' exists`);
      }
    } catch (err) {
      results.errors.push({ table: table.name, error: err });
      console.log(`❌ Error checking table '${table.name}':`, err.message);
    }
  }
  
  return results;
}

async function testDatabaseOperations() {
  console.log('\n🧪 Testing database operations...\n');
  
  try {
    // Test chat creation
    console.log('Testing chat creation...');
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .insert({
        title: 'Test Chat - ' + new Date().toISOString(),
        model: 'gemini-2.0-flash-exp',
        metadata: { test: true }
      })
      .select()
      .single();
    
    if (chatError) {
      console.log('❌ Failed to create test chat:', chatError.message);
      return false;
    }
    
    console.log('✅ Successfully created test chat:', chat.id);
    
    // Clean up test chat
    const { error: deleteError } = await supabase
      .from('chats')
      .delete()
      .eq('id', chat.id);
    
    if (deleteError) {
      console.log('⚠️  Failed to delete test chat:', deleteError.message);
    } else {
      console.log('✅ Successfully cleaned up test chat');
    }
    
    return true;
  } catch (err) {
    console.error('❌ Database operation test failed:', err);
    return false;
  }
}

async function main() {
  console.log('🚀 Gemini Chatbot v5 - Database Setup Check\n');
  console.log('=' .repeat(50));
  
  // Check database status
  const status = await checkDatabaseStatus();
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Summary:');
  console.log(`✅ Working tables: ${status.working.length}`);
  console.log(`❌ Missing tables: ${status.missing.length}`);
  console.log(`⚠️  Tables with errors: ${status.errors.length}`);
  
  if (status.missing.length > 0) {
    console.log('\n⚠️  Missing required tables:', status.missing.join(', '));
    
    if (status.missing.includes('videos')) {
      console.log('\n📋 To create the videos table:');
      console.log('1. Go to: https://bsocqrwrikfmymklgart.supabase.com/project/bsocqrwrikfmymklgart/sql/new');
      console.log('2. Copy the contents of SUPABASE_VIDEOS_TABLE.sql');
      console.log('3. Paste and run the SQL in the Supabase SQL editor');
      console.log('\n💡 Or run: npm run setup:videos');
    }
  } else {
    console.log('\n✅ All required tables exist!');
    
    // Test operations if all tables exist
    const opsWorking = await testDatabaseOperations();
    
    if (opsWorking) {
      console.log('\n🎉 Database is fully functional!');
      console.log('✅ Persistence is enabled and working');
    }
  }
  
  console.log('\n' + '='.repeat(50));
}

main().catch(console.error);
