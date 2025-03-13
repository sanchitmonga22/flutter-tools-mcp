/**
 * Flutter DevTools Integration
 * 
 * This module provides integration with Flutter DevTools for advanced debugging capabilities:
 * - Launch DevTools for specific apps
 * - Extract debugging information from DevTools
 * - Control DevTools features remotely
 * - Support for complex debugging scenarios
 */

import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import * as net from 'net';
import { logger } from './utils/logger.js';

// Promisify necessary functions
const sleep = promisify(setTimeout);

// Interface for DevTools instance tracking
interface DevToolsInstance {
  appId: string;
  url: string;
  port: number;
  process: ChildProcess;
  startTime: number;
}

// Track active DevTools instances
const activeDevToolsInstances: Map<string, DevToolsInstance> = new Map();

// Port range for DevTools instances
const PORT_RANGE_START = 9100;
const PORT_RANGE_END = 9200;

/**
 * Launch DevTools for a specific Flutter app
 * @param appId The ID of the Flutter app
 * @returns The URL of the DevTools instance
 */
export async function launchDevTools(appId: string): Promise<string> {
  logger.info(`Launching DevTools for app: ${appId}`);
  
  // Check if DevTools is already running for this app
  const existingInstance = activeDevToolsInstances.get(appId);
  if (existingInstance) {
    logger.info(`DevTools already running for app ${appId} at ${existingInstance.url}`);
    return existingInstance.url;
  }
  
  // Get the app to ensure it exists and has a VM service URL
  const app = getApp(appId);
  if (!app) {
    throw new Error(`App ${appId} not found`);
  }
  
  if (!app.vmServiceUrl) {
    throw new Error(`App ${appId} does not have a VM service URL`);
  }
  
  try {
    // Find an available port
    const port = await findAvailablePort(PORT_RANGE_START, PORT_RANGE_END);
    
    // Launch the DevTools process
    const devToolsProc = spawn('dart', [
      'devtools',
      '--machine',
      '--port', port.toString(),
      '--vm-uri', app.vmServiceUrl
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Wait for DevTools to start and capture URL
    let devToolsUrl = '';
    
    // Set up listener for stdout
    devToolsProc.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      logger.debug(`DevTools stdout: ${output}`);
      
      // DevTools outputs JSON when started with --machine
      try {
        const jsonMatch = output.match(/\{.*\}/s);
        if (jsonMatch) {
          const json = JSON.parse(jsonMatch[0]);
          if (json.event === 'server.started' && json.params && json.params.uri) {
            devToolsUrl = json.params.uri;
            logger.info(`DevTools started at ${devToolsUrl}`);
          }
        }
      } catch (e) {
        // Not valid JSON, ignore
      }
    });
    
    // Handle errors
    devToolsProc.stderr.on('data', (data: Buffer) => {
      logger.error(`DevTools stderr: ${data.toString()}`);
    });
    
    // Handle process exit
    devToolsProc.on('exit', (code: number | null) => {
      logger.info(`DevTools process exited with code ${code}`);
      // Remove from active instances
      activeDevToolsInstances.delete(appId);
    });
    
    // Wait for DevTools to start (timeout after 30 seconds)
    let attempts = 0;
    const maxAttempts = 30;
    while (!devToolsUrl && attempts < maxAttempts && devToolsProc.exitCode === null) {
      await sleep(1000);
      attempts++;
    }
    
    if (!devToolsUrl) {
      // If process is still running but we didn't get a URL, kill it
      if (devToolsProc.exitCode === null) {
        devToolsProc.kill();
      }
      throw new Error(`Failed to start DevTools for app ${appId} after ${maxAttempts} seconds`);
    }
    
    // Store the instance information
    const instance: DevToolsInstance = {
      appId,
      url: devToolsUrl,
      port,
      process: devToolsProc,
      startTime: Date.now()
    };
    
    activeDevToolsInstances.set(appId, instance);
    
    return devToolsUrl;
  } catch (error) {
    logger.error(`Error launching DevTools for app ${appId}:`, error);
    throw new Error(`Failed to launch DevTools: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Stop the DevTools instance for a specific app
 * @param appId The ID of the Flutter app
 * @returns True if DevTools was stopped, false if it wasn't running
 */
export function stopDevTools(appId: string): boolean {
  const instance = activeDevToolsInstances.get(appId);
  if (!instance) {
    return false;
  }
  
  logger.info(`Stopping DevTools for app ${appId}`);
  
  try {
    // Kill the process
    instance.process.kill();
    
    // Remove from active instances
    activeDevToolsInstances.delete(appId);
    
    return true;
  } catch (error) {
    logger.error(`Error stopping DevTools for app ${appId}:`, error);
    return false;
  }
}

/**
 * Get the DevTools URL for a specific app
 * @param appId The ID of the Flutter app
 * @returns The URL of the DevTools instance or null if not running
 */
export function getDevToolsUrl(appId: string): string | null {
  const instance = activeDevToolsInstances.get(appId);
  return instance ? instance.url : null;
}

/**
 * Get memory profile from DevTools
 * @param appId The ID of the Flutter app
 * @returns Memory profile data
 */
export async function getMemoryProfile(appId: string): Promise<any> {
  const devToolsUrl = await ensureDevToolsRunning(appId);
  
  try {
    // Extract base URL and append memory endpoint
    const baseUrl = new URL(devToolsUrl);
    const apiUrl = `${baseUrl.protocol}//${baseUrl.host}/api/getMemoryStats`;
    
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    logger.error(`Error getting memory profile for app ${appId}:`, error);
    throw new Error(`Failed to get memory profile: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get CPU profile from DevTools
 * @param appId The ID of the Flutter app
 * @param duration Duration in seconds to profile
 * @returns CPU profile data
 */
export async function getCpuProfile(appId: string, duration: number = 5): Promise<any> {
  const devToolsUrl = await ensureDevToolsRunning(appId);
  
  try {
    // Extract base URL and append CPU profile endpoint
    const baseUrl = new URL(devToolsUrl);
    
    // Start profiling
    const startUrl = `${baseUrl.protocol}//${baseUrl.host}/api/startCpuProfiler`;
    await axios.post(startUrl);
    
    // Wait for the specified duration
    await sleep(duration * 1000);
    
    // Stop profiling and get results
    const stopUrl = `${baseUrl.protocol}//${baseUrl.host}/api/stopCpuProfiler`;
    const response = await axios.post(stopUrl);
    
    return response.data;
  } catch (error) {
    logger.error(`Error getting CPU profile for app ${appId}:`, error);
    throw new Error(`Failed to get CPU profile: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the widget hierarchy from DevTools
 * @param appId The ID of the Flutter app
 * @returns Widget hierarchy data
 */
export async function getWidgetHierarchy(appId: string): Promise<any> {
  const devToolsUrl = await ensureDevToolsRunning(appId);
  
  try {
    // Extract base URL and append widget hierarchy endpoint
    const baseUrl = new URL(devToolsUrl);
    const apiUrl = `${baseUrl.protocol}//${baseUrl.host}/api/getWidgetTree`;
    
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    logger.error(`Error getting widget hierarchy for app ${appId}:`, error);
    throw new Error(`Failed to get widget hierarchy: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get network traffic from DevTools
 * @param appId The ID of the Flutter app
 * @returns Network traffic data
 */
export async function getNetworkTraffic(appId: string): Promise<any> {
  const devToolsUrl = await ensureDevToolsRunning(appId);
  
  try {
    // Extract base URL and append network traffic endpoint
    const baseUrl = new URL(devToolsUrl);
    const apiUrl = `${baseUrl.protocol}//${baseUrl.host}/api/getNetworkTraffic`;
    
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    logger.error(`Error getting network traffic for app ${appId}:`, error);
    throw new Error(`Failed to get network traffic: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get performance metrics from DevTools
 * @param appId The ID of the Flutter app
 * @returns Performance metrics data
 */
export async function getPerformanceMetrics(appId: string): Promise<any> {
  const devToolsUrl = await ensureDevToolsRunning(appId);
  
  try {
    // Extract base URL and append performance metrics endpoint
    const baseUrl = new URL(devToolsUrl);
    const apiUrl = `${baseUrl.protocol}//${baseUrl.host}/api/getPerformanceMetrics`;
    
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    logger.error(`Error getting performance metrics for app ${appId}:`, error);
    throw new Error(`Failed to get performance metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Ensure DevTools is running for a specific app
 * @param appId The ID of the Flutter app
 * @returns The URL of the DevTools instance
 */
async function ensureDevToolsRunning(appId: string): Promise<string> {
  // Check if DevTools is already running
  const existingUrl = getDevToolsUrl(appId);
  if (existingUrl) {
    return existingUrl;
  }
  
  // Launch DevTools if not running
  return await launchDevTools(appId);
}

/**
 * Find an available port within a specified range
 * @param start Start of port range
 * @param end End of port range
 * @returns An available port number
 */
async function findAvailablePort(start: number, end: number): Promise<number> {
  for (let port = start; port <= end; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  
  throw new Error(`No available ports in range ${start}-${end}`);
}

/**
 * Check if a port is available
 * @param port Port number to check
 * @returns True if the port is available, false otherwise
 */
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
} 