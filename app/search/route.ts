import { NextRequest, NextResponse } from 'next/server';
import { TavilyClient, WebSearchContextDetector } from '@/lib/tavily-client';

export async function POST(req: NextRequest) {
  try {
    const { query, options = {} } = await req.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      );
    }

    // Initialize Tavily client
    const tavilyClient = TavilyClient.getInstance();

    // Detect search context and get appropriate parameters
    const contextParams = WebSearchContextDetector.getSearchParams(query);
    const domainParams = WebSearchContextDetector.extractDomains(query);

    // Merge parameters: options > context detection > defaults
    const searchParams = {
      query,
      ...contextParams,
      ...domainParams,
      ...options,
    };

    console.log('[Search API] Processing search request:', {
      query,
      params: searchParams,
      requiresSearch: WebSearchContextDetector.requiresWebSearch(query),
    });

    // Execute search
    const searchResults = await tavilyClient.search(searchParams);

    // Format results for AI consumption
    const formattedResults = tavilyClient.formatForAI(searchResults);

    // Return both raw and formatted results
    return NextResponse.json({
      success: true,
      query,
      results: searchResults,
      formatted: formattedResults,
      searchParams,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Search API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = errorMessage.includes('rate limit') ? 429 : 
                      errorMessage.includes('Invalid') ? 401 : 500;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }
}

// GET endpoint for health check
export async function GET() {
  try {
    // Check if API key is configured
    const hasApiKey = !!process.env.TAVILY_API_KEY;
    
    return NextResponse.json({
      status: 'ok',
      service: 'Tavily Web Search',
      configured: hasApiKey,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        service: 'Tavily Web Search',
        error: 'Service check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}