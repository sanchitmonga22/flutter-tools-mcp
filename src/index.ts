/**
 * Flutter MCP Server - Main entry point
 * 
 * This server provides MCP tools for debugging and monitoring Flutter applications
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from './utils/logger.js';
import {
  startApp, startAppSchema,
  stopApp, stopAppSchema,
  getLogs, getLogsSchema,
  takeScreenshot, takeScreenshotSchema,
  getNetworkData, getNetworkDataSchema,
  getPerformanceData, getPerformanceDataSchema,
  hotReload, hotReloadSchema,
  listRunningApps, listRunningAppsSchema
} from './tools/flutter-tools.js';

// Create server instance
const server = new McpServer({
  name: "flutter-mcp-server",
  version: "1.0.0",
});

// Register all Flutter tools
logger.info('Registering Flutter tools...');

// Start app tool
server.tool(
  "start-app",
  "Start a Flutter app on a device or emulator",
  startAppSchema,
  startApp
);

// Stop app tool
server.tool(
  "stop-app",
  "Stop a running Flutter app",
  stopAppSchema,
  stopApp
);

// Get logs tool
server.tool(
  "get-logs",
  "Get logs from a running Flutter app",
  getLogsSchema,
  getLogs
);

// Take screenshot tool
server.tool(
  "take-screenshot",
  "Take a screenshot of a running Flutter app",
  takeScreenshotSchema,
  takeScreenshot
);

// Get network data tool
server.tool(
  "get-network-data",
  "Get network traffic data from a running Flutter app",
  getNetworkDataSchema,
  getNetworkData
);

// Get performance data tool
server.tool(
  "get-performance-data",
  "Get performance metrics from a running Flutter app",
  getPerformanceDataSchema,
  getPerformanceData
);

// Hot reload tool
server.tool(
  "hot-reload",
  "Trigger a hot reload in a running Flutter app",
  hotReloadSchema,
  hotReload
);

// List running apps tool
server.tool(
  "list-apps",
  "List all running Flutter apps",
  listRunningAppsSchema,
  listRunningApps
);

// Start the server
async function main(): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    logger.info("Connecting to transport...");
    await server.connect(transport);
    logger.info("Flutter MCP Server running");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Fatal error: ${errorMessage}`);
    process.exit(1);
  }
}

main(); 