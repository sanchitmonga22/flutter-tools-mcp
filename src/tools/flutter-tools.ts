/**
 * Flutter tools implementation
 */

import { promises as fs } from 'fs';
import { resolve } from 'path';
import { z } from "zod";
import { logger } from '../utils/logger.js';
import { startFlutterApp, stopFlutterApp, getAppInstances, getAppInstance } from './app-manager.js';
import { takeAndroidEmulatorScreenshot, takeIOSSimulatorScreenshot, takeAndroidPhysicalDeviceScreenshot } from './screenshot-util.js';

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

// Tool execution functions - updated to match McpServer approach

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
    
    // Start app
    const app = await startFlutterApp(projectPathResolved, deviceId);
    
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
    
    const success = await stopFlutterApp(appId);
    
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
    
    const app = await getAppInstance(appId);
    
    if (!app) {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} not found`
        }]
      };
    }
    
    // Get logs, filter if needed, and take the limit
    let logs = app.logs;
    
    if (filter) {
      logs = logs.filter((log: string) => log.includes(filter));
    }
    
    logs = logs.slice(-Math.min(logs.length, limit));
    
    return {
      content: [{
        type: "text" as const,
        text: logs.join('\n')
      }]
    };
  } catch (error) {
    logger.error('Error getting Flutter app logs:', error);
    return {
      content: [{
        type: "text" as const,
        text: `Error getting logs: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * Take a screenshot of a running Flutter app
 */
export async function takeScreenshot({ appId }: { appId: string }) {
  try {
    logger.info(`Taking screenshot for Flutter app with ID ${appId}`);
    
    const app = await getAppInstance(appId);
    
    if (!app) {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} not found`
        }]
      };
    }
    
    if (app.status !== 'running') {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} is not running (status: ${app.status})`
        }]
      };
    }
    
    // Platform-specific screenshot implementation
    const deviceId = app.deviceId;
    let screenshotData: string | null = null;
    
    if (deviceId.includes('emulator-') || deviceId.includes('emulator:')) {
      // Android emulator
      screenshotData = await takeAndroidEmulatorScreenshot(deviceId);
    } else if (deviceId.includes('simulator-') || deviceId === 'default') {
      // iOS simulator (or default, which we'll assume is iOS simulator)
      screenshotData = await takeIOSSimulatorScreenshot();
    } else {
      // Try a general adb method for physical devices
      screenshotData = await takeAndroidPhysicalDeviceScreenshot(deviceId);
    }
    
    if (!screenshotData) {
      return {
        content: [{
          type: "text" as const,
          text: `Failed to take screenshot for app with ID ${appId}`
        }]
      };
    }
    
    return {
      content: [{
        type: "image" as const,
        data: screenshotData,
        mimeType: "image/png"
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
 * Get network traffic data from a Flutter app
 */
export async function getNetworkData({ appId, limit = 50 }: { 
  appId: string; 
  limit?: number;
}) {
  try {
    logger.info(`Getting network data for Flutter app with ID ${appId}`);
    
    const app = await getAppInstance(appId);
    
    if (!app) {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} not found`
        }]
      };
    }
    
    // Get the most recent network requests up to the limit
    const requests = app.networkRequests.slice(-Math.min(app.networkRequests.length, limit));
    
    // Format network requests as a table
    const requestsTable = requests.map((req: any) => {
      return `${req.method} ${req.url}
Time: ${new Date(req.requestTime).toISOString()}
Status: ${req.status || 'N/A'}
Response Time: ${req.responseTime ? (req.responseTime - req.requestTime) + 'ms' : 'N/A'}
Size: ${req.responseSize || 'N/A'} bytes
Content Type: ${req.contentType || 'N/A'}
${req.error ? 'Error: ' + req.error : ''}
`;
    }).join('\n---\n');
    
    return {
      content: [{
        type: "text" as const,
        text: requests.length > 0 
          ? `Network Requests for App ID ${appId}:\n\n${requestsTable}`
          : `No network requests recorded for App ID ${appId}`
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
    
    const app = await getAppInstance(appId);
    
    if (!app) {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} not found`
        }]
      };
    }
    
    // In a real implementation, we would gather real performance data
    // For now, return placeholder data
    const perfData = app.performanceData;
    
    return {
      content: [{
        type: "text" as const,
        text: `Performance Data for App ID ${appId}:
CPU Usage: ${perfData.cpuUsage || 'N/A'}%
Memory Usage: ${perfData.memoryUsage || 'N/A'} MB
Frame Rate: ${perfData.frameRate || 'N/A'} FPS
Last Updated: ${perfData.lastUpdated ? new Date(perfData.lastUpdated).toISOString() : 'N/A'}
        
Measurements:
${perfData.measurements.length > 0 
  ? perfData.measurements.map((m: any) => `${new Date(m.timestamp).toISOString()} - ${m.metric}: ${m.value}`).join('\n')
  : 'No measurements recorded yet'}`
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
 * Hot reload a Flutter app
 */
export async function hotReload({ appId }: { appId: string }) {
  try {
    logger.info(`Triggering hot reload for Flutter app with ID ${appId}`);
    
    const app = await getAppInstance(appId);
    
    if (!app) {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} not found`
        }]
      };
    }
    
    if (app.status !== 'running') {
      return {
        content: [{
          type: "text" as const,
          text: `App with ID ${appId} is not running (status: ${app.status})`
        }]
      };
    }
    
    // Execute hot reload by sending 'r' to the Flutter process
    if (app.process && app.process.stdin) {
      app.process.stdin.write('r\n');
      
      // Add to logs
      app.logs.push('[INFO] Hot reload triggered');
      
      return {
        content: [{
          type: "text" as const,
          text: `Hot reload triggered for app ID ${appId}`
        }]
      };
    } else {
      return {
        content: [{
          type: "text" as const,
          text: `Cannot trigger hot reload: process not available`
        }]
      };
    }
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
    
    const apps = await getAppInstances();
    
    if (apps.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: 'No Flutter apps are currently running'
        }]
      };
    }
    
    const appsList = apps.map((app: any) => {
      return `App ID: ${app.id}
Project Path: ${app.projectPath}
Device ID: ${app.deviceId}
Status: ${app.status}
VM Service URL: ${app.vmServiceUrl || 'N/A'}
${app.error ? 'Error: ' + app.error : ''}`;
    }).join('\n\n');
    
    return {
      content: [{
        type: "text" as const,
        text: `Running Flutter Apps:\n\n${appsList}`
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
