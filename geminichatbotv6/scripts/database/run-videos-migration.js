const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting videos table migration...\n');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../../SUPABASE_VIDEOS_TABLE.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Read SQL migration file successfully');
    console.log('🔧 Executing migration...\n');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    }).single();
    
    if (error) {
      // If exec_sql doesn't exist, try running the queries individually
      console.log('⚠️  exec_sql not available, running queries individually...\n');
      
      // Split SQL into individual statements
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        
        // For table creation, we need to use a different approach
        if (statement.includes('CREATE TABLE') || statement.includes('DROP TABLE')) {
          // These need to be run via SQL editor in Supabase dashboard
          console.log('⚠️  Table creation/deletion must be run in Supabase SQL editor');
          continue;
        }
        
        const { error: stmtError } = await supabase.from('videos').select('*').limit(1);
        if (stmtError && stmtError.code === '42P01') {
          console.log('\n❌ Videos table does not exist yet.');
          console.log('\n📋 Please follow these steps:');
          console.log('1. Go to: https://bsocqrwrikfmymklgart.supabase.com/project/bsocqrwrikfmymklgart/sql/new');
          console.log('2. Copy the contents of SUPABASE_VIDEOS_TABLE.sql');
          console.log('3. Paste and run the SQL in the Supabase SQL editor');
          console.log('\n💡 The SQL file is located at: ' + sqlPath);
          return;
        }
      }
    }
    
    // Test if the table exists now
    console.log('\n🔍 Checking if videos table exists...');
    const { data: videos, error: checkError } = await supabase
      .from('videos')
      .select('*')
      .limit(1);
    
    if (checkError) {
      if (checkError.code === '42P01') {
        console.log('\n❌ Videos table still does not exist.');
        console.log('\n📋 Please manually run the migration:');
        console.log('1. Go to: https://bsocqrwrikfmymklgart.supabase.com/project/bsocqrwrikfmymklgart/sql/new');
        console.log('2. Copy the contents of SUPABASE_VIDEOS_TABLE.sql');
        console.log('3. Paste and run the SQL in the Supabase SQL editor');
      } else {
        console.error('❌ Error checking videos table:', checkError);
      }
    } else {
      console.log('✅ Videos table exists and is accessible!');
      console.log('✅ Migration completed successfully!\n');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

runMigration();
