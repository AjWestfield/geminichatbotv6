#!/usr/bin/env node

/**
 * Script to apply the message count fix to the database
 * This updates the chat_summaries view to count only user messages
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('📊 Applying message count fix migration...\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'UPDATE_MESSAGE_COUNT_VIEW.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');

    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: sql
    });

    if (error) {
      // If exec_sql doesn't exist, try another approach
      console.log('⚠️  Direct SQL execution not available, please run the following SQL manually in Supabase SQL Editor:\n');
      console.log('📋 Copy and paste this SQL:\n');
      console.log('=' * 80);
      console.log(sql);
      console.log('=' * 80);
      console.log('\n✅ After running the SQL, your message counts will show only user messages.');
      return;
    }

    console.log('✅ Successfully updated chat_summaries view!');
    console.log('📊 Message counts will now show only user messages (not assistant responses).\n');

    // Test the new view
    const { data: testChats, error: testError } = await supabase
      .from('chat_summaries')
      .select('title, message_count')
      .limit(5);

    if (!testError && testChats) {
      console.log('📋 Sample chat message counts:');
      testChats.forEach(chat => {
        console.log(`   • ${chat.title}: ${chat.message_count} user messages`);
      });
    }

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

// Run the migration
applyMigration();
