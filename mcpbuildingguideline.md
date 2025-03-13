# MCP Building Guidelines

## Core MCP Concepts

Model Context Protocol (MCP) servers provide three main types of capabilities:

1. **Resources**: File-like data that can be read by clients (like API responses or file contents)
2. **Tools**: Functions that can be called by the LLM (with user approval)
3. **Prompts**: Pre-written templates that help users accomplish specific tasks

## Architecture Overview

An MCP server follows a specific architecture:

1. **SDK Integration**: Uses the `@modelcontextprotocol/sdk` package
2. **Tool Definition**: Tools are registered using the `server.tool()` method
3. **Transport Layer**: Connects via a transport mechanism (typically stdio)
4. **Schema Validation**: Uses Zod for parameter validation

## Setting Up an MCP Server

### Prerequisites

- Node.js (16+)
- TypeScript
- `@modelcontextprotocol/sdk` package
- `zod` for schema validation

### Project Structure

```
project-root/
├── src/
│   ├── index.ts         # Main server entry point
│   ├── tools/           # Tool implementations
│   ├── services/        # Business logic
│   └── types/           # TypeScript type definitions
├── package.json
├── tsconfig.json
└── README.md
```

### Basic Setup Steps

1. **Install Dependencies**:
   ```bash
   npm install @modelcontextprotocol/sdk zod
   npm install -D @types/node typescript
   ```

2. **Configure TypeScript**:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "Node16",
       "moduleResolution": "Node16",
       "outDir": "./build",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules"]
   }
   ```

3. **Update package.json**:
   ```json
   {
     "type": "module",
     "bin": {
       "my-tool": "./build/index.js"
     },
     "scripts": {
       "build": "tsc && chmod 755 build/index.js",
       "start": "node build/index.js"
     },
     "files": [
       "build"
     ]
   }
   ```

## Implementing an MCP Server

### Server Initialization

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create server instance
const server = new McpServer({
  name: "my-server",
  version: "1.0.0",
});
```

### Defining Tools

Tools are defined using the `server.tool()` method, which takes:
1. Tool name
2. Tool description
3. Parameter schema (using Zod)
4. Handler function

```typescript
import { z } from "zod";

server.tool(
  "tool-name",
  "Tool description",
  {
    paramName: z.string().describe("Parameter description"),
  },
  async ({ paramName }) => {
    // Tool implementation logic
    const result = await doSomething(paramName);
    
    return {
      content: [
        {
          type: "text",
          text: `Result: ${result}`,
        },
      ],
    };
  }
);
```

### Starting the Server

```typescript
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

## Testing with Claude for Desktop

To use your MCP server with Claude for Desktop:

1. Build your server: `npm run build`
2. Update Claude config at `~/Library/Application Support/Claude/claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "my-server": {
         "command": "node",
         "args": [
           "/ABSOLUTE/PATH/TO/PARENT/FOLDER/my-server/build/index.js"
         ]
       }
     }
   }
   ```
3. Restart Claude for Desktop
4. Look for the hammer icon that indicates available tools

## Troubleshooting

If your MCP server isn't being detected:

1. Check logs in Claude for Desktop
2. Verify the absolute path in your config
3. Make sure your server builds correctly
4. Ensure your server is following the MCP protocol correctly
5. Test running your server from the command line

## Best Practices

1. **Error Handling**: Implement robust error handling in tool functions
2. **Parameter Validation**: Use Zod to validate all parameters
3. **Documentation**: Clearly document each tool's purpose and parameters
4. **Modular Design**: Separate tool definitions from business logic
5. **Asynchronous Processing**: Use async/await for all I/O operations

## Resources

- [MCP Specification](https://github.com/anthropics/model-context-protocol)
- [MCP SDK Documentation](https://github.com/anthropics/model-context-protocol/tree/main/nodejs)
- [Zod Documentation](https://github.com/colinhacks/zod) 