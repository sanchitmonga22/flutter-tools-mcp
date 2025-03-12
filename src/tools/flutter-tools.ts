/**
 * Flutter tools implementation
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { FlutterTool } from './tool-types';
import { logger } from '../utils/logger';
import { startFlutterApp, stopFlutterApp, getAppInstances, getAppInstance } from './app-manager';

// Create and export Flutter tools
export function createFlutterTools(): FlutterTool[] {
  return [
    createStartAppTool(),
    createStopAppTool(),
    createGetLogsTool(),
    createTakeScreenshotTool(),
    createGetNetworkDataTool(),
    createGetPerformanceDataTool(),
    createHotReloadTool(),
    createListRunningAppsTool()
  ];
}

/**
 * Tool: Start a Flutter app
 */
function createStartAppTool(): FlutterTool {
  return {
    name: 'startApp',
    description: 'Start a Flutter app on a device or emulator',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the Flutter project directory'
        },
        deviceId: {
          type: 'string',
          description: 'Device ID to run the app on (optional)'
        }
      },
      required: ['projectPath']
    },
    execute: async (args) => {
      try {
        const { projectPath, deviceId } = args;
        
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
            isError: true,
            content: [{
              type: 'text',
              text: `Invalid Flutter project path: ${error instanceof Error ? error.message : String(error)}`
            }]
          };
        }
        
        // Start app
        const app = await startFlutterApp(projectPathResolved, deviceId);
        
        return {
          content: [{
            type: 'text',
            text: `Flutter app started successfully!\nApp ID: ${app.id}\nVM Service URL: ${app.vmServiceUrl || 'Not available yet'}\nStatus: ${app.status}`
          }]
        };
      } catch (error) {
        logger.error('Error starting Flutter app:', error);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Error starting Flutter app: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  };
}

/**
 * Tool: Stop a Flutter app
 */
function createStopAppTool(): FlutterTool {
  return {
    name: 'stopApp',
    description: 'Stop a running Flutter app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
          description: 'ID of the app to stop'
        }
      },
      required: ['appId']
    },
    execute: async (args) => {
      try {
        const { appId } = args;
        
        logger.info(`Stopping Flutter app with ID ${appId}`);
        
        const success = await stopFlutterApp(appId);
        
        if (success) {
          return {
            content: [{
              type: 'text',
              text: `Successfully stopped Flutter app with ID: ${appId}`
            }]
          };
        } else {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Failed to stop Flutter app with ID: ${appId}. App may not be running or was already stopped.`
            }]
          };
        }
      } catch (error) {
        logger.error('Error stopping Flutter app:', error);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Error stopping Flutter app: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  };
}

/**
 * Tool: Get logs from a Flutter app
 */
function createGetLogsTool(): FlutterTool {
  return {
    name: 'getLogs',
    description: 'Get logs from a running Flutter app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
          description: 'ID of the app to get logs from'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of log entries to return (default: 100)'
        },
        filter: {
          type: 'string',
          description: 'Filter logs containing this text (optional)'
        }
      },
      required: ['appId']
    },
    execute: async (args) => {
      try {
        const { appId, limit = 100, filter } = args;
        
        logger.info(`Getting logs for Flutter app with ID ${appId}`);
        
        const app = getAppInstance(appId);
        
        if (!app) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `App with ID ${appId} not found`
            }]
          };
        }
        
        // Get logs, filter if needed, and take the limit
        let logs = app.logs;
        
        if (filter) {
          logs = logs.filter(log => log.includes(filter));
        }
        
        logs = logs.slice(-Math.min(logs.length, limit));
        
        return {
          content: [{
            type: 'text',
            text: logs.join('\n')
          }]
        };
      } catch (error) {
        logger.error('Error getting Flutter app logs:', error);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Error getting logs: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  };
}

/**
 * Tool: Take a screenshot of a running Flutter app
 */
function createTakeScreenshotTool(): FlutterTool {
  return {
    name: 'takeScreenshot',
    description: 'Take a screenshot of a running Flutter app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
          description: 'ID of the app to screenshot'
        }
      },
      required: ['appId']
    },
    execute: async (args) => {
      try {
        const { appId } = args;
        
        logger.info(`Taking screenshot for Flutter app with ID ${appId}`);
        
        const app = getAppInstance(appId);
        
        if (!app) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `App with ID ${appId} not found`
            }]
          };
        }
        
        if (app.status !== 'running') {
          return {
            isError: true,
            content: [{
              type: 'text',
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
            isError: true,
            content: [{
              type: 'text',
              text: `Failed to take screenshot for app with ID ${appId}`
            }]
          };
        }
        
        return {
          content: [{
            type: 'image',
            data: screenshotData,
            mimeType: 'image/png'
          }]
        };
      } catch (error) {
        logger.error('Error taking screenshot:', error);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Error taking screenshot: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  };
}

/**
 * Tool: Get network traffic data from a Flutter app
 */
function createGetNetworkDataTool(): FlutterTool {
  return {
    name: 'getNetworkData',
    description: 'Get network traffic data from a running Flutter app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
          description: 'ID of the app to get network data from'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of network requests to return (default: 50)'
        }
      },
      required: ['appId']
    },
    execute: async (args) => {
      try {
        const { appId, limit = 50 } = args;
        
        logger.info(`Getting network data for Flutter app with ID ${appId}`);
        
        const app = getAppInstance(appId);
        
        if (!app) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `App with ID ${appId} not found`
            }]
          };
        }
        
        // Get the most recent network requests up to the limit
        const requests = app.networkRequests.slice(-Math.min(app.networkRequests.length, limit));
        
        // Format network requests as a table
        const requestsTable = requests.map(req => {
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
            type: 'text',
            text: requests.length > 0 
              ? `Network Requests for App ID ${appId}:\n\n${requestsTable}`
              : `No network requests recorded for App ID ${appId}`
          }]
        };
      } catch (error) {
        logger.error('Error getting network data:', error);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Error getting network data: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  };
}

/**
 * Tool: Get performance data from a Flutter app
 */
function createGetPerformanceDataTool(): FlutterTool {
  return {
    name: 'getPerformanceData',
    description: 'Get performance metrics from a running Flutter app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
          description: 'ID of the app to get performance data from'
        }
      },
      required: ['appId']
    },
    execute: async (args) => {
      try {
        const { appId } = args;
        
        logger.info(`Getting performance data for Flutter app with ID ${appId}`);
        
        const app = getAppInstance(appId);
        
        if (!app) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `App with ID ${appId} not found`
            }]
          };
        }
        
        // In a real implementation, we would gather real performance data
        // For now, return placeholder data
        const perfData = app.performanceData;
        
        return {
          content: [{
            type: 'text',
            text: `Performance Data for App ID ${appId}:
CPU Usage: ${perfData.cpuUsage || 'N/A'}%
Memory Usage: ${perfData.memoryUsage || 'N/A'} MB
Frame Rate: ${perfData.frameRate || 'N/A'} FPS
Last Updated: ${perfData.lastUpdated ? new Date(perfData.lastUpdated).toISOString() : 'N/A'}
            
Measurements:
${perfData.measurements.length > 0 
  ? perfData.measurements.map(m => `${new Date(m.timestamp).toISOString()} - ${m.metric}: ${m.value}`).join('\n')
  : 'No measurements recorded yet'}`
          }]
        };
      } catch (error) {
        logger.error('Error getting performance data:', error);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Error getting performance data: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  };
}

/**
 * Tool: Hot reload a Flutter app
 */
function createHotReloadTool(): FlutterTool {
  return {
    name: 'hotReload',
    description: 'Trigger a hot reload in a running Flutter app',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
          description: 'ID of the app to hot reload'
        }
      },
      required: ['appId']
    },
    execute: async (args) => {
      try {
        const { appId } = args;
        
        logger.info(`Triggering hot reload for Flutter app with ID ${appId}`);
        
        const app = getAppInstance(appId);
        
        if (!app) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `App with ID ${appId} not found`
            }]
          };
        }
        
        if (app.status !== 'running') {
          return {
            isError: true,
            content: [{
              type: 'text',
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
              type: 'text',
              text: `Hot reload triggered for app ID ${appId}`
            }]
          };
        } else {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Cannot trigger hot reload: process not available`
            }]
          };
        }
      } catch (error) {
        logger.error('Error triggering hot reload:', error);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Error triggering hot reload: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  };
}

/**
 * Tool: List all running Flutter apps
 */
function createListRunningAppsTool(): FlutterTool {
  return {
    name: 'listRunningApps',
    description: 'List all running Flutter apps',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    execute: async () => {
      try {
        logger.info('Listing all running Flutter apps');
        
        const apps = getAppInstances();
        
        if (apps.length === 0) {
          return {
            content: [{
              type: 'text',
              text: 'No Flutter apps are currently running'
            }]
          };
        }
        
        const appsList = apps.map(app => {
          return `App ID: ${app.id}
Project Path: ${app.projectPath}
Device ID: ${app.deviceId}
Status: ${app.status}
VM Service URL: ${app.vmServiceUrl || 'N/A'}
${app.error ? 'Error: ' + app.error : ''}`;
        }).join('\n\n');
        
        return {
          content: [{
            type: 'text',
            text: `Running Flutter Apps:\n\n${appsList}`
          }]
        };
      } catch (error) {
        logger.error('Error listing running apps:', error);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Error listing running apps: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  };
}

// Helper functions for screenshot functionality

async function takeAndroidEmulatorScreenshot(deviceId: string): Promise<string | null> {
  try {
    // Create temp file name 
    const tempFilePath = `/tmp/flutter_screenshot_${Date.now()}.png`;
    
    // Execute ADB to take screenshot
    const adbProcess = spawn('adb', ['-s', deviceId, 'exec-out', 'screencap', '-p'], { stdio: 'pipe' });
    
    // Collect output as binary data
    const chunks: Buffer[] = [];
    adbProcess.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    
    // Wait for process to finish
    const exitCode = await new Promise(resolve => {
      adbProcess.on('close', resolve);
    });
    
    if (exitCode !== 0) {
      logger.error(`Screenshot process exited with code ${exitCode}`);
      return null;
    }
    
    // Combine chunks and convert to base64
    const buffer = Buffer.concat(chunks);
    return buffer.toString('base64');
  } catch (error) {
    logger.error('Error taking Android screenshot:', error);
    return null;
  }
}

async function takeIOSSimulatorScreenshot(): Promise<string | null> {
  try {
    // Create temp file name 
    const tempFilePath = `/tmp/flutter_screenshot_${Date.now()}.png`;
    
    // Execute xcrun simctl to take screenshot
    const xcrunProcess = spawn('xcrun', ['simctl', 'io', 'booted', 'screenshot', tempFilePath], { stdio: 'pipe' });
    
    // Wait for process to finish
    const exitCode = await new Promise(resolve => {
      xcrunProcess.on('close', resolve);
    });
    
    if (exitCode !== 0) {
      logger.error(`Screenshot process exited with code ${exitCode}`);
      return null;
    }
    
    // Read the file and convert to base64
    const fileData = await fs.readFile(tempFilePath);
    const base64Data = fileData.toString('base64');
    
    // Clean up temp file
    await fs.unlink(tempFilePath);
    
    return base64Data;
  } catch (error) {
    logger.error('Error taking iOS screenshot:', error);
    return null;
  }
}

async function takeAndroidPhysicalDeviceScreenshot(deviceId: string): Promise<string | null> {
  try {
    // Create temp file paths
    const deviceTempPath = `/sdcard/flutter_screenshot_${Date.now()}.png`;
    const localTempPath = `/tmp/flutter_screenshot_${Date.now()}.png`;
    
    // Take screenshot on device
    let adbProcess = spawn('adb', ['-s', deviceId, 'shell', 'screencap', '-p', deviceTempPath], { stdio: 'pipe' });
    let exitCode = await new Promise(resolve => {
      adbProcess.on('close', resolve);
    });
    
    if (exitCode !== 0) {
      logger.error(`Screenshot process exited with code ${exitCode}`);
      return null;
    }
    
    // Pull file from device
    adbProcess = spawn('adb', ['-s', deviceId, 'pull', deviceTempPath, localTempPath], { stdio: 'pipe' });
    exitCode = await new Promise(resolve => {
      adbProcess.on('close', resolve);
    });
    
    if (exitCode !== 0) {
      logger.error(`File pull process exited with code ${exitCode}`);
      return null;
    }
    
    // Remove file from device
    adbProcess = spawn('adb', ['-s', deviceId, 'shell', 'rm', deviceTempPath], { stdio: 'pipe' });
    
    // Read the file and convert to base64
    const fileData = await fs.readFile(localTempPath);
    const base64Data = fileData.toString('base64');
    
    // Clean up temp file
    await fs.unlink(localTempPath);
    
    return base64Data;
  } catch (error) {
    logger.error('Error taking Android physical device screenshot:', error);
    return null;
  }
} 