import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

console.log('Environment Variables Check:\n');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Not set');
console.log('SUPABASE_API_KEY:', process.env.SUPABASE_API_KEY ? '✅ Set' : '❌ Not set');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set');

console.log('\nActual values (first 20 chars):');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL?.substring(0, 30) + '...');
console.log('SUPABASE_API_KEY:', process.env.SUPABASE_API_KEY?.substring(0, 20) + '...');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY?.substring(0, 20) + '...');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...');
