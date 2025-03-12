/**
 * Flutter tools implementation
 */

import { promises as fs } from 'fs';
import { resolve } from 'path';
import { z } from "zod";
import { logger } from '../utils/logger.js';
// Replace direct imports with connector client
import * as flutterConnector from './flutter-connector-client.js';

// Import MAX_LOGS from app-manager
// Since we can't directly import a constant from app-manager.ts, we'll define it here
const MAX_LOGS = 1000;

// Define Zod schemas for each tool
export const startAppSchema = {
  projectPath: z.string().describe("Path to the Flutter project directory"),
  deviceId: z.string().optional().default("default").describe("Device ID to run the app on (optional, default: 'default')"),
};

export const stopAppSchema = {
  appId: z.string().describe("ID of the app to stop"),
};

export const getLogsSchema = {
  appId: z.string().describe("ID of the app to get logs from"),
  limit: z.number().optional().default(100).describe("Maximum number of log entries to return (default: 100)"),
  filter: z.string().optional().describe("Filter logs containing this text (optional)"),
};

export const takeScreenshotSchema = {
  appId: z.string().describe("ID of the app to screenshot"),
};

export const getNetworkDataSchema = {
  appId: z.string().describe("ID of the app to get network data from"),
  limit: z.number().optional().default(50).describe("Maximum number of network requests to return (default: 50)"),
};

export const getPerformanceDataSchema = {
  appId: z.string().describe("ID of the app to get performance data from"),
};

export const hotReloadSchema = {
  appId: z.string().describe("ID of the app to hot reload"),
};

export const listRunningAppsSchema = {};

// Tool execution functions - updated to use connector client

/**
 * Start a Flutter app
 */
export async function startApp({ projectPath, deviceId }: { 
  projectPath: string; 
  deviceId?: string; 
}) {
  try {
    logger.info(`Starting Flutter app at ${projectPath}`);
    
    // Validate project path
    const projectPathResolved = resolve(projectPath);
    try {
      const stats = await fs.stat(projectPathResolved);
      if (!stats.isDirectory()) {
        throw new Error('Project path is not a directory');
      }
      
      // Check for pubspec.yaml to validate it's a Flutter project
      const pubspecPath = resolve(projectPathResolved, 'pubspec.yaml');
      await fs.access(pubspecPath);
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: `Invalid Flutter project path: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
    
    // Check if connector is available, otherwise fall back to local implementation
    if (!flutterConnector.isConnectorAvailable()) {
      logger.warn('Flutter Connector Server not available, using local implementation');
      // Try to initialize the connector
      const connected = await flutterConnector.initConnectorClient();
      if (!connected) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to connect to Flutter Connector Server. Please ensure it's running.`
          }]
        };
      }
    }
    
    // Start app using connector
    const app = await flutterConnector.connectorStartApp(projectPathResolved, deviceId);
    
    if (!app) {
      return {
        content: [{
          type: "text" as const,
          text: `Failed to start Flutter app. Check the connector server logs for details.`
        }]
      };
    }
    
    return {
      content: [{
        type: "text" as const,
        text: `Flutter app started successfully!\nApp ID: ${app.id}\nVM Service URL: ${app.vmServiceUrl || 'Not available yet'}\nStatus: ${app.status}`
      }]
    };
  } catch (error) {
    logger.error('Error starting Flutter app:', error);
    return {
      content: [{
        type: "text" as const,
        text: `Error starting Flutter app: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * Stop a Flutter app
 */
export async function stopApp({ appId }: { appId: string }) {
  try {
    logger.info(`Stopping Flutter app with ID ${appId}`);
    
    // Check if connector is available
    if (!flutterConnector.isConnectorAvailable()) {
      logger.warn('Flutter Connector Server not available, using local implementation');
      // Try to initialize the connector
      const connected = await flutterConnector.initConnectorClient();
      if (!connected) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to connect to Flutter Connector Server. Please ensure it's running.`
          }]
        };
      }
    }
    
    // Stop app using connector
    const success = await flutterConnector.connectorStopApp(appId);
    
    if (success) {
      return {
        content: [{
          type: "text" as const,
          text: `Successfully stopped Flutter app with ID: ${appId}`
        }]
      };
    } else {
      return {
        content: [{
          type: "text" as const,
          text: `Failed to stop Flutter app with ID: ${appId}. App may not be running or was already stopped.`
        }]
      };
    }
  } catch (error) {
    logger.error('Error stopping Flutter app:', error);
    return {
      content: [{
        type: "text" as const,
        text: `Error stopping Flutter app: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * Get logs from a Flutter app
 */
export async function getLogs({ appId, limit = 100, filter }: { 
  appId: string; 
  limit?: number; 
  filter?: string;
}) {
  try {
    logger.info(`Getting logs for Flutter app with ID ${appId}`);
    
    // Check if connector is available
    if (!flutterConnector.isConnectorAvailable()) {
      logger.warn('Flutter Connector Server not available, using local implementation');
      // Try to initialize the connector
      const connected = await flutterConnector.initConnectorClient();
      if (!connected) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to connect to Flutter Connector Server. Please ensure it's running.`
          }]
        };
      }
    }
    
    // Get app using connector
    const app = await flutterConnector.connectorGetApp(appId);
    
    if (!app) {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} not found`
        }]
      };
    }
    
    // Get logs using connector
    const logs = await flutterConnector.connectorGetLogs(appId, limit, filter);
    
    // Check if we have meaningful logs
    if (logs.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `No logs available for app with ID ${appId}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text" as const,
        text: `Logs for Flutter app with ID ${appId}:\n\n${logs.join('\n')}`
      }]
    };
  } catch (error) {
    logger.error('Error getting logs:', error);
    return {
      content: [{
        type: "text" as const,
        text: `Error getting logs: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * Take a screenshot of a Flutter app
 */
export async function takeScreenshot({ appId }: { appId: string }) {
  try {
    logger.info(`Taking screenshot of Flutter app with ID ${appId}`);
    
    // Check if connector is available
    if (!flutterConnector.isConnectorAvailable()) {
      logger.warn('Flutter Connector Server not available, using local implementation');
      // Try to initialize the connector
      const connected = await flutterConnector.initConnectorClient();
      if (!connected) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to connect to Flutter Connector Server. Please ensure it's running.`
          }]
        };
      }
    }
    
    // Get app using connector
    const app = await flutterConnector.connectorGetApp(appId);
    
    if (!app) {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} not found`
        }]
      };
    }
    
    // Take screenshot using connector
    const screenshotBase64 = await flutterConnector.connectorTakeScreenshot(appId);
    
    if (!screenshotBase64) {
      return {
        content: [{
          type: "text" as const,
          text: `Failed to take screenshot of Flutter app with ID ${appId}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text" as const,
        text: `Screenshot taken successfully!`
      }, {
        type: "image" as const,
        mimeType: "image/png",
        data: screenshotBase64.replace(/^data:image\/png;base64,/, '')
      }]
    };
  } catch (error) {
    logger.error('Error taking screenshot:', error);
    return {
      content: [{
        type: "text" as const,
        text: `Error taking screenshot: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * Get network data from a Flutter app
 */
export async function getNetworkData({ appId, limit = 50 }: { 
  appId: string; 
  limit?: number;
}) {
  try {
    logger.info(`Getting network data for Flutter app with ID ${appId}`);
    
    // Check if connector is available
    if (!flutterConnector.isConnectorAvailable()) {
      logger.warn('Flutter Connector Server not available, using local implementation');
      // Try to initialize the connector
      const connected = await flutterConnector.initConnectorClient();
      if (!connected) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to connect to Flutter Connector Server. Please ensure it's running.`
          }]
        };
      }
    }
    
    // Get app using connector
    const app = await flutterConnector.connectorGetApp(appId);
    
    if (!app) {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} not found`
        }]
      };
    }
    
    // Get network requests using connector
    const networkRequests = await flutterConnector.connectorGetNetworkRequests(appId, limit);
    
    if (networkRequests.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `No network requests captured for app with ID ${appId}`
        }]
      };
    }
    
    // Format the network requests into a readable table
    const formattedNetworkData = networkRequests.map(req => {
      const status = req.status || 'Pending';
      const duration = req.responseTime && req.requestTime 
        ? `${Math.round((req.responseTime - req.requestTime) * 100) / 100}ms`
        : 'Pending';
      
      return `${req.method} ${req.url} - Status: ${status}, Duration: ${duration}`;
    }).join('\n');
    
    return {
      content: [{
        type: "text" as const,
        text: `Network requests for Flutter app with ID ${appId}:\n\n${formattedNetworkData}`
      }]
    };
  } catch (error) {
    logger.error('Error getting network data:', error);
    return {
      content: [{
        type: "text" as const,
        text: `Error getting network data: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * Get performance data from a Flutter app
 */
export async function getPerformanceData({ appId }: { appId: string }) {
  try {
    logger.info(`Getting performance data for Flutter app with ID ${appId}`);
    
    // Check if connector is available
    if (!flutterConnector.isConnectorAvailable()) {
      logger.warn('Flutter Connector Server not available, using local implementation');
      // Try to initialize the connector
      const connected = await flutterConnector.initConnectorClient();
      if (!connected) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to connect to Flutter Connector Server. Please ensure it's running.`
          }]
        };
      }
    }
    
    // Get app using connector
    const app = await flutterConnector.connectorGetApp(appId);
    
    if (!app) {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} not found`
        }]
      };
    }
    
    // Get performance data using connector
    const performanceData = await flutterConnector.connectorGetPerformanceData(appId);
    
    if (!performanceData) {
      return {
        content: [{
          type: "text" as const,
          text: `No performance data available for app with ID ${appId}`
        }]
      };
    }
    
    // Format the performance data
    const formattedData = [
      `CPU Usage: ${performanceData.cpuUsage !== undefined ? `${performanceData.cpuUsage.toFixed(2)}%` : 'Not available'}`,
      `Memory Usage: ${performanceData.memoryUsage !== undefined ? `${(performanceData.memoryUsage / (1024 * 1024)).toFixed(2)} MB` : 'Not available'}`,
      `Frame Rate: ${performanceData.frameRate !== undefined ? `${performanceData.frameRate.toFixed(2)} FPS` : 'Not available'}`,
      `Last Updated: ${performanceData.lastUpdated ? new Date(performanceData.lastUpdated).toLocaleString() : 'Never'}`
    ].join('\n');
    
    return {
      content: [{
        type: "text" as const,
        text: `Performance data for Flutter app with ID ${appId}:\n\n${formattedData}`
      }]
    };
  } catch (error) {
    logger.error('Error getting performance data:', error);
    return {
      content: [{
        type: "text" as const,
        text: `Error getting performance data: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * Trigger a hot reload for a Flutter app
 */
export async function hotReload({ appId }: { appId: string }) {
  try {
    logger.info(`Triggering hot reload for Flutter app with ID ${appId}`);
    
    // Check if connector is available
    if (!flutterConnector.isConnectorAvailable()) {
      logger.warn('Flutter Connector Server not available, using local implementation');
      // Try to initialize the connector
      const connected = await flutterConnector.initConnectorClient();
      if (!connected) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to connect to Flutter Connector Server. Please ensure it's running.`
          }]
        };
      }
    }
    
    // Get app using connector
    const app = await flutterConnector.connectorGetApp(appId);
    
    if (!app) {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} not found`
        }]
      };
    }
    
    // Trigger hot reload using connector
    const success = await flutterConnector.connectorHotReload(appId);
    
    if (!success) {
      return {
        content: [{
          type: "text" as const,
          text: `Failed to trigger hot reload for Flutter app with ID ${appId}`
        }]
      };
    }
    
    return {
      content: [{
        type: "text" as const,
        text: `Hot reload triggered successfully for Flutter app with ID ${appId}`
      }]
    };
  } catch (error) {
    logger.error('Error triggering hot reload:', error);
    return {
      content: [{
        type: "text" as const,
        text: `Error triggering hot reload: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * List all running Flutter apps
 */
export async function listRunningApps() {
  try {
    logger.info('Listing all running Flutter apps');
    
    // Check if connector is available
    if (!flutterConnector.isConnectorAvailable()) {
      logger.warn('Flutter Connector Server not available, using local implementation');
      // Try to initialize the connector
      const connected = await flutterConnector.initConnectorClient();
      if (!connected) {
        return {
          content: [{
            type: "text" as const,
            text: `Failed to connect to Flutter Connector Server. Please ensure it's running.`
          }]
        };
      }
    }
    
    // Get apps using connector
    const apps = await flutterConnector.connectorListApps();
    
    if (apps.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: 'No Flutter apps are currently running'
        }]
      };
    }
    
    // Format the apps
    const formattedApps = apps.map(app => {
      return `ID: ${app.id}\nStatus: ${app.status}\nProject: ${app.projectPath}\nDevice: ${app.deviceId}\nVM Service URL: ${app.vmServiceUrl || 'Not available'}\n`;
    }).join('\n---\n\n');
    
    return {
      content: [{
        type: "text" as const,
        text: `Running Flutter apps:\n\n${formattedApps}`
      }]
    };
  } catch (error) {
    logger.error('Error listing running apps:', error);
    return {
      content: [{
        type: "text" as const,
        text: `Error listing running apps: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}
