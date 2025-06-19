/**
 * Enhanced prompts for GitHub-based MCP server analysis
 */

export const MCPGitHubPrompts = {
  /**
   * System prompt for analyzing web search results about GitHub MCP servers
   */
  searchResultAnalysis: `You are analyzing web search results to find MCP (Model Context Protocol) server installation instructions.

When you receive search results about a GitHub repository containing an MCP server, look for:

1. **Installation Commands**:
   - npx commands: "npx @modelcontextprotocol/server-name" or "npx -y package-name"
   - npm install: "npm install -g package-name"
   - Direct execution: "node server.js" or similar

2. **Configuration Details**:
   - Required environment variables
   - Command-line arguments
   - Transport type (stdio is default, http requires URL)
   - Any special setup requirements

3. **Package Information**:
   - NPM package name (often @modelcontextprotocol/server-xyz)
   - GitHub repository structure
   - Whether it's part of a monorepo

4. **Usage Examples**:
   - How the server is typically run
   - Sample configurations
   - Integration examples

Based on the search results, construct an MCP server configuration that can be directly used.`,

  /**
   * Instructions for following up on GitHub analysis
   */
  githubAnalysisFollowup: `After analyzing a GitHub repository URL for an MCP server:

1. If configuration was found with high confidence (>70%):
   - Provide the complete configuration
   - Explain what the server does
   - Offer to connect and show available tools

2. If configuration was found with medium confidence (40-70%):
   - Show the inferred configuration
   - Explain what assumptions were made
   - Suggest testing the configuration

3. If configuration was not found or low confidence (<40%):
   - Use [TOOL_CALL] to search for more information
   - Search query should include:
     - The GitHub URL
     - "MCP server"
     - "installation" or "npm install" or "npx"
     - "Model Context Protocol"
   - After getting search results, analyze them to build configuration

4. Always provide actionable next steps for the user.`,

  /**
   * Template for building MCP configuration from various sources
   */
  configurationBuilder: `When building an MCP server configuration from analyzed sources:

1. **Name**: Use the most specific identifier found
   - From package.json "name" field
   - From README title
   - From directory/repository name

2. **Command**: Determine the execution method
   - "npx" for NPM packages (most common)
   - "node" for direct script execution
   - Custom command if specified

3. **Args**: Build the arguments array
   - For npx: ["-y", "package-name"]
   - For node: ["path/to/server.js"]
   - Include any required arguments

4. **Transport Type**: Default to "stdio" unless:
   - Documentation mentions HTTP/WebSocket
   - URL configuration is required
   - API endpoints are mentioned

5. **Environment Variables**: Only include if:
   - Explicitly mentioned as required
   - API keys or tokens needed
   - Configuration paths specified

6. **Description**: Summarize what the server does
   - From README description
   - From package.json description
   - From code analysis

Always prefer official NPM packages when available.`,

  /**
   * Instructions for handling complex repositories
   */
  complexRepoAnalysis: `For complex GitHub repositories (monorepos, multiple servers):

1. **Identify the specific server**:
   - Check the path in the URL
   - Look for package.json in subdirectories
   - Find the most relevant README

2. **Determine the package name**:
   - Monorepo pattern: @org/server-specific-name
   - Check NPM registry for published packages
   - Look for "npm publish" instructions

3. **Handle special cases**:
   - Development servers: May need building first
   - Private packages: Might require GitHub installation
   - Custom protocols: May have unique transport types

4. **Confidence scoring**:
   - High (80-100%): Clear NPM package with documentation
   - Medium (50-79%): Inferred from structure and patterns
   - Low (0-49%): Guessed based on naming conventions

Always err on the side of providing a working configuration that users can test.`
}

/**
 * Generate a search query for finding MCP server information
 */
export function generateMCPSearchQuery(
  githubUrl: string,
  serverName?: string,
  additionalTerms?: string[]
): string {
  const baseTerms = [
    githubUrl,
    'MCP server',
    'Model Context Protocol',
    'installation',
    'npm install OR npx',
    'configuration'
  ]
  
  if (serverName) {
    baseTerms.push(`"${serverName}"`)
  }
  
  if (additionalTerms) {
    baseTerms.push(...additionalTerms)
  }
  
  return baseTerms.join(' ')
}

/**
 * Parse NPM package name from various sources
 */
export function parseNPMPackageName(input: string): string | null {
  // Match patterns like @modelcontextprotocol/server-name
  const patterns = [
    /@[\w-]+\/[\w-]+/,  // Scoped package
    /npx\s+(-y\s+)?([^\s]+)/,  // NPX command
    /npm\s+install\s+(-g\s+)?([^\s]+)/,  // NPM install
  ]
  
  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match) {
      return match[match.length - 1]
    }
  }
  
  return null
}