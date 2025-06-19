export const MCP_JSON_FORMATTING_RULES = `
## CRITICAL JSON FORMATTING RULES FOR MCP OPERATIONS

### NEVER USE JAVASCRIPT CODE IN JSON STRINGS

When writing JSON to mcp.config.json, you MUST:

1. **Use Static Timestamps**: 
   - ❌ WRONG: "lastModified": " + new Date().toISOString() + "
   - ✅ CORRECT: "lastModified": "2025-01-30T12:34:56.789Z"

2. **Generate Timestamps Correctly**:
   - Calculate the timestamp BEFORE creating the JSON
   - Use a concrete ISO string value
   - Example: "2025-01-30T12:34:56.789Z"

3. **Valid JSON Only**:
   - No JavaScript expressions
   - No template literals
   - No concatenation
   - Just pure, valid JSON

### EXAMPLE OF CORRECT MCP SERVER ADDITION:

\`\`\`json
{
  "servers": [
    {
      "id": "existing-server",
      "name": "Existing Server",
      "command": "npx",
      "args": ["-y", "existing-package"]
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
  "lastModified": "2025-01-30T12:34:56.789Z"
}
\`\`\`

### STEP-BY-STEP PROCESS:

1. Read current config
2. Parse as JSON object
3. Add new server to servers array
4. Create timestamp string (e.g., "2025-01-30T12:34:56.789Z")
5. Set lastModified to the timestamp string
6. Convert entire object to formatted JSON string
7. Write the JSON string to file

### COMMON MISTAKES TO AVOID:

❌ Using + operator in JSON strings
❌ Using template literals in JSON
❌ Calling functions inside JSON strings
❌ Using variables without resolving their values first
❌ Forgetting to escape special characters

✅ Always create complete, valid JSON before writing
✅ Always verify JSON validity before writing
✅ Always use concrete string values, not expressions
`;