// Client-side search intent detection
export function detectSearchIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim()
  
  // Keywords that strongly indicate search intent
  const searchKeywords = [
    'latest', 'current', 'recent', 'today', 'yesterday', 'this week', 'this month',
    'news', 'updates', 'what is happening', "what's happening", 'breaking',
    'price of', 'stock price', 'weather', 'forecast',
    'score', 'game', 'match', 'results',
    'who won', 'who is winning', 'election',
    'trending', 'viral', 'popular right now',
    'how many', 'statistics', 'data on',
    'latest on', 'update on', 'news about',
    'current status', 'current state', 'right now',
    'at the moment', 'as of today'
  ]
  
  // Check for temporal indicators
  const hasTemporalIndicator = /\b(today|yesterday|this\s+week|this\s+month|this\s+year|right\s+now|currently|at\s+the\s+moment|latest|recent|2024|2025)\b/i.test(message)
  
  // Check for question words with temporal context
  const hasTemporalQuestion = /\b(what|who|where|when|how|which)\b.*\b(latest|current|recent|today|now|happening)\b/i.test(message)
  
  // Check if any search keyword is present
  const hasSearchKeyword = searchKeywords.some(keyword => lowerMessage.includes(keyword))
  
  return hasTemporalIndicator || hasTemporalQuestion || hasSearchKeyword
}
