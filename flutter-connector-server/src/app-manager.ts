/**
 * Flutter App Manager
 * 
 * This module is responsible for managing Flutter applications:
 * - Tracking running apps
 * - Starting new apps
 * - Stopping apps
 * - Managing app status and information
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import treeKill from 'tree-kill';
import { promisify } from 'util';

import { logger } from './utils/logger';

// Maximum number of logs to store per app
export const MAX_LOGS = 1000;

// App status type
type AppStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

// Network request interface
interface NetworkRequest {
  url: string;
  method: string;
  requestTime: number;
  status?: number;
  responseTime?: number;
  responseSize?: number;
  contentType?: string;
  error?: string;
}

// Performance data interface
interface PerformanceData {
  cpuUsage?: number;
  memoryUsage?: number;
  frameRate?: number;
  lastUpdated?: number;
  measurements: {
    timestamp: number;
    metric: string;
    value: number;
  }[];
}

// Flutter app interface
export interface FlutterApp {
  id: string;
  projectPath: string;
  process?: ChildProcess | null;
  pid?: number;
  deviceId: string;
  status: AppStatus;
  error?: string;
  vmServiceUrl?: string;
  startTime: number;
  endTime?: number;
  logs: string[];
  networkRequests: NetworkRequest[];
  performanceData: PerformanceData;
  systemDetected?: boolean;
}

// App update interface for partial updates
export interface AppUpdate {
  id: string;
  projectPath?: string;
  process?: ChildProcess | null;
  pid?: number;
  deviceId?: string;
  status?: AppStatus;
  error?: string;
  vmServiceUrl?: string;
  startTime?: number;
  endTime?: number;
  logs?: string[];
  networkRequests?: NetworkRequest[];
  performanceData?: PerformanceData;
  systemDetected?: boolean;
}

// Store running Flutter apps
const apps: Map<string, FlutterApp> = new Map();

/**
 * Start a Flutter app
 */
export async function startFlutterApp(
  projectPath: string,
  deviceId: string = 'default'
): Promise<FlutterApp> {
  logger.info(`Starting Flutter app at ${projectPath} on device ${deviceId}`);
  
  // Create a unique ID for this app
  const appId = uuidv4();
  
  // Resolve the project path to absolute
  const projectPathResolved = path.resolve(projectPath);
  
  try {
    // Check if the project path exists and is a Flutter project
    const stats = await fs.promises.stat(projectPathResolved);
    if (!stats.isDirectory()) {
      throw new Error('Project path is not a directory');
    }
    
    // Check for pubspec.yaml to validate it's a Flutter project
    const pubspecPath = path.join(projectPathResolved, 'pubspec.yaml');
    await fs.promises.access(pubspecPath);
    
    // Prepare Flutter run command
    const args = ['run'];
    
    // Add device ID if not default
    if (deviceId !== 'default') {
      args.push('-d', deviceId);
    }
    
    // Create the app instance
    const app: FlutterApp = {
      id: appId,
      projectPath: projectPathResolved,
      deviceId,
      status: 'starting',
      startTime: Date.now(),
      logs: [],
      networkRequests: [],
      performanceData: {
        measurements: [],
      },
    };
    
    // Register the app before starting
    apps.set(appId, app);
    
    // Start the Flutter process
    const process = spawn('flutter', args, {
      cwd: projectPathResolved,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    // Update app with process information
    app.process = process;
    app.pid = process.pid;
    
    // Set up event listeners
    
    // Handle stdout
    process.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Add to logs
        app.logs.push(line);
        
        // Limit logs to MAX_LOGS
        if (app.logs.length > MAX_LOGS) {
          app.logs.shift();
        }
        
        // Look for VM service URL
        const vmServiceMatch = line.match(/Observatory (listening on|.* available at) (http:\/\/[^\s]+)/);
        if (vmServiceMatch) {
          app.vmServiceUrl = vmServiceMatch[2];
          logger.info(`Flutter app VM service URL: ${app.vmServiceUrl}`);
        }
        
        // Check if app is running
        if (line.includes('Running "flutter run" in') || 
            line.includes('Application has started')) {
          app.status = 'running';
        }
      }
    });
    
    // Handle stderr
    process.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Add to logs with ERROR prefix
        app.logs.push(`[ERROR] ${line}`);
        
        // Limit logs to MAX_LOGS
        if (app.logs.length > MAX_LOGS) {
          app.logs.shift();
        }
      }
    });
    
    // Handle process exit
    process.on('exit', (code) => {
      logger.info(`Flutter app process exited with code: ${code}`);
      
      if (code === 0) {
        app.status = 'stopped';
      } else {
        app.status = 'error';
        app.error = `Process exited with code ${code}`;
      }
      
      app.endTime = Date.now();
      app.process = null;
    });
    
    // Handle process error
    process.on('error', (err) => {
      logger.error(`Flutter app process error: ${err.message}`);
      
      app.status = 'error';
      app.error = err.message;
      app.process = null;
    });
    
    return app;
  } catch (error) {
    // Clean up if there's an error
    apps.delete(appId);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(String(error));
    }
  }
}

/**
 * Stop a Flutter app
 */
export async function stopFlutterApp(appId: string): Promise<boolean> {
  logger.info(`Stopping Flutter app with ID ${appId}`);
  
  const app = apps.get(appId);
  if (!app) {
    logger.warn(`No app found with ID ${appId}`);
    return false;
  }
  
  if (app.status === 'stopped' || app.status === 'error') {
    logger.info(`App with ID ${appId} is already stopped or in error state`);
    return true;
  }
  
  try {
    app.status = 'stopping';
    
    if (app.process && app.process.stdin) {
      // Try to send 'q' to the process to gracefully exit
      app.process.stdin.write('q\n');
      
      // Wait a bit to see if it exits gracefully
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // If the process is still running, force kill it
      if (app.process && app.pid) {
        const treeKillAsync = promisify(treeKill);
        await treeKillAsync(app.pid);
      }
    } else if (app.pid) {
      // If we only have the PID, force kill it
      const treeKillAsync = promisify(treeKill);
      await treeKillAsync(app.pid);
    }
    
    // Update app state
    app.status = 'stopped';
    app.endTime = Date.now();
    app.process = null;
    
    return true;
  } catch (error) {
    logger.error(`Error stopping app ${appId}: ${error}`);
    
    // Even if there's an error, mark the app as stopped
    if (app) {
      app.status = 'stopped';
      app.error = error instanceof Error ? error.message : String(error);
      app.endTime = Date.now();
      app.process = null;
    }
    
    return false;
  }
}

/**
 * Get information about a specific app
 */
export async function getAppInstance(appId: string): Promise<FlutterApp | null> {
  return apps.get(appId) || null;
}

/**
 * Get information about all running apps
 */
export function getAppInstances(): FlutterApp[] {
  return Array.from(apps.values());
}

/**
 * Register or update an app
 * This is used both for apps started by this server and apps discovered externally
 */
export async function registerApp(appUpdate: AppUpdate): Promise<FlutterApp> {
  const { id } = appUpdate;
  
  let app = apps.get(id);
  
  if (!app) {
    // New app, create it with required fields
    if (!appUpdate.projectPath || !appUpdate.status) {
      throw new Error('New app registration requires projectPath and status');
    }
    
    app = {
      id,
      projectPath: appUpdate.projectPath,
      deviceId: appUpdate.deviceId || 'unknown',
      status: appUpdate.status,
      startTime: appUpdate.startTime || Date.now(),
      logs: appUpdate.logs || [],
      networkRequests: appUpdate.networkRequests || [],
      performanceData: appUpdate.performanceData || { measurements: [] },
    };
    
    apps.set(id, app);
  } else {
    // Update existing app
    Object.assign(app, {
      ...app,
      ...appUpdate,
      logs: app.logs, // Preserve existing logs
      networkRequests: app.networkRequests, // Preserve existing network requests
      performanceData: {
        ...app.performanceData,
        ...appUpdate.performanceData,
      },
    });
    
    // If logs were provided, append them (don't override)
    if (appUpdate.logs && appUpdate.logs.length > 0) {
      app.logs.push(...appUpdate.logs);
      
      // Limit logs to MAX_LOGS
      if (app.logs.length > MAX_LOGS) {
        app.logs = app.logs.slice(-MAX_LOGS);
      }
    }
    
    // If network requests were provided, append them
    if (appUpdate.networkRequests && appUpdate.networkRequests.length > 0) {
      app.networkRequests.push(...appUpdate.networkRequests);
      
      // Limit to some reasonable number
      const MAX_NETWORK_REQUESTS = 100;
      if (app.networkRequests.length > MAX_NETWORK_REQUESTS) {
        app.networkRequests = app.networkRequests.slice(-MAX_NETWORK_REQUESTS);
      }
    }
  }
  
  return app;
}

/**
 * Add a log entry to an app
 */
export async function addAppLog(appId: string, logEntry: string): Promise<boolean> {
  const app = apps.get(appId);
  if (!app) return false;
  
  app.logs.push(logEntry);
  
  // Limit logs to MAX_LOGS
  if (app.logs.length > MAX_LOGS) {
    app.logs.shift();
  }
  
  return true;
}

/**
 * Add a network request to an app
 */
export async function addNetworkRequest(
  appId: string,
  request: NetworkRequest
): Promise<boolean> {
  const app = apps.get(appId);
  if (!app) return false;
  
  app.networkRequests.push(request);
  
  // Limit to some reasonable number
  const MAX_NETWORK_REQUESTS = 100;
  if (app.networkRequests.length > MAX_NETWORK_REQUESTS) {
    app.networkRequests.shift();
  }
  
  return true;
}

/**
 * Update performance metrics for an app
 */
export async function updatePerformanceMetrics(
  appId: string,
  metrics: { [key: string]: number }
): Promise<boolean> {
  const app = apps.get(appId);
  if (!app) return false;
  
  const timestamp = Date.now();
  
  // Update summary metrics
  if (metrics.cpuUsage !== undefined) {
    app.performanceData.cpuUsage = metrics.cpuUsage;
  }
  
  if (metrics.memoryUsage !== undefined) {
    app.performanceData.memoryUsage = metrics.memoryUsage;
  }
  
  if (metrics.frameRate !== undefined) {
    app.performanceData.frameRate = metrics.frameRate;
  }
  
  app.performanceData.lastUpdated = timestamp;
  
  // Add measurements
  for (const [metric, value] of Object.entries(metrics)) {
    app.performanceData.measurements.push({
      timestamp,
      metric,
      value,
    });
  }
  
  // Limit the number of measurements
  const MAX_MEASUREMENTS = 100;
  if (app.performanceData.measurements.length > MAX_MEASUREMENTS) {
    app.performanceData.measurements = app.performanceData.measurements.slice(-MAX_MEASUREMENTS);
  }
  
  return true;
} 