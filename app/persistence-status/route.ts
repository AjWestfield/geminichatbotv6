import { NextResponse } from 'next/server'
import { isPersistenceConfigured } from '@/lib/database/supabase'

export async function GET() {
  const hasSupabaseEnv = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_API_KEY
  const isValidUrl = process.env.SUPABASE_URL?.includes('.supabase.co') || false
  
  return NextResponse.json({
    configured: isPersistenceConfigured(),
    hasSupabase: hasSupabaseEnv,
    hasValidSupabaseUrl: hasSupabaseEnv && isValidUrl,
    hasBlob: !!process.env.BLOB_READ_WRITE_TOKEN,
    hasRedis: !!process.env.REDIS_URL
  })
}