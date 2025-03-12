/**
 * Flutter app instance manager
 */

import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { FlutterAppInstance, NetworkRequest } from './tool-types';
import { logger } from '../utils/logger';

// Maximum number of logs to keep in memory per app
const MAX_LOGS = 1000;

// Maximum number of network requests to track per app
const MAX_NETWORK_REQUESTS = 100;

// In-memory store of running Flutter app instances
const appInstances: Map<string, FlutterAppInstance> = new Map();

/**
 * Start a Flutter app
 */
export async function startFlutterApp(projectPath: string, deviceId?: string): Promise<FlutterAppInstance> {
  logger.info(`Starting Flutter app in ${projectPath} on device ${deviceId || 'default'}`);
  
  const id = uuidv4();
  
  try {
    // Prepare command arguments
    const args = ['run', '--machine'];
    if (deviceId) {
      args.push('-d', deviceId);
    }
    
    // Spawn Flutter process
    const process = spawn('flutter', args, { 
      cwd: projectPath,
      shell: true
    });
    
    // Create app instance
    const appInstance: FlutterAppInstance = {
      id,
      process,
      projectPath,
      deviceId: deviceId || 'default',
      logs: [],
      status: 'starting',
      networkRequests: [],
      performanceData: {
        measurements: []
      }
    };
    
    // Store instance
    appInstances.set(id, appInstance);
    
    // Set up log capturing
    process.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      
      for (const line of lines) {
        // Add to logs buffer (maintaining max size)
        appInstance.logs.push(line);
        if (appInstance.logs.length > MAX_LOGS) {
          appInstance.logs.shift();
        }
        
        // Try to extract VM service URL
        if (!appInstance.vmServiceUrl && line.includes('Observatory listening on')) {
          const match = line.match(/Observatory listening on (https?:\/\/[^\s]+)/);
          if (match && match[1]) {
            appInstance.vmServiceUrl = match[1];
            logger.info(`VM Service URL detected: ${appInstance.vmServiceUrl}`);
            appInstance.status = 'running';
          }
        }
        
        // Detect network requests from logs (simple detection)
        if (line.includes('HTTP') && (line.includes('GET') || line.includes('POST') || line.includes('PUT'))) {
          try {
            const networkRequest = parseNetworkRequestFromLog(line);
            if (networkRequest) {
              appInstance.networkRequests.push(networkRequest);
              // Keep max network requests
              if (appInstance.networkRequests.length > MAX_NETWORK_REQUESTS) {
                appInstance.networkRequests.shift();
              }
            }
          } catch (err) {
            logger.debug(`Failed to parse network request: ${err}`);
          }
        }
      }
    });
    
    process.stderr.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      
      for (const line of lines) {
        // Add to logs
        appInstance.logs.push(`[ERROR] ${line}`);
        if (appInstance.logs.length > MAX_LOGS) {
          appInstance.logs.shift();
        }
      }
    });
    
    // Handle process termination
    process.on('close', (code: number) => {
      logger.info(`Flutter process exited with code ${code}`);
      appInstance.status = 'stopped';
      appInstance.logs.push(`[INFO] Process exited with code ${code}`);
    });
    
    process.on('error', (err: Error) => {
      logger.error(`Flutter process error: ${err.message}`);
      appInstance.status = 'error';
      appInstance.error = err.message;
      appInstance.logs.push(`[ERROR] Process error: ${err.message}`);
    });
    
    // Wait for app to start (up to 30 seconds)
    await waitForAppToStart(appInstance);
    
    return appInstance;
  } catch (error) {
    logger.error(`Failed to start Flutter app: ${error}`);
    
    // Create and store error instance
    const errorInstance: FlutterAppInstance = {
      id,
      process: null,
      projectPath,
      deviceId: deviceId || 'default',
      logs: [`[ERROR] Failed to start Flutter app: ${error}`],
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      networkRequests: [],
      performanceData: {
        measurements: []
      }
    };
    
    appInstances.set(id, errorInstance);
    throw error;
  }
}

/**
 * Stop a Flutter app
 */
export async function stopFlutterApp(id: string): Promise<boolean> {
  const appInstance = appInstances.get(id);
  
  if (!appInstance) {
    logger.warn(`App instance not found: ${id}`);
    return false;
  }
  
  try {
    // Kill the process if it exists
    if (appInstance.process && typeof appInstance.process.kill === 'function') {
      logger.info(`Stopping Flutter app ${id}`);
      appInstance.process.kill();
      appInstance.status = 'stopped';
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Error stopping Flutter app: ${error}`);
    return false;
  }
}

/**
 * Get all app instances
 */
export function getAppInstances(): FlutterAppInstance[] {
  return Array.from(appInstances.values());
}

/**
 * Get app instance by ID
 */
export function getAppInstance(id: string): FlutterAppInstance | undefined {
  return appInstances.get(id);
}

/**
 * Wait for app to start
 */
async function waitForAppToStart(appInstance: FlutterAppInstance, timeoutMs: number = 30000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    
    const checkStatus = () => {
      if (appInstance.status === 'running') {
        resolve();
        return;
      }
      
      if (appInstance.status === 'error') {
        reject(new Error(appInstance.error || 'Unknown error starting app'));
        return;
      }
      
      if (Date.now() - start > timeoutMs) {
        appInstance.status = 'error';
        appInstance.error = 'Timeout waiting for app to start';
        reject(new Error('Timeout waiting for app to start'));
        return;
      }
      
      // Check again after a short delay
      setTimeout(checkStatus, 500);
    };
    
    checkStatus();
  });
}

/**
 * Parse network request from log line
 */
function parseNetworkRequestFromLog(log: string): NetworkRequest | null {
  // Very simple parser - would need to be enhanced for real implementation
  let method = '';
  if (log.includes('GET')) method = 'GET';
  else if (log.includes('POST')) method = 'POST';
  else if (log.includes('PUT')) method = 'PUT';
  else if (log.includes('DELETE')) method = 'DELETE';
  else return null;
  
  // Simple URL extraction - would need to be enhanced
  const urlMatch = log.match(/(https?:\/\/[^\s]+)/);
  if (!urlMatch) return null;
  
  return {
    id: uuidv4(),
    url: urlMatch[1],
    method,
    requestTime: Date.now(),
    // Other fields will be populated when/if response is detected
  };
} 