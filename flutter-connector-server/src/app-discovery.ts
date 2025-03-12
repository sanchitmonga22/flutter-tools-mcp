/**
 * Flutter App Discovery
 * 
 * This module is responsible for discovering Flutter applications running on the system.
 * It uses various techniques to find Flutter apps:
 * 1. Process scanning - looking for Flutter processes
 * 2. Log file scanning - checking standard Flutter log locations
 * 3. VM service protocol - connecting to Dart Observatory instances
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import findProcess from 'find-process';
import psList from 'ps-list';

import { logger } from './utils/logger';
import { registerApp, getAppInstances } from './app-manager';

// Promisify exec
const execAsync = promisify(exec);

// How often to scan for new Flutter apps (in milliseconds)
const DISCOVERY_INTERVAL = 10000; // 10 seconds

// Timer for periodic discovery
let discoveryTimer: NodeJS.Timeout | null = null;

/**
 * Initialize Flutter app discovery
 */
export async function initAppDiscovery(): Promise<void> {
  logger.info('Initializing Flutter app discovery...');
  
  // Perform initial discovery
  await discoverApps();
  
  // Set up periodic discovery
  discoveryTimer = setInterval(discoverApps, DISCOVERY_INTERVAL);
  
  return Promise.resolve();
}

/**
 * Stop app discovery
 */
export function stopAppDiscovery(): void {
  if (discoveryTimer) {
    clearInterval(discoveryTimer);
    discoveryTimer = null;
  }
}

/**
 * Main discovery function - combines all discovery methods
 */
async function discoverApps(): Promise<void> {
  try {
    // Get apps before discovery to compare later
    const appsBefore = getAppInstances();
    const appIdsBeforeDiscovery = new Set(appsBefore.map(app => app.id));
    
    // Use different discovery methods
    await discoverAppsFromProcesses();
    await discoverAppsFromLogFiles();
    await discoverAppsFromVmService();
    
    // Get apps after discovery to see what's new
    const appsAfter = getAppInstances();
    const newApps = appsAfter.filter(app => !appIdsBeforeDiscovery.has(app.id));
    
    if (newApps.length > 0) {
      logger.info(`Discovered ${newApps.length} new Flutter applications`);
      newApps.forEach(app => {
        logger.info(`  - App ID: ${app.id}, Status: ${app.status}`);
      });
    }
  } catch (error) {
    logger.error('Error during app discovery:', error);
  }
}

/**
 * Discover Flutter apps by scanning running processes
 */
async function discoverAppsFromProcesses(): Promise<void> {
  try {
    logger.debug('Discovering Flutter apps from processes...');
    
    // Get all processes
    const processes = await psList();
    
    // Filter for Flutter processes
    const flutterProcesses = processes.filter(process => {
      const command = process.cmd || process.name || '';
      return (
        command.includes('flutter') && 
        (command.includes('run') || command.includes('build'))
      );
    });
    
    logger.debug(`Found ${flutterProcesses.length} potential Flutter processes`);
    
    // Process each potential Flutter app
    for (const proc of flutterProcesses) {
      try {
        const command = proc.cmd || proc.name || '';
        const pid = proc.pid;
        
        // Try to extract project path from command
        const projectPath = extractProjectPathFromCommand(command);
        
        if (projectPath) {
          // Create a unique ID for this app
          const appId = `system-${pid}`;
          
          // Register this app
          await registerApp({
            id: appId,
            projectPath,
            process: null, // We didn't start this process, so we don't have a reference
            pid,
            status: 'running',
            deviceId: 'unknown', // We don't know the device ID from just the process
            logs: [`[INFO] App detected from system process ${pid}`],
            startTime: Date.now(),
            systemDetected: true,
          });
          
          // Try to get more information about this app
          enrichAppInfo(appId, pid, projectPath).catch(err => {
            logger.debug(`Error enriching app info for ${appId}:`, err);
          });
        }
      } catch (err) {
        logger.debug(`Error processing Flutter process ${proc.pid}:`, err);
      }
    }
  } catch (error) {
    logger.error('Error discovering apps from processes:', error);
  }
}

/**
 * Extract project path from a Flutter command
 */
function extractProjectPathFromCommand(command: string): string | null {
  // Common patterns in Flutter run commands
  const patterns = [
    /-d\s+(\S+)/, // Device ID
    /-t\s+(\S+)/, // Target file (main.dart)
    /--(release|profile|debug)/, // Build mode
    /--target-platform=(\S+)/, // Target platform
    /--(web-port|web-hostname)=(\S+)/, // Web options
  ];
  
  // Remove common patterns to help isolate the project path
  let cleanedCommand = command;
  for (const pattern of patterns) {
    cleanedCommand = cleanedCommand.replace(pattern, '');
  }
  
  // Look for paths in the command
  const pathPattern = /(\/[^\s]+)/g;
  const paths = cleanedCommand.match(pathPattern);
  
  if (paths && paths.length > 0) {
    // Find the most likely Flutter project path (contains pubspec.yaml)
    for (const path of paths) {
      if (path.includes('flutter') && !path.includes('bin/flutter')) {
        return path;
      }
    }
    
    // If we can't identify a clear Flutter path, return the first path
    return paths[0];
  }
  
  return null;
}

/**
 * Try to get more information about a system-detected app
 */
async function enrichAppInfo(appId: string, pid: number, projectPath: string): Promise<void> {
  try {
    // Try to find VM service URL
    const vmServiceUrl = await findVmServiceUrl(pid);
    if (vmServiceUrl) {
      // Update the app with VM service URL
      await registerApp({
        id: appId,
        vmServiceUrl,
      });
    }
    
    // Try to determine the device ID
    const deviceId = await determineDeviceId(pid, projectPath);
    if (deviceId) {
      // Update the app with device ID
      await registerApp({
        id: appId,
        deviceId,
      });
    }
  } catch (error) {
    logger.debug(`Error enriching app info for ${appId}:`, error);
  }
}

/**
 * Try to find VM service URL for a running Flutter app
 */
async function findVmServiceUrl(pid: number): Promise<string | null> {
  try {
    // Different strategies could be implemented here
    // For now, we'll just check command line arguments
    
    // On Linux/macOS, we can check /proc/{pid}/cmdline
    if (os.platform() === 'linux' || os.platform() === 'darwin') {
      try {
        // On macOS, we need to use ps
        if (os.platform() === 'darwin') {
          const { stdout } = await execAsync(`ps -o command= -p ${pid}`);
          const match = stdout.match(/--observatory-port=(\d+)/);
          if (match && match[1]) {
            const port = match[1];
            return `http://127.0.0.1:${port}`;
          }
        } else {
          // On Linux, we can read from /proc
          const cmdline = await fs.readFile(`/proc/${pid}/cmdline`, 'utf8');
          const args = cmdline.split('\0');
          for (let i = 0; i < args.length; i++) {
            if (args[i] === '--observatory-port' && i + 1 < args.length) {
              const port = args[i + 1];
              return `http://127.0.0.1:${port}`;
            }
            if (args[i].startsWith('--observatory-port=')) {
              const port = args[i].split('=')[1];
              return `http://127.0.0.1:${port}`;
            }
          }
        }
      } catch (error) {
        logger.debug(`Error getting VM service URL from process ${pid}:`, error);
      }
    }
    
    // TODO: Add Windows support (use wmic?)
    
    return null;
  } catch (error) {
    logger.debug(`Error finding VM service URL for pid ${pid}:`, error);
    return null;
  }
}

/**
 * Try to determine the device ID for a running Flutter app
 */
async function determineDeviceId(pid: number, projectPath: string): Promise<string | null> {
  try {
    // This is more complex and may require looking at:
    // - Flutter logs
    // - Connected devices (via 'flutter devices')
    // - VM service information
    
    // For now, we'll just return a placeholder
    return 'unknown-device';
  } catch (error) {
    logger.debug(`Error determining device ID for pid ${pid}:`, error);
    return null;
  }
}

/**
 * Discover Flutter apps by scanning log files
 */
async function discoverAppsFromLogFiles(): Promise<void> {
  // Implementation depends on platform-specific log locations
  try {
    logger.debug('Discovering Flutter apps from log files...');
    
    // Common Flutter log locations by platform
    const logPaths: string[] = [];
    
    // Add platform-specific log paths
    switch (os.platform()) {
      case 'darwin': // macOS
        logPaths.push(path.join(os.homedir(), 'Library/Logs/Flutter'));
        logPaths.push('/tmp');
        break;
      case 'linux':
        logPaths.push('/tmp');
        logPaths.push(path.join(os.homedir(), '.dart'));
        break;
      case 'win32': // Windows
        logPaths.push(path.join(os.homedir(), 'AppData/Local/Temp'));
        break;
    }
    
    // Scan each location for Flutter logs
    for (const logPath of logPaths) {
      try {
        // Check if directory exists
        await fs.access(logPath);
        
        // Get all files in the directory
        const files = await fs.readdir(logPath);
        
        // Filter for Flutter log files
        const flutterLogFiles = files.filter(file => 
          file.startsWith('flutter_tools') && file.endsWith('.log')
        );
        
        logger.debug(`Found ${flutterLogFiles.length} Flutter log files in ${logPath}`);
        
        // Process recent log files
        for (const logFile of flutterLogFiles.slice(0, 3)) { // Just check the 3 most recent
          try {
            const fullPath = path.join(logPath, logFile);
            const stats = await fs.stat(fullPath);
            
            // Only consider recently modified logs (within last hour)
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            if (stats.mtimeMs >= oneHourAgo) {
              // Process this log file to find app info
              await processLogFile(fullPath);
            }
          } catch (err) {
            logger.debug(`Error processing log file ${logFile}:`, err);
          }
        }
      } catch (err) {
        // Directory doesn't exist or other error
        logger.debug(`Error accessing log path ${logPath}:`, err);
      }
    }
  } catch (error) {
    logger.error('Error discovering apps from log files:', error);
  }
}

/**
 * Process a Flutter log file to extract app information
 */
async function processLogFile(logFilePath: string): Promise<void> {
  try {
    // Read the last part of the file (logs can be large)
    const { stdout } = await execAsync(`tail -n 1000 "${logFilePath}"`);
    
    // Look for key information in the log
    const vmServiceMatch = stdout.match(/Observatory listening on (http:\/\/[^\s]+)/);
    const projectPathMatch = stdout.match(/Running "flutter (run|build)" in ([^\s]+)/);
    const deviceIdMatch = stdout.match(/For ([a-zA-Z0-9:._-]+) device/);
    
    if (vmServiceMatch || projectPathMatch) {
      const vmServiceUrl = vmServiceMatch ? vmServiceMatch[1] : null;
      const projectPath = projectPathMatch ? projectPathMatch[2] : null;
      const deviceId = deviceIdMatch ? deviceIdMatch[1] : 'unknown-device';
      
      if (projectPath || vmServiceUrl) {
        // Create a unique ID for this app
        const appId = `log-${path.basename(logFilePath)}`;
        
        // Register this app
        await registerApp({
          id: appId,
          projectPath: projectPath || 'unknown',
          vmServiceUrl,
          deviceId,
          status: 'running', // Assume running since the log is recent
          logs: [`[INFO] App detected from log file ${logFilePath}`],
          startTime: Date.now(),
          systemDetected: true,
        });
      }
    }
  } catch (error) {
    logger.debug(`Error processing log file ${logFilePath}:`, error);
  }
}

/**
 * Discover Flutter apps by scanning for VM service instances
 */
async function discoverAppsFromVmService(): Promise<void> {
  try {
    logger.debug('Discovering Flutter apps from VM service...');
    
    // This is more complex and would involve:
    // 1. Scanning port range for VM services
    // 2. Connecting to each service to verify it's Dart/Flutter
    // 3. Extracting app information from VM service
    
    // For now, this is a placeholder
    
  } catch (error) {
    logger.error('Error discovering apps from VM service:', error);
  }
} 