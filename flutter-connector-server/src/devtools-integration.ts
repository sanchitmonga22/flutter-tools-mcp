/**
 * Flutter DevTools Integration
 * 
 * This module provides integration with Flutter DevTools for advanced debugging capabilities:
 * - Launching DevTools for a specific app
 * - Extracting debugging information from DevTools
 * - Controlling DevTools features remotely
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { logger } from './utils/logger.js';
import { FlutterApp } from './app-manager.js';

// Promisify exec
const execAsync = promisify(exec);

// Track active DevTools instances
const activeDevToolsInstances: Map<string, DevToolsInstance> = new Map();

// DevTools instance information
interface DevToolsInstance {
  appId: string;
  url: string;
  port: number;
  process: any; // ChildProcess
  startTime: number;
}

/**
 * Launch DevTools for a specific Flutter app
 */
export async function launchDevTools(app: FlutterApp): Promise<DevToolsInstance | null> {
  try {
    logger.info(`Launching DevTools for app ${app.id}`);
    
    // Check if DevTools is already running for this app
    if (activeDevToolsInstances.has(app.id)) {
      logger.info(`DevTools already running for app ${app.id}`);
      return activeDevToolsInstances.get(app.id) || null;
    }
    
    // Check if we have VM service URL
    if (!app.vmServiceUrl) {
      logger.error(`Cannot launch DevTools: No VM service URL for app ${app.id}`);
      return null;
    }
    
    // Find a free port for DevTools
    const port = await findAvailablePort(9100, 9200);
    
    // Launch DevTools using dart pub
    const devToolsProcess = exec(
      `dart pub global run devtools --headless --machine --port ${port} --vm-uri ${app.vmServiceUrl}`,
      { maxBuffer: 1024 * 1024 } // 1 MB buffer
    );
    
    // Wait for DevTools to start (look for the URL in stdout)
    let devToolsUrl = '';
    
    const devToolsStartPromise = new Promise<string>((resolve, reject) => {
      let output = '';
      
      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for DevTools to start'));
      }, 30000);
      
      devToolsProcess.stdout?.on('data', (data) => {
        output += data.toString();
        
        // Look for DevTools server URL
        const match = output.match(/Serving DevTools at (http:\/\/[^\s]+)/);
        if (match && match[1]) {
          devToolsUrl = match[1];
          clearTimeout(timeout);
          resolve(devToolsUrl);
        }
      });
      
      devToolsProcess.stderr?.on('data', (data) => {
        logger.error(`DevTools stderr: ${data}`);
      });
      
      devToolsProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      
      devToolsProcess.on('exit', (code) => {
        if (!devToolsUrl) {
          clearTimeout(timeout);
          reject(new Error(`DevTools process exited with code ${code}`));
        }
      });
    });
    
    // Wait for DevTools to start
    devToolsUrl = await devToolsStartPromise;
    
    // Store the DevTools instance
    const instance: DevToolsInstance = {
      appId: app.id,
      url: devToolsUrl,
      port,
      process: devToolsProcess,
      startTime: Date.now(),
    };
    
    activeDevToolsInstances.set(app.id, instance);
    
    logger.info(`DevTools launched successfully for app ${app.id} at ${devToolsUrl}`);
    
    return instance;
  } catch (error) {
    logger.error(`Error launching DevTools: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Stop DevTools for a specific Flutter app
 */
export async function stopDevTools(appId: string): Promise<boolean> {
  const instance = activeDevToolsInstances.get(appId);
  
  if (!instance) {
    logger.warn(`No DevTools instance found for app ${appId}`);
    return false;
  }
  
  try {
    // Kill the DevTools process
    if (instance.process) {
      instance.process.kill();
    }
    
    // Remove from active instances
    activeDevToolsInstances.delete(appId);
    
    logger.info(`DevTools stopped for app ${appId}`);
    return true;
  } catch (error) {
    logger.error(`Error stopping DevTools for app ${appId}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Get DevTools URL for a specific Flutter app
 */
export function getDevToolsUrl(appId: string): string | null {
  const instance = activeDevToolsInstances.get(appId);
  return instance ? instance.url : null;
}

/**
 * Get memory profiling data from DevTools
 */
export async function getMemoryProfile(appId: string): Promise<any | null> {
  const devToolsUrl = getDevToolsUrl(appId);
  
  if (!devToolsUrl) {
    logger.error(`No DevTools instance found for app ${appId}`);
    return null;
  }
  
  try {
    // DevTools memory profile API endpoint
    const memoryApiUrl = `${devToolsUrl}/api/memoryProfile`;
    
    // Request memory profile data
    const response = await axios.get(memoryApiUrl);
    
    return response.data;
  } catch (error) {
    logger.error(`Error getting memory profile: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get CPU profiling data from DevTools
 */
export async function getCpuProfile(appId: string, durationMs: number = 5000): Promise<any | null> {
  const devToolsUrl = getDevToolsUrl(appId);
  
  if (!devToolsUrl) {
    logger.error(`No DevTools instance found for app ${appId}`);
    return null;
  }
  
  try {
    // DevTools CPU profile API endpoint
    const cpuApiUrl = `${devToolsUrl}/api/cpuProfile?duration=${durationMs}`;
    
    // Request CPU profile data
    const response = await axios.get(cpuApiUrl);
    
    return response.data;
  } catch (error) {
    logger.error(`Error getting CPU profile: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get widget hierarchy from DevTools
 */
export async function getWidgetHierarchy(appId: string): Promise<any | null> {
  const devToolsUrl = getDevToolsUrl(appId);
  
  if (!devToolsUrl) {
    logger.error(`No DevTools instance found for app ${appId}`);
    return null;
  }
  
  try {
    // DevTools widget hierarchy API endpoint
    const widgetApiUrl = `${devToolsUrl}/api/widget-hierarchy`;
    
    // Request widget hierarchy data
    const response = await axios.get(widgetApiUrl);
    
    return response.data;
  } catch (error) {
    logger.error(`Error getting widget hierarchy: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get network traffic data from DevTools
 */
export async function getNetworkTraffic(appId: string): Promise<any | null> {
  const devToolsUrl = getDevToolsUrl(appId);
  
  if (!devToolsUrl) {
    logger.error(`No DevTools instance found for app ${appId}`);
    return null;
  }
  
  try {
    // DevTools network traffic API endpoint
    const networkApiUrl = `${devToolsUrl}/api/network`;
    
    // Request network traffic data
    const response = await axios.get(networkApiUrl);
    
    return response.data;
  } catch (error) {
    logger.error(`Error getting network traffic: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get performance metrics from DevTools
 */
export async function getPerformanceMetrics(appId: string): Promise<any | null> {
  const devToolsUrl = getDevToolsUrl(appId);
  
  if (!devToolsUrl) {
    logger.error(`No DevTools instance found for app ${appId}`);
    return null;
  }
  
  try {
    // DevTools performance metrics API endpoint
    const performanceApiUrl = `${devToolsUrl}/api/performance`;
    
    // Request performance metrics data
    const response = await axios.get(performanceApiUrl);
    
    return response.data;
  } catch (error) {
    logger.error(`Error getting performance metrics: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Find an available port in a range
 */
async function findAvailablePort(startPort: number, endPort: number): Promise<number> {
  const net = require('net');
  
  for (let port = startPort; port <= endPort; port++) {
    try {
      // Check if port is in use
      await new Promise<void>((resolve, reject) => {
        const server = net.createServer();
        
        server.once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            // Port is in use
            server.close();
            resolve();
          } else {
            reject(err);
          }
        });
        
        server.once('listening', () => {
          // Port is available
          server.close();
          reject(new Error('Port available'));
        });
        
        server.listen(port);
      });
    } catch (error) {
      // If we get here, the port is available
      return port;
    }
  }
  
  throw new Error(`No available ports in range ${startPort}-${endPort}`);
} 