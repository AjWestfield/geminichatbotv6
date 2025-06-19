# MCP Calculator Server

An example MCP (Model Context Protocol) server that provides calculator tools.

## Tools Available

- **add**: Add two numbers
- **subtract**: Subtract two numbers
- **multiply**: Multiply two numbers
- **divide**: Divide two numbers
- **sqrt**: Calculate square root
- **power**: Raise a number to a power

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the server:
```bash
npm run build
```

3. Run the server:
```bash
npm start
```

## Development

For development with hot reload:
```bash
npm run dev
```

## Usage in Gemini Chatbot

1. In the MCP Servers panel, click "Add MCP Server"
2. Enter the following configuration:
   - **Name**: Calculator
   - **Command**: `node`
   - **Arguments**: 
     ```
     /path/to/example-servers/calculator/dist/index.js
     ```

3. Click "Add Server" and then connect to it
4. The calculator tools will be available in the Tools tab