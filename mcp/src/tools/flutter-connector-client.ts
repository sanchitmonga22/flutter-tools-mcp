/**
 * Flutter Connector Client
 * 
 * This module provides a client for connecting to the Flutter Connector Server
 * and exposing its functionality to the MCP server.
 */

import axios from 'axios';
import WebSocket from 'ws';
import { logger } from '../utils/logger.js';
import { FlutterAppInstance, NetworkRequest, PerformanceData } from './tool-types.js';

// Default configuration
const DEFAULT_CONNECTOR_PORT = 3030;
const DEFAULT_CONNECTOR_HOST = 'localhost';
const DEFAULT_CONNECTION_TIMEOUT = 5000; // 5 seconds

// Connection state
let connectorHost = DEFAULT_CONNECTOR_HOST;
let connectorPort = DEFAULT_CONNECTOR_PORT;
let connectorBaseUrl = `http://${connectorHost}:${connectorPort}`;
let wsClient: WebSocket | null = null;
let isConnected = false;
let reconnectAttempts = 0;
let reconnectInterval: NodeJS.Timeout | null = null;
let messageHandlers: Map<string, ((data: any) => void)[]> = new Map();

/**
 * Configure the Flutter Connector Client
 */
export function configureConnectorClient(config: {
  host?: string;
  port?: number;
}) {
  if (config.host) {
    connectorHost = config.host;
  }
  
  if (config.port) {
    connectorPort = config.port;
  }
  
  connectorBaseUrl = `http://${connectorHost}:${connectorPort}`;
  logger.info(`Flutter Connector Client configured to connect to: ${connectorBaseUrl}`);
}

/**
 * Initialize the connection to the Flutter Connector Server
 */
export async function initConnectorClient(): Promise<boolean> {
  try {
    // First check if the server is reachable
    const identityResponse = await axios.get(`${connectorBaseUrl}/.identity`, {
      timeout: DEFAULT_CONNECTION_TIMEOUT
    });
    
    if (
      !identityResponse.data ||
      identityResponse.data.signature !== 'mcp-flutter-connector-server'
    ) {
      logger.error('Failed to verify Flutter Connector Server identity');
      return false;
    }
    
    logger.info(`Connected to Flutter Connector Server: ${identityResponse.data.name} v${identityResponse.data.version}`);
    
    // Initialize WebSocket connection
    connectWebSocket();
    
    isConnected = true;
    return true;
  } catch (error) {
    logger.error('Failed to connect to Flutter Connector Server:', error);
    return false;
  }
}

/**
 * Connect to the WebSocket server for real-time updates
 */
function connectWebSocket() {
  try {
    const wsUrl = `ws://${connectorHost}:${connectorPort}/ws`;
    logger.info(`Connecting to WebSocket at ${wsUrl}`);
    
    wsClient = new WebSocket(wsUrl);
    
    wsClient.on('open', () => {
      logger.info('WebSocket connection established with Flutter Connector Server');
      reconnectAttempts = 0;
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
    });
    
    wsClient.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        handleWebSocketMessage(message);
      } catch (error) {
        logger.error('Error parsing WebSocket message:', error);
      }
    });
    
    wsClient.on('error', (error) => {
      logger.error('WebSocket connection error:', error);
    });
    
    wsClient.on('close', () => {
      logger.warn('WebSocket connection closed');
      wsClient = null;
      
      // Setup reconnect if not already trying
      if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
          reconnectAttempts++;
          logger.info(`Attempting to reconnect WebSocket (attempt ${reconnectAttempts})...`);
          connectWebSocket();
          
          // Give up after 10 attempts
          if (reconnectAttempts >= 10 && reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
            logger.error('Failed to reconnect WebSocket after 10 attempts');
          }
        }, 10000); // Try every 10 seconds
      }
    });
  } catch (error) {
    logger.error('Failed to establish WebSocket connection:', error);
  }
}

/**
 * Handle incoming WebSocket messages
 */
function handleWebSocketMessage(message: any) {
  logger.debug('Received WebSocket message:', message);
  
  const { type, data } = message;
  
  if (!type) {
    logger.warn('Received WebSocket message with no type');
    return;
  }
  
  // Get handlers for this message type
  const handlers = messageHandlers.get(type) || [];
  
  // Execute all handlers
  handlers.forEach(handler => {
    try {
      handler(data);
    } catch (error) {
      logger.error(`Error in WebSocket handler for type ${type}:`, error);
    }
  });
}

/**
 * Register a handler for WebSocket messages of a specific type
 */
export function onWebSocketMessage(type: string, handler: (data: any) => void) {
  const handlers = messageHandlers.get(type) || [];
  handlers.push(handler);
  messageHandlers.set(type, handlers);
}

/**
 * Get a list of all discovered Flutter apps
 */
export async function connectorListApps(): Promise<FlutterAppInstance[]> {
  try {
    const response = await axios.get(`${connectorBaseUrl}/api/apps`);
    return response.data;
  } catch (error) {
    logger.error('Error fetching apps from connector server:', error);
    return [];
  }
}

/**
 * Get details about a specific Flutter app
 */
export async function connectorGetApp(appId: string): Promise<FlutterAppInstance | null> {
  try {
    const response = await axios.get(`${connectorBaseUrl}/api/apps/${appId}`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching app ${appId} from connector server:`, error);
    return null;
  }
}

/**
 * Start a new Flutter app
 */
export async function connectorStartApp(projectPath: string, deviceId?: string): Promise<FlutterAppInstance | null> {
  try {
    const response = await axios.post(`${connectorBaseUrl}/api/apps`, {
      projectPath,
      deviceId: deviceId || 'default'
    });
    return response.data;
  } catch (error) {
    logger.error(`Error starting Flutter app at ${projectPath}:`, error);
    return null;
  }
}

/**
 * Stop a running Flutter app
 */
export async function connectorStopApp(appId: string): Promise<boolean> {
  try {
    await axios.delete(`${connectorBaseUrl}/api/apps/${appId}`);
    return true;
  } catch (error) {
    logger.error(`Error stopping Flutter app ${appId}:`, error);
    return false;
  }
}

/**
 * Get logs for a Flutter app
 */
export async function connectorGetLogs(appId: string, limit?: number, filter?: string): Promise<string[]> {
  try {
    const params: Record<string, string | number> = {};
    if (limit !== undefined) params.limit = limit;
    if (filter) params.filter = filter;
    
    const response = await axios.get(`${connectorBaseUrl}/api/apps/${appId}/logs`, { params });
    return response.data;
  } catch (error) {
    logger.error(`Error fetching logs for app ${appId}:`, error);
    return [];
  }
}

/**
 * Add a log entry for a Flutter app
 */
export async function connectorAddLog(appId: string, log: string): Promise<boolean> {
  try {
    await axios.post(`${connectorBaseUrl}/api/apps/${appId}/logs`, { log });
    return true;
  } catch (error) {
    logger.error(`Error adding log for app ${appId}:`, error);
    return false;
  }
}

/**
 * Get network requests for a Flutter app
 */
export async function connectorGetNetworkRequests(appId: string, limit?: number): Promise<NetworkRequest[]> {
  try {
    const params: Record<string, number> = {};
    if (limit !== undefined) params.limit = limit;
    
    const response = await axios.get(`${connectorBaseUrl}/api/apps/${appId}/network`, { params });
    return response.data;
  } catch (error) {
    logger.error(`Error fetching network requests for app ${appId}:`, error);
    return [];
  }
}

/**
 * Get performance data for a Flutter app
 */
export async function connectorGetPerformanceData(appId: string): Promise<PerformanceData | null> {
  try {
    const response = await axios.get(`${connectorBaseUrl}/api/apps/${appId}/performance`);
    return response.data;
  } catch (error) {
    logger.error(`Error fetching performance data for app ${appId}:`, error);
    return null;
  }
}

/**
 * Trigger a hot reload for a Flutter app
 */
export async function connectorHotReload(appId: string): Promise<boolean> {
  try {
    await axios.post(`${connectorBaseUrl}/api/apps/${appId}/hot-reload`);
    return true;
  } catch (error) {
    logger.error(`Error triggering hot reload for app ${appId}:`, error);
    return false;
  }
}

/**
 * Take a screenshot of a Flutter app
 */
export async function connectorTakeScreenshot(appId: string): Promise<string | null> {
  try {
    const response = await axios.post(`${connectorBaseUrl}/api/screenshot/${appId}`);
    return response.data.screenshotBase64;
  } catch (error) {
    logger.error(`Error taking screenshot for app ${appId}:`, error);
    return null;
  }
}

/**
 * Check if we're connected to the Flutter Connector Server
 */
export function isConnectorAvailable(): boolean {
  return isConnected;
} 