/**
 * Flutter Tools for MCP
 * 
 * This module provides tools for interacting with Flutter applications through
 * the Flutter Connector Server.
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

// Configuration for Flutter Connector Server
const FLUTTER_CONNECTOR_URL = process.env.FLUTTER_CONNECTOR_URL || 'http://localhost:3030';
let connectorInitialized = false;
let connectorToken: string | null = null;

// API Key for authentication with the Flutter Connector Server
const FLUTTER_CONNECTOR_API_KEY = process.env.FLUTTER_CONNECTOR_API_KEY || '';

/**
 * Initialize the Flutter Connector client
 */
async function initializeConnector(): Promise<boolean> {
  if (connectorInitialized) {
    return true;
  }

  try {
    // Check if the connector is reachable
    const healthResponse = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/health/check`);
    
    if (healthResponse.status !== 200) {
      logger.error('Flutter Connector Server is not available');
      return false;
    }
    
    // Authenticate if API key is provided
    if (FLUTTER_CONNECTOR_API_KEY) {
      try {
        const authResponse = await axios.post(`${FLUTTER_CONNECTOR_URL}/api/login`, {}, {
          headers: {
            'x-api-key': FLUTTER_CONNECTOR_API_KEY
          }
        });
        
        if (authResponse.status === 200 && authResponse.data.token) {
          connectorToken = authResponse.data.token;
          logger.info('Successfully authenticated with Flutter Connector Server');
        }
      } catch (authError) {
        logger.warn('Failed to authenticate with Flutter Connector Server', authError);
        // Continue without authentication if it fails
      }
    }
    
    connectorInitialized = true;
    logger.info('Flutter Connector Client initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Flutter Connector Client', error);
    return false;
  }
}

/**
 * Get authorized headers for API requests
 */
function getHeaders() {
  const headers: Record<string, string> = {};
  
  if (connectorToken) {
    headers['Authorization'] = `Bearer ${connectorToken}`;
  }
  
  return headers;
}

/**
 * Get a list of running Flutter apps
 */
export async function getRunningApps() {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Get list of apps from the connector
    const response = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/apps`, {
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { apps: response.data };
    } else {
      return { error: 'Failed to get app list' };
    }
  } catch (error) {
    logger.error('Error getting running apps:', error);
    return { error: 'Failed to get app list' };
  }
}

/**
 * Get a specific Flutter app by ID
 */
export async function getApp(appId: string) {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Get app details from the connector
    const response = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/apps/${appId}`, {
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { app: response.data };
    } else {
      return { error: 'App not found' };
    }
  } catch (error) {
    logger.error(`Error getting app ${appId}:`, error);
    return { error: 'Failed to get app details' };
  }
}

/**
 * Start a Flutter app
 */
export async function startApp(appPath: string, deviceId?: string) {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Start app through the connector
    const response = await axios.post(`${FLUTTER_CONNECTOR_URL}/api/apps/start`, {
      appPath,
      deviceId
    }, {
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { app: response.data };
    } else {
      return { error: 'Failed to start app' };
    }
  } catch (error) {
    logger.error('Error starting app:', error);
    return { error: 'Failed to start app' };
  }
}

/**
 * Stop a Flutter app
 */
export async function stopApp(appId: string) {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Stop app through the connector
    const response = await axios.post(`${FLUTTER_CONNECTOR_URL}/api/apps/${appId}/stop`, {}, {
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { success: true };
    } else {
      return { error: 'Failed to stop app' };
    }
  } catch (error) {
    logger.error(`Error stopping app ${appId}:`, error);
    return { error: 'Failed to stop app' };
  }
}

/**
 * Get logs for a Flutter app
 */
export async function getAppLogs(appId: string, limit?: number) {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Get app logs from the connector
    const response = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/apps/${appId}/logs`, {
      params: { limit },
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { logs: response.data };
    } else {
      return { error: 'Failed to get app logs' };
    }
  } catch (error) {
    logger.error(`Error getting logs for app ${appId}:`, error);
    return { error: 'Failed to get app logs' };
  }
}

/**
 * Perform a hot reload on a Flutter app
 */
export async function hotReload(appId: string) {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Trigger hot reload through the connector
    const response = await axios.post(`${FLUTTER_CONNECTOR_URL}/api/apps/${appId}/hot-reload`, {}, {
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { success: true };
    } else {
      return { error: 'Failed to hot reload app' };
    }
  } catch (error) {
    logger.error(`Error hot reloading app ${appId}:`, error);
    return { error: 'Failed to hot reload app' };
  }
}

/**
 * Take a screenshot of a Flutter app
 */
export async function takeScreenshot(appId: string) {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Get app to check if it exists
    const appResponse = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/apps/${appId}`, {
      headers: getHeaders()
    });
    
    if (appResponse.status !== 200) {
      return { error: 'App not found' };
    }
    
    // Take screenshot through the connector
    const response = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/apps/${appId}/screenshot`, {
      headers: getHeaders()
    });
    
    if (response.status === 200 && response.data.base64) {
      // Remove the base64 prefix if present and return just the data
      const base64Data = response.data.base64.replace(/^data:image\/png;base64,/, '');
      return { data: base64Data };
    } else {
      return { error: 'Failed to take screenshot' };
    }
  } catch (error) {
    logger.error(`Error taking screenshot for app ${appId}:`, error);
    return { error: 'Failed to take screenshot' };
  }
}

/**
 * Get network traffic for a Flutter app
 */
export async function getNetworkTraffic(appId: string) {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Get network traffic from the connector
    const response = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/apps/${appId}/network`, {
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { traffic: response.data };
    } else {
      return { error: 'Failed to get network traffic' };
    }
  } catch (error) {
    logger.error(`Error getting network traffic for app ${appId}:`, error);
    return { error: 'Failed to get network traffic' };
  }
}

/**
 * Get performance metrics for a Flutter app
 */
export async function getPerformanceMetrics(appId: string) {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Get performance metrics from the connector
    const response = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/apps/${appId}/performance`, {
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { metrics: response.data };
    } else {
      return { error: 'Failed to get performance metrics' };
    }
  } catch (error) {
    logger.error(`Error getting performance metrics for app ${appId}:`, error);
    return { error: 'Failed to get performance metrics' };
  }
}

/**
 * Get device information
 */
export async function getDevices() {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Get devices from the connector
    const response = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/devices`, {
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { devices: response.data };
    } else {
      return { error: 'Failed to get devices' };
    }
  } catch (error) {
    logger.error('Error getting devices:', error);
    return { error: 'Failed to get devices' };
  }
}

/**
 * Get available debugging information and DevTools URL
 */
export async function getDebugInfo(appId: string) {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Get debug information from the connector
    const response = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/apps/${appId}/debug`, {
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { debug: response.data };
    } else {
      return { error: 'Failed to get debug information' };
    }
  } catch (error) {
    logger.error(`Error getting debug info for app ${appId}:`, error);
    return { error: 'Failed to get debug information' };
  }
}

/**
 * Get system health status
 */
export async function getSystemHealth() {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Get health status from the connector
    const response = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/health`, {
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { health: response.data };
    } else {
      return { error: 'Failed to get system health' };
    }
  } catch (error) {
    logger.error('Error getting system health:', error);
    return { error: 'Failed to get system health' };
  }
}

/**
 * Get analytics insights for a Flutter app
 */
export async function getAnalyticsInsights(appId: string) {
  try {
    // Initialize connector if needed
    if (!await initializeConnector()) {
      return { error: 'Flutter Connector Server is not available' };
    }
    
    // Get analytics insights from the connector
    const response = await axios.get(`${FLUTTER_CONNECTOR_URL}/api/apps/${appId}/analytics`, {
      headers: getHeaders()
    });
    
    if (response.status === 200) {
      return { insights: response.data };
    } else {
      return { error: 'Failed to get analytics insights' };
    }
  } catch (error) {
    logger.error(`Error getting analytics insights for app ${appId}:`, error);
    return { error: 'Failed to get analytics insights' };
  }
}
