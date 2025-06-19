import { NextResponse } from 'next/server'
import { isPersistenceConfigured } from '@/lib/database/supabase'

export async function GET() {
  return NextResponse.json({
    configured: isPersistenceConfigured()
  })
}