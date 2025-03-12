#!/usr/bin/env node

/**
 * Flutter Connector Server
 * 
 * This is a standalone server that monitors Flutter applications and provides
 * a REST API for the MCP server to query information about these apps.
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Import our modules
import { initAppDiscovery } from './app-discovery';
import { getAppInstances, getAppInstance, startFlutterApp, stopFlutterApp } from './app-manager';
import { setupApiRoutes } from './api-routes';
import { logger } from './utils/logger';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const DEFAULT_PORT = 3030;
const DEFAULT_HOST = '0.0.0.0';

// Get port from environment variable or use default
const PORT = process.env.FLUTTER_CONNECTOR_PORT 
  ? parseInt(process.env.FLUTTER_CONNECTOR_PORT, 10) 
  : DEFAULT_PORT;

// Get host from environment variable or use default
const HOST = process.env.FLUTTER_CONNECTOR_HOST || DEFAULT_HOST;

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

// Store active WebSocket connections
const activeConnections = new Set<WebSocket>();

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket) => {
  logger.info('Client connected to WebSocket');
  activeConnections.add(ws);

  // Handle WebSocket messages
  ws.on('message', (message: string | Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      logger.debug('Received WebSocket message:', data);
      
      // Handle different message types here
      // For now, just echo back
      ws.send(JSON.stringify({ type: 'echo', data }));
    } catch (error) {
      logger.error('Error processing WebSocket message:', error);
    }
  });

  // Handle WebSocket disconnection
  ws.on('close', () => {
    logger.info('Client disconnected from WebSocket');
    activeConnections.delete(ws);
  });
});

// Broadcast message to all connected clients
const broadcastMessage = (message: any): void => {
  activeConnections.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) { // 1 = OPEN
      client.send(JSON.stringify(message));
    }
  });
};

// Set up API routes
setupApiRoutes(app, { broadcastMessage });

// Server identity endpoint (for MCP server discovery)
app.get('/.identity', (req, res) => {
  res.json({
    name: 'flutter-connector-server',
    version: '1.0.0',
    signature: 'mcp-flutter-connector-server',
  });
});

// Get port endpoint
app.get('/.port', (req, res) => {
  res.send(PORT.toString());
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Start the server
server.listen(PORT, HOST, async () => {
  logger.info(`Flutter Connector Server listening on http://${HOST}:${PORT}`);
  
  // Log all network interfaces for easier discovery
  const networkInterfaces = os.networkInterfaces();
  logger.info('Available on the following network addresses:');
  
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    const interfaces = networkInterfaces[interfaceName];
    if (interfaces) {
      interfaces.forEach((iface) => {
        if (!iface.internal && iface.family === 'IPv4') {
          logger.info(`  - http://${iface.address}:${PORT}`);
        }
      });
    }
  });
  
  // Start app discovery
  try {
    await initAppDiscovery();
    logger.info('Flutter app discovery initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Flutter app discovery:', error);
  }
});

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Shutting down Flutter Connector Server...');
  
  // Close all WebSocket connections
  for (const client of wss.clients) {
    client.terminate();
  }
  
  // Close the HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { broadcastMessage }; 