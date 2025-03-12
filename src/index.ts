/**
 * Flutter MCP Server - Main entry point
 * 
 * This server provides MCP tools for debugging and monitoring Flutter applications
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";
import { createFlutterTools } from './tools';
import { logger } from './utils/logger';
import { FlutterTool } from './tools/tool-types';

/**
 * Initialize and start the MCP server with Flutter tools
 * @param {number} port - Port to run the server on
 * @returns {Promise<void>}
 */
async function startServer(port: number = 3000): Promise<void> {
  try {
    logger.info('Starting Flutter tools MCP server...');
    
    // Initialize server
    const server = new Server({
      name: "flutter-mcp-server",
      version: "1.0.0",
    }, {
      capabilities: {
        tools: {} // Enable tools capability
      }
    });
    
    // Get Flutter tools
    const flutterTools = createFlutterTools();
    
    // Handle tool listing
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.info("Listing tools");
      return {
        tools: flutterTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      };
    });
    
    // Handle tool execution
    server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;
      logger.info(`Tool execution requested: ${name}`);
      
      // Find the requested tool
      const tool = flutterTools.find((t: FlutterTool) => t.name === name);
      
      if (!tool) {
        logger.error(`Tool not found: ${name}`);
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error: Tool "${name}" not found`
          }]
        };
      }
      
      try {
        // Execute the tool
        logger.info(`Executing tool: ${name} with args: ${JSON.stringify(args)}`);
        const result = await tool.execute(args);
        logger.info(`Tool execution successful: ${name}`);
        return result;
      } catch (error) {
        logger.error(`Tool execution failed: ${name}`, error);
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    });
    
    // Connect to transport
    const transport = new StdioServerTransport();
    logger.info("Connecting to transport...");
    await server.connect(transport);
    logger.info("Connected to transport");
    logger.info(`Flutter tools MCP server started on port ${port}`);
  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Start server when this module is run directly
if (require.main === module) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  startServer(port);
}

// Export for programmatic usage
export { startServer }; 