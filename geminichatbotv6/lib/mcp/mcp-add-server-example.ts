export const MCP_ADD_SERVER_EXAMPLE = `
## EXAMPLE: COMPLETE WORKFLOW FOR ADDING SEQUENTIAL THINKING SERVER

### User Request: "Add the sequential thinking MCP server"

### STEP 1: CREATE TODO LIST
\`\`\`
TODO LIST: Add Sequential Thinking MCP Server
1. ☐ Search for server configuration online
2. ☐ Extract configuration details from search results
3. ☐ Read current mcp.config.json file
4. ☐ Check for duplicate servers
5. ☐ Prepare new server configuration
6. ☐ Calculate current timestamp
7. ☐ Create complete JSON with new server
8. ☐ Write updated configuration to file
9. ☐ Verify server was added correctly
10. ☐ Provide setup instructions to user
\`\`\`

### STEP 2: SEARCH FOR CONFIGURATION
1. 🔄 Search for server configuration online
Use Exa/Context7: "sequential thinking MCP server configuration npm"
Result: Found @modelcontextprotocol/server-sequential-thinking
1. ✅ Search completed

### STEP 3: READ CURRENT CONFIG
2. 🔄 Read current mcp.config.json file
DesktopCommander: read_file("/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json")
2. ✅ Current config read successfully

### STEP 4: PREPARE NEW SERVER ENTRY
The new server configuration:
\`\`\`json
{
  "id": "sequential-thinking",
  "name": "Sequential Thinking",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
  "transportType": "stdio"
}
\`\`\`

### STEP 5: CREATE TIMESTAMP
Calculate timestamp: "2025-01-30T12:45:00.000Z"

### STEP 6: BUILD COMPLETE JSON
\`\`\`json
{
  "servers": [
    {
      "id": "context7-upstash",
      "name": "Context7",
      "url": "https://mcp.context7.com/mcp",
      "transportType": "http"
    },
    {
      "id": "exa-search",
      "name": "Exa",
      "command": "npx",
      "args": ["-y", "exa-mcp-server"],
      "env": {
        "EXA_API_KEY": "5f0303dd-e2f8-4210-82a7-885b686686a6"
      }
    },
    {
      "id": "desktop-commander",
      "name": "DesktopCommander",
      "command": "npx",
      "args": ["-y", "@wonderwhy-er/desktop-commander@latest"],
      "transportType": "stdio"
    },
    {
      "id": "sequential-thinking",
      "name": "Sequential Thinking",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "transportType": "stdio"
    }
  ],
  "version": "1.0",
  "lastModified": "2025-01-30T12:45:00.000Z"
}
\`\`\`

### STEP 7: WRITE TO FILE
DesktopCommander: write_file with the COMPLETE JSON string above

### STEP 8: VERIFY
Read the file again and confirm Sequential Thinking server is present

### CRITICAL RULES:
1. NEVER use JavaScript expressions in JSON
2. ALWAYS use concrete timestamp strings
3. ALWAYS verify after writing
4. ALWAYS follow the todo workflow
5. NEVER skip verification steps
`;