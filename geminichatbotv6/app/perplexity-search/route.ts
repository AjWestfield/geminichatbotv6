import { NextRequest, NextResponse } from 'next/server';
import { PerplexityClient } from '@/lib/perplexity-client';
import { SearchIntentDetector } from '@/lib/search-intent-detector';

export async function POST(req: NextRequest) {
  try {
    const { messages, forceSearch = false } = await req.json();
    
    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }

    // Get the last user message
    const lastUserMessage = messages
      .filter((m: any) => m.role === 'user')
      .pop();

    if (!lastUserMessage) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400 }
      );
    }

    // Detect if search is needed
    const detector = new SearchIntentDetector();
    const searchIntent = detector.detectSearchIntent(lastUserMessage.content);

    // If no search needed and not forced, return indicator
    if (!searchIntent.needsSearch && !forceSearch) {
      return NextResponse.json({
        needsSearch: false,
        message: 'No web search required for this query'
      });
    }

    // Prepare search options based on intent
    const searchOptions: any = {
      search_mode: 'web',
      return_images: true, // Always request images for better visual results
      return_related_questions: true
    };

    if (searchIntent.timeFilter) {
      searchOptions.search_recency_filter = searchIntent.timeFilter;
    }

    if (searchIntent.domainFilter) {
      searchOptions.search_domain_filter = searchIntent.domainFilter;
    }

    // Enhance system prompt for better search usage
    const systemMessage = {
      role: 'system',
      content: `You are a helpful AI assistant with access to real-time web search. 
        Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
        Always provide the most current and up-to-date information based on search results.
        Always cite your sources when using searched information. 
        Provide accurate, up-to-date information based on search results.
        Format citations as [Source Name](URL) when referencing search results.`
    };
    
    // For Perplexity API, we only send system message + last user message
    // to comply with their strict alternating message requirement
    const perplexityMessages = [
      systemMessage,
      {
        role: lastUserMessage.role,
        content: lastUserMessage.content
      }
    ];

    // Perform the search
    const client = new PerplexityClient();
    const response = await client.search(perplexityMessages, searchOptions);

    // Log the full response to see what data is available
    console.log('[Perplexity API] Full response structure:', {
      hasChoices: !!response.choices,
      hasCitations: !!response.citations,
      hasSearchResults: !!response.search_results,
      hasImages: !!(response as any).images,
      responseKeys: Object.keys(response),
      // Log first few items if they exist
      firstSearchResult: response.search_results?.[0],
      firstImage: (response as any).images?.[0]
    });

    return NextResponse.json({
      needsSearch: true,
      response,
      searchIntent,
      citations: response.citations,
      searchResults: response.search_results,
      images: response.images // Pass through images if available
    });

  } catch (error: any) {
    console.error('Perplexity search error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    return NextResponse.json(
      { 
        error: 'Failed to perform search',
        details: error.response?.data || error.message 
      },
      { status: 500 }
    );
  }
}
