import { NextResponse } from 'next/server'

export async function GET() {
  // Check environment variables (without exposing the actual values)
  const envStatus = {
    MONGODB_URI: !!process.env.MONGODB_URI,
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
    ATAI_INTERNAL_KEY: !!process.env.ATAI_INTERNAL_KEY,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    FIRECRAWL_API_KEY: !!process.env.FIRECRAWL_API_KEY,
    IMAGEKIT_PUBLIC_KEY: !!process.env.IMAGEKIT_PUBLIC_KEY,
    IMAGEKIT_PRIVATE_KEY: !!process.env.IMAGEKIT_PRIVATE_KEY,
    DODO_PAYMENTS_API_KEY: !!process.env.DODO_PAYMENTS_API_KEY,
    SMTP_HOST: !!process.env.SMTP_HOST,
    
    // Show partial values for debugging (first few characters only)
    ATAI_INTERNAL_KEY_partial: process.env.ATAI_INTERNAL_KEY?.substring(0, 10) + '...' || 'NOT SET',
    NEXT_PUBLIC_APP_URL_value: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
  }

  return NextResponse.json({ 
    status: 'ok',
    service: 'MirrorSite AI',
    env: envStatus,
    internalApiConfigured: envStatus.ATAI_INTERNAL_KEY,
    timestamp: new Date().toISOString(),
  })
}
