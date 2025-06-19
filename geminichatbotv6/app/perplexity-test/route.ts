import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    
    // Test API key is configured
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Perplexity API key not configured' },
        { status: 500 }
      );
    }
    
    // Return test response
    return NextResponse.json({
      status: 'ok',
      message: 'Perplexity API integration is ready',
      hasApiKey: true,
      model: process.env.PERPLEXITY_MODEL || 'sonar-pro'
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      { error: 'Test failed' },
      { status: 500 }
    );
  }
}
