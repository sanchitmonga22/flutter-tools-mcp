/**
 * Flutter tools implementation
 */

import { promises as fs } from 'fs';
import { resolve } from 'path';
import { z } from "zod";
import { logger } from '../utils/logger.js';
import { startFlutterApp, stopFlutterApp, getAppInstances, getAppInstance } from './app-manager.js';
import { takeAndroidEmulatorScreenshot, takeIOSSimulatorScreenshot, takeAndroidPhysicalDeviceScreenshot } from './screenshot-util.js';

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
    
    // For system-detected apps, try to refresh logs first
    if (app.id.startsWith('system-') && app.vmServiceUrl) {
      try {
        logger.info(`Attempting to refresh logs for system app ${appId} via VM service`);
        
        // Use the VM service to get the latest logs
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        const { stdout: logData } = await execAsync(`curl -s "${app.vmServiceUrl}/getLogHistory"`);
        
        try {
          const logResponse = JSON.parse(logData);
          if (logResponse.result && logResponse.result.logs && logResponse.result.logs.length > 0) {
            // Get the most recent logs
            const recentLogs = logResponse.result.logs.slice(-Math.min(logResponse.result.logs.length, 100));
            
            // Add these logs to our app instance
            for (const log of recentLogs) {
              const logMessage = `[${log.level}] ${log.message}`;
              
              // Only add if not already present
              if (!app.logs.includes(logMessage)) {
                app.logs.push(logMessage);
                
                // Keep logs under the maximum size
                if (app.logs.length > MAX_LOGS) {
                  app.logs.shift();
                }
              }
            }
            
            logger.info(`Added ${recentLogs.length} new logs from VM service for app ${appId}`);
          }
        } catch (parseError) {
          logger.debug(`Error parsing VM service log response: ${parseError}`);
        }
      } catch (error) {
        logger.debug(`Error refreshing logs via VM service: ${error}`);
      }
      
      // Also try to get logs from the Flutter log file
      try {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        // Find the most recent Flutter log file
        const { stdout: logFiles } = await execAsync(`find /tmp -name "flutter_tools.*.log" -mtime -1 | sort -r`);
        
        if (logFiles.trim()) {
          const recentLogFile = logFiles.split('\n')[0];
          logger.info(`Found recent Flutter log file: ${recentLogFile}`);
          
          // Get the last 100 lines from the log file
          const { stdout: recentLogs } = await execAsync(`tail -n 100 "${recentLogFile}"`);
          
          // Add these logs to our app instance
          const logLines: string[] = recentLogs.split('\n').filter((line: string) => line.trim());
          
          for (const line of logLines) {
            // Only add if not already present
            if (!app.logs.includes(line.trim())) {
              app.logs.push(line.trim());
              
              // Keep logs under the maximum size
              if (app.logs.length > MAX_LOGS) {
                app.logs.shift();
              }
            }
          }
          
          logger.info(`Added ${logLines.length} log lines from Flutter log file`);
        }
      } catch (logError) {
        logger.debug(`Error getting logs from file: ${logError}`);
      }
    }
    
    // Get logs, filter if needed, and take the limit
    let logs = app.logs;
    
    if (filter) {
      logs = logs.filter((log: string) => log.includes(filter));
    }
    
    logs = logs.slice(-Math.min(logs.length, limit));
    
    // Check if we have meaningful logs
    if (logs.length <= 1 && app.id.startsWith('system-')) {
      // If we only have the initial system detection log, provide more helpful information
      return {
        content: [{
          type: "text" as const,
          text: `Limited logs available for app with ID ${appId}. This is likely because the app was started outside of this tool.\n\n` +
                `Available logs:\n${logs.join('\n')}\n\n` +
                `To see more detailed logs, you can:\n` +
                `1. Check the Flutter console in your IDE\n` +
                `2. Look at the log files in /tmp/flutter_tools.*.log\n` +
                `3. Restart the app using this tool to capture all logs`
        }]
      };
    }
    
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
    } else if (
      deviceId.includes('simulator-') || 
      deviceId === 'default' ||
      // Match iOS simulator UUID pattern
      /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(deviceId)
    ) {
      // iOS simulator
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
    
    // Only return text content since image type is not supported
    return {
      content: [{
        type: "text" as const,
        text: `📸 Screenshot captured successfully!\n\n` +
              `✅ Saved to your Downloads folder with filename pattern: flutter_screenshot_YYYY-MM-DDTHH-mm-ss.png\n\n` +
              `✅ The screenshot has also been copied to your clipboard. You can paste it directly into this chat by clicking in the input field and pressing Cmd+V (Mac) or Ctrl+V (Windows/Linux).`
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
    
    let reloadSuccess = false;
    let errorMessage = '';
    
    // Try multiple methods to trigger hot reload
    
    // Method 1: Use process stdin if available
    if (app.process && app.process.stdin) {
      try {
        logger.info(`Triggering hot reload via process stdin for app ID ${appId}`);
        app.process.stdin.write('r\n');
        
        // Add to logs
        app.logs.push('[INFO] Hot reload triggered via stdin');
        
        // Wait a bit to see if it worked
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if there's any error in the logs
        const recentLogs = app.logs.slice(-10);
        const hasError = recentLogs.some(log => 
          log.includes('Error') || log.includes('error') || log.includes('failed')
        );
        
        if (!hasError) {
          reloadSuccess = true;
        } else {
          errorMessage = 'Stdin method failed. Check logs for details.';
        }
      } catch (error) {
        logger.error(`Error triggering hot reload via stdin: ${error}`);
        errorMessage = error instanceof Error ? error.message : String(error);
      }
    } 
    
    // Method 2: Use VM service URL if available and stdin failed
    if (!reloadSuccess && app.vmServiceUrl) {
      try {
        logger.info(`Triggering hot reload via VM service for app ID ${appId}`);
        
        // First, get the list of isolates
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        const getVMInfoCmd = `curl -s "${app.vmServiceUrl}/vm"`;
        const { stdout: vmInfo } = await execAsync(getVMInfoCmd);
        
        const vmData = JSON.parse(vmInfo);
        if (!vmData.isolates || vmData.isolates.length === 0) {
          throw new Error('No isolates found in VM');
        }
        
        // Get the first isolate ID
        const isolateId = vmData.isolates[0].id;
        logger.info(`Found isolate ID: ${isolateId}`);
        
        // Now trigger hot reload using the Flutter service protocol
        const hotReloadCmd = `curl -s -X POST "${app.vmServiceUrl}/_flutter/reload?isolateId=${isolateId}&pause=false&reason=manual"`;
        logger.info(`Executing hot reload command: ${hotReloadCmd}`);
        
        const { stdout: reloadResult } = await execAsync(hotReloadCmd);
        
        // Check if reload was successful
        const reloadData = JSON.parse(reloadResult);
        if (reloadData.success === true) {
          // Add to logs
          app.logs.push('[INFO] Hot reload triggered via VM service');
          reloadSuccess = true;
        } else {
          throw new Error(reloadData.message || 'Unknown error from VM service');
        }
      } catch (error) {
        logger.error(`Error triggering hot reload via VM service: ${error}`);
        errorMessage = `${errorMessage}\nVM service error: ${error instanceof Error ? error.message : String(error)}`;
        
        // Try legacy approach as last resort
        try {
          logger.info('Trying legacy hot reload approach...');
          const { exec } = require('child_process');
          const util = require('util');
          const execAsync = util.promisify(exec);
          
          const legacyReloadCmd = `curl -s -X POST "${app.vmServiceUrl}/hot-reload"`;
          await execAsync(legacyReloadCmd);
          
          // Add to logs
          app.logs.push('[INFO] Hot reload triggered via legacy VM service');
          reloadSuccess = true;
        } catch (legacyError) {
          logger.error(`Legacy hot reload failed: ${legacyError}`);
        }
      }
    }
    
    if (reloadSuccess) {
      return {
        content: [{
          type: "text" as const,
          text: `Hot reload triggered for app ID ${appId}. Your changes should be visible in the app now.`
        }]
      };
    } else {
      // If all methods failed
      return {
        content: [{
          type: "text" as const,
          text: `Cannot trigger hot reload: process not available or VM service not accessible.\n${errorMessage}\n\nTry manually pressing 'r' in the Flutter console or restarting the app.`
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
