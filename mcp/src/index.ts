#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Import tool implementations
import { listFlutterApps } from "./tools/list-flutter-apps.js";
import { connectToApp } from "./tools/connect-to-app.js";
import { connectByUrl } from "./tools/connect-by-url.js";
import { getAppLogs } from "./tools/get-app-logs.js";
import { getPerformanceMetrics } from "./tools/get-performance-metrics.js";
import { getNetworkRequests } from "./tools/get-network-requests.js";
import { takeScreenshot } from "./tools/take-screenshot.js";
import { getWidgetTree } from "./tools/get-widget-tree.js";
import { analyzePerformance } from "./tools/analyze-performance.js";

// Create server instance
const server = new McpServer({
  name: "flutter-tools",
  version: "1.0.0",
});

// Register Flutter tool

// App Discovery Tools
server.tool(
  "list-flutter-apps",
  "List all running Flutter applications",
  {},
  listFlutterApps
);

server.tool(
  "connect-to-app",
  "Connect to a specific Flutter app by ID",
  {
    appId: z.string().describe("The ID of the Flutter app to connect to")
  },
  connectToApp
);

server.tool(
  "connect-by-url",
  "Connect to a Flutter app by VM service URL",
  {
    vmServiceUrl: z.string().describe("The VM service URL (e.g., ws://127.0.0.1:55285/hqyzYdQKcLg=/ws)")
  },
  connectByUrl
);

// Log and Metrics Collection Tools
server.tool(
  "get-app-logs",
  "Retrieve logs from a connected Flutter app",
  {
    appId: z.string().describe("The ID of the Flutter app to get logs from"),
    lines: z.number().optional().describe("Number of log lines to retrieve (optional)")
  },
  getAppLogs
);

server.tool(
  "get-performance-metrics",
  "Get performance metrics from a Flutter app",
  {
    appId: z.string().describe("The ID of the Flutter app to get metrics from"),
    metric: z.enum(["memory", "cpu", "ui", "all"]).optional().describe("Specific metric to retrieve (optional, defaults to 'all')")
  },
  getPerformanceMetrics
);

server.tool(
  "get-network-requests",
  "Fetch network request data from a Flutter app",
  {
    appId: z.string().describe("The ID of the Flutter app to get network requests from"),
    count: z.number().optional().describe("Number of recent network requests to retrieve (optional)")
  },
  getNetworkRequests
);

// Debugging Tools
server.tool(
  "take-screenshot",
  "Capture a screenshot of the Flutter app UI",
  {
    appId: z.string().describe("The ID of the Flutter app to take screenshot from")
  },
  takeScreenshot
);

server.tool(
  "get-widget-tree",
  "Retrieve the widget tree structure of a Flutter app",
  {
    appId: z.string().describe("The ID of the Flutter app to get widget tree from")
  },
  getWidgetTree
);

server.tool(
  "analyze-performance",
  "Run a performance analysis on the Flutter app",
  {
    appId: z.string().describe("The ID of the Flutter app to analyze"),
    duration: z.number().optional().describe("Duration of the analysis in seconds (optional, defaults to 5)")
  },
  analyzePerformance
);

// Main function to run the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Flutter Tools MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
}); 