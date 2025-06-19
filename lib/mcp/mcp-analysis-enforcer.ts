/**
 * MCP Analysis Enforcer
 * Ensures AI provides analysis after tool execution
 */

export class MCPAnalysisEnforcer {
  /**
   * Generate a strong analysis prompt that the AI cannot ignore
   */
  static generateAnalysisPrompt(toolName: string, toolResult: string): string {
    // Parse the result to understand its structure
    const resultPreview = toolResult.substring(0, 200)
    const isError = toolResult.toLowerCase().includes('error')
    
    return `\n\n🔍 **Analysis Required**\n\nThe ${toolName} tool has completed execution. Based on the results above, I must now provide:\n\n1. **Summary**: Key findings from the tool output\n2. **Insights**: Important information relevant to your question\n3. **Recommendations**: Next steps or actions based on these results\n4. **Answer**: Direct response to your original query\n\nAnalyzing the results now...\n\n`
  }
  
  /**
   * Create an analysis request for the AI model
   */
  static createAnalysisRequest(toolCall: any, toolResult: string, originalQuery: string): string {
    return `The tool "${toolCall.tool}" has been executed and returned the following results:

\`\`\`
${toolResult}
\`\`\`

Original user question: "${originalQuery}"

Please provide a comprehensive analysis of these results:
1. Summarize the key findings
2. Extract the most important information
3. Answer the user's original question based on these results
4. Provide any relevant insights or recommendations
5. If the results are incomplete or unclear, explain what additional information might be needed

Your analysis should be clear, well-structured, and directly address the user's needs.`
  }
  
  /**
   * Get a preview of the result for better context
   */
  private static getResultPreview(result: string): string {
    try {
      // If it's JSON, try to extract key info
      const parsed = JSON.parse(result)
      if (Array.isArray(parsed)) {
        return `Array with ${parsed.length} items`
      } else if (typeof parsed === 'object') {
        const keys = Object.keys(parsed)
        return `Object with keys: ${keys.slice(0, 3).join(', ')}`
      }
    } catch {
      // Not JSON, return text preview
      return result.length > 100 ? result.substring(0, 100) + '...' : result
    }
    return result
  }
  
  /**
   * Check if analysis was provided in the response
   */
  static hasAnalysis(response: string): boolean {
    const analysisMarkers = [
      '## Analysis of',
      '### Summary of Key Findings',
      '### Detailed Insights',
      '### Answering Your Question',
      '### Recommendations'
    ]
    
    return analysisMarkers.some(marker => response.includes(marker))
  }
  
  /**
   * Generate a fallback prompt if analysis wasn't provided
   */
  static generateFallbackPrompt(toolName: string): string {
    return `

[CRITICAL: ANALYSIS MISSING]

I notice I haven't provided the required analysis for the ${toolName} tool results. Let me correct this immediately:

`
  }
}