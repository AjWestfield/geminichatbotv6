import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

console.log('🚀 Automatic Videos Table Setup\n');
console.log('Project:', projectRef);
console.log('URL:', supabaseUrl);
console.log('\n' + '='.repeat(50) + '\n');

async function createVideosTable() {
  try {
    // First check if table already exists
    console.log('🔍 Checking if videos table exists...');
    const { error: checkError } = await supabase
      .from('videos')
      .select('count')
      .limit(1);
    
    if (!checkError || checkError.code !== '42P01') {
      console.log('✅ Videos table already exists!');
      return true;
    }
    
    console.log('📋 Videos table not found. Creating...\n');
    
    // Read SQL file
    const sqlPath = join(__dirname, '../../SUPABASE_VIDEOS_TABLE.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');
    
    // Since we can't execute DDL directly, we'll create a detailed guide
    console.log('⚠️  Direct table creation requires Supabase dashboard access.\n');
    console.log('📋 Please follow these steps:\n');
    console.log('1. Click this link to open SQL editor:');
    console.log(`   https://${projectRef}.supabase.com/project/${projectRef}/sql/new\n`);
    console.log('2. Copy and paste the following SQL:\n');
    console.log('─'.repeat(60));
    console.log(sqlContent);
    console.log('─'.repeat(60));
    console.log('\n3. Click "Run" to execute the SQL\n');
    console.log('4. After running, come back and run: npm run db:check\n');
    
    // Open the URL in browser
    const platform = process.platform;
    const openCommand = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    
    console.log('💡 Opening Supabase SQL editor in your browser...\n');
    
    const { exec } = await import('child_process');
    exec(`${openCommand} "https://${projectRef}.supabase.com/project/${projectRef}/sql/new"`);
    
    return false;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

createVideosTable().then(success => {
  if (success) {
    console.log('\n✅ Setup complete!');
  } else {
    console.log('\n⏳ Manual step required - see instructions above');
  }
  process.exit(success ? 0 : 1);
});
