/**
 * Flutter app instance manager
 */

import { spawn, exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { FlutterAppInstance, NetworkRequest } from './tool-types.js';
import { logger } from '../utils/logger.js';
import { promisify } from 'util';

// Maximum number of logs to keep in memory per app
const MAX_LOGS = 1000;

// Maximum number of network requests to track per app
const MAX_NETWORK_REQUESTS = 100;

// Promisify exec for async/await usage
const execAsync = promisify(exec);

// In-memory store of running Flutter app instances - only used for apps started by this server
// This helps us maintain state for apps we started (logs, etc.)
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
    logger.warn(`App instance not found in managed instances: ${id}`);
    
    // Try to find the app in system processes and kill it
    try {
      const systemApps = await detectSystemFlutterApps();
      const systemApp = systemApps.find(app => app.id === id);
      
      if (systemApp && systemApp.process) {
        logger.info(`Found system Flutter app with ID ${id}, attempting to stop it`);
        systemApp.process.kill();
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error stopping system Flutter app: ${error}`);
      return false;
    }
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
 * Get all app instances - combines managed instances with detected system instances
 */
export async function getAppInstances(): Promise<FlutterAppInstance[]> {
  try {
    // Get managed instances
    const managedApps = Array.from(appInstances.values());
    
    // Get system instances
    const systemApps = await detectSystemFlutterApps();
    
    // Combine both lists, avoiding duplicates by PID
    const managedPids = new Set(
      managedApps
        .filter(app => app.process && app.process.pid)
        .map(app => app.process!.pid)
    );
    
    // Filter out system apps that are already in managed apps
    const uniqueSystemApps = systemApps.filter(app => 
      app.process && app.process.pid && !managedPids.has(app.process.pid)
    );
    
    return [...managedApps, ...uniqueSystemApps];
  } catch (error) {
    logger.error(`Error getting app instances: ${error}`);
    return Array.from(appInstances.values());
  }
}

/**
 * Get app instance by ID
 */
export async function getAppInstance(id: string): Promise<FlutterAppInstance | undefined> {
  // First check managed instances
  const managedApp = appInstances.get(id);
  if (managedApp) {
    return managedApp;
  }
  
  // If not found, check system instances
  try {
    const systemApps = await detectSystemFlutterApps();
    return systemApps.find(app => app.id === id);
  } catch (error) {
    logger.error(`Error finding system app instance: ${error}`);
    return undefined;
  }
}

/**
 * Detect Flutter apps running on the system
 */
async function detectSystemFlutterApps(): Promise<FlutterAppInstance[]> {
  try {
    logger.info('Detecting system-wide Flutter processes');
    
    // Command to find Flutter processes - more inclusive search
    const cmd = process.platform === 'win32'
      ? 'tasklist /FI "IMAGENAME eq flutter.exe" /FO CSV'
      : 'ps aux | grep -E "flutter|dart" | grep -v grep';
    
    const { stdout } = await execAsync(cmd);
    logger.debug(`Process detection output: ${stdout}`);
    
    if (!stdout.trim()) {
      logger.info('No system Flutter processes detected');
      return [];
    }
    
    // Parse the output to extract process information
    const lines = stdout.split('\n').filter(line => {
      const isRelevant = line.trim() && (
        line.includes('flutter') || 
        (line.includes('dart') && line.includes('flutter_tools'))
      );
      if (isRelevant) {
        logger.debug(`Found relevant process line: ${line}`);
      }
      return isRelevant;
    });
    
    // Create app instances for each detected process
    const systemApps: FlutterAppInstance[] = [];
    
    for (const line of lines) {
      try {
        // Extract PID
        const match = process.platform === 'win32'
          ? line.match(/"flutter\.exe","(\d+)"/)
          : line.match(/\s+(\d+)\s+/);
        
        if (!match) {
          logger.debug(`Could not extract PID from line: ${line}`);
          continue;
        }
        
        const pid = parseInt(match[1], 10);
        if (isNaN(pid)) {
          logger.debug(`Invalid PID extracted: ${match[1]}`);
          continue;
        }
        
        logger.debug(`Processing PID: ${pid}`);
        
        // Get detailed command info
        const { stdout: cmdDetails } = await execAsync(`ps -p ${pid} -o command=`);
        logger.debug(`Command details for PID ${pid}: ${cmdDetails}`);
        
        // Check for Flutter run commands or debug adapter
        if (!cmdDetails.includes('flutter_tools.snapshot run') && 
            !cmdDetails.includes('flutter run') &&
            !cmdDetails.includes('debug_adapter')) {
          logger.debug(`Skipping PID ${pid} - not a Flutter run command`);
          continue;
        }
        
        // Extract device ID and project path
        const deviceIdMatch = cmdDetails.match(/-d\s+([^\s]+)/);
        const targetMatch = cmdDetails.match(/--target\s+([^\s]+)/);
        
        const deviceId = deviceIdMatch ? deviceIdMatch[1] : 'unknown';
        let projectPath = 'unknown';
        
        if (targetMatch) {
          // Extract project root from main.dart path
          const mainDartPath = targetMatch[1];
          projectPath = mainDartPath.replace(/\/lib\/main.dart$/, '');
          logger.debug(`Extracted project path: ${projectPath}`);
        }
        
        // Create a synthetic process object with stdin for hot reload
        const syntheticProcess: any = {
          pid,
          kill: () => {
            try {
              return execAsync(`kill ${pid}`);
            } catch (e) {
              logger.error(`Failed to kill process ${pid}: ${e}`);
              throw e;
            }
          },
          // Add a synthetic stdin object that will use VM service for hot reload
          stdin: {
            write: async (data: string) => {
              if (data.includes('r')) {
                logger.info(`Triggering hot reload for system process ${pid} via VM service`);
                return triggerHotReloadViaVMService(pid);
              }
              return false;
            }
          }
        };
        
        // Initialize logs array with basic info
        const initialLogs = [`[INFO] System-detected Flutter process (PID: ${pid})`];
        
        // Try to get recent logs from the Flutter process
        try {
          // Check if there are Flutter log files for this process
          const { stdout: logFiles } = await execAsync(`find /tmp -name "flutter_tools.*.log" -mtime -1 | sort -r`);
          
          if (logFiles.trim()) {
            const recentLogFile = logFiles.split('\n')[0];
            logger.info(`Found recent Flutter log file: ${recentLogFile}`);
            
            // Get the last 100 lines from the log file
            const { stdout: recentLogs } = await execAsync(`tail -n 100 "${recentLogFile}"`);
            
            // Add these logs to our initial logs
            const logLines = recentLogs.split('\n').filter(line => line.trim());
            initialLogs.push(...logLines.map(line => line.trim()));
            
            logger.info(`Added ${logLines.length} log lines from Flutter log file`);
          }
          
          // Also try to get logs directly from the process output
          const { stdout: processLogs } = await execAsync(`ps -p ${pid} -o command= | xargs -I{} lsof -p ${pid} | grep -E 'stdout|stderr'`);
          
          if (processLogs.trim()) {
            logger.info(`Found process stdout/stderr file descriptors for PID ${pid}`);
            // We could potentially set up a file watcher here for real-time logs
          }
        } catch (logError) {
          logger.debug(`Error getting logs for PID ${pid}: ${logError}`);
        }
        
        // Create app instance
        const appInstance: FlutterAppInstance = {
          id: `system-${pid}`,
          process: syntheticProcess,
          projectPath,
          deviceId,
          logs: initialLogs,
          status: 'running',
          networkRequests: [],
          performanceData: {
            measurements: []
          }
        };
        
        // Try multiple methods to get VM service URL
        try {
          // Method 1: Check process file descriptors
          const { stdout: vmServiceInfo } = await execAsync(`lsof -p ${pid} | grep -E 'dart_vm|Observatory'`);
          logger.debug(`VM service info from lsof for PID ${pid}: ${vmServiceInfo}`);
          
          let vmServiceMatch = vmServiceInfo.match(/(https?:\/\/[^\s]+)/);
          
          if (!vmServiceMatch) {
            // Method 2: Check process environment
            const { stdout: envInfo } = await execAsync(`ps eww ${pid}`);
            logger.debug(`Process environment for PID ${pid}: ${envInfo}`);
            
            vmServiceMatch = envInfo.match(/OBSERVATORY_URI=(https?:\/\/[^\s]+)/);
          }
          
          if (!vmServiceMatch) {
            // Method 3: Check Flutter logs in /tmp
            const { stdout: tmpFiles } = await execAsync('ls -t /tmp/flutter_tools.*.log');
            const latestLog = tmpFiles.split('\n')[0];
            
            if (latestLog) {
              const { stdout: logContent } = await execAsync(`grep "Observatory listening on" "${latestLog}"`);
              logger.debug(`Flutter log content for PID ${pid}: ${logContent}`);
              
              vmServiceMatch = logContent.match(/Observatory listening on (https?:\/\/[^\s]+)/);
            }
          }
          
          if (vmServiceMatch) {
            appInstance.vmServiceUrl = vmServiceMatch[1];
            logger.debug(`Found VM service URL: ${appInstance.vmServiceUrl}`);
            
            // If we have a VM service URL, we can use it to get more logs
            try {
              // Set up a function to periodically fetch logs via VM service
              setupVMServiceLogFetching(appInstance);
            } catch (vmLogError) {
              logger.debug(`Error setting up VM service log fetching: ${vmLogError}`);
            }
          } else {
            logger.debug(`Could not find VM service URL for PID ${pid} using any method`);
          }
        } catch (error) {
          // VM service URL detection is optional
          logger.debug(`Error detecting VM service URL for PID ${pid}: ${error}`);
        }
        
        systemApps.push(appInstance);
        logger.debug(`Added app instance for PID ${pid}`);
      } catch (error) {
        logger.debug(`Error parsing process line: ${error}`);
      }
    }
    
    logger.info(`Detected ${systemApps.length} system Flutter processes`);
    return systemApps;
  } catch (error) {
    logger.error(`Error detecting system Flutter processes: ${error}`);
    return [];
  }
}

/**
 * Trigger hot reload via VM service URL
 */
async function triggerHotReloadViaVMService(pid: number): Promise<boolean> {
  try {
    // First, find the VM service URL for this process
    const systemApps = await detectSystemFlutterApps();
    const app = systemApps.find(app => app.process && app.process.pid === pid);
    
    if (!app || !app.vmServiceUrl) {
      logger.error(`Cannot trigger hot reload: VM service URL not found for PID ${pid}`);
      return false;
    }
    
    // Parse the VM service URL
    const vmServiceUrl = new URL(app.vmServiceUrl);
    
    // The correct endpoint for Flutter hot reload is _flutter/reload
    // We need to find the isolate ID first
    logger.info(`Getting isolate ID from VM service at ${app.vmServiceUrl}`);
    
    // First, get the list of isolates
    const getVMInfoCmd = `curl -s "${app.vmServiceUrl}/vm"`;
    const { stdout: vmInfo } = await execAsync(getVMInfoCmd);
    
    try {
      const vmData = JSON.parse(vmInfo);
      if (!vmData.isolates || vmData.isolates.length === 0) {
        logger.error('No isolates found in VM');
        return false;
      }
      
      // Get the first isolate ID
      const isolateId = vmData.isolates[0].id;
      logger.info(`Found isolate ID: ${isolateId}`);
      
      // Now trigger hot reload using the Flutter service protocol
      const hotReloadCmd = `curl -s -X POST "${app.vmServiceUrl}/_flutter/reload?isolateId=${isolateId}&pause=false&reason=manual"`;
      logger.info(`Executing hot reload command: ${hotReloadCmd}`);
      
      const { stdout: reloadResult } = await execAsync(hotReloadCmd);
      logger.info(`Hot reload result: ${reloadResult}`);
      
      // Check if reload was successful
      try {
        const reloadData = JSON.parse(reloadResult);
        if (reloadData.success === true) {
          logger.info(`Hot reload successful for PID ${pid}`);
          return true;
        } else {
          logger.error(`Hot reload failed: ${reloadData.message || 'Unknown error'}`);
          return false;
        }
      } catch (parseError) {
        logger.error(`Error parsing reload result: ${parseError}`);
        return false;
      }
    } catch (parseError) {
      logger.error(`Error parsing VM info: ${parseError}`);
      
      // Alternative approach: try the legacy service protocol
      try {
        logger.info('Trying legacy hot reload approach...');
        const legacyReloadCmd = `curl -s -X POST "${app.vmServiceUrl}/hot-reload"`;
        await execAsync(legacyReloadCmd);
        logger.info(`Legacy hot reload triggered for PID ${pid}`);
        return true;
      } catch (legacyError) {
        logger.error(`Legacy hot reload failed: ${legacyError}`);
        return false;
      }
    }
  } catch (error) {
    logger.error(`Error triggering hot reload via VM service: ${error}`);
    return false;
  }
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

/**
 * Set up periodic log fetching via VM service
 */
function setupVMServiceLogFetching(appInstance: FlutterAppInstance): void {
  if (!appInstance.vmServiceUrl) {
    logger.debug(`Cannot set up VM service log fetching: no VM service URL for app ${appInstance.id}`);
    return;
  }
  
  // Store the last log fetch time to avoid duplicates
  let lastLogFetchTime = Date.now();
  
  // Set up a periodic fetch (every 5 seconds)
  const fetchInterval = setInterval(async () => {
    try {
      // Only fetch logs if the app is still running
      if (appInstance.status !== 'running') {
        clearInterval(fetchInterval);
        return;
      }
      
      // Fetch logs via VM service
      const { stdout: logData } = await execAsync(`curl -s "${appInstance.vmServiceUrl}/getLogHistory"`);
      
      try {
        const logResponse = JSON.parse(logData);
        if (logResponse.result && logResponse.result.logs) {
          const newLogs = logResponse.result.logs.filter((log: any) => log.timestamp > lastLogFetchTime);
          
          if (newLogs.length > 0) {
            // Add new logs to the app instance
            for (const log of newLogs) {
              const logMessage = `[${log.level}] ${log.message}`;
              appInstance.logs.push(logMessage);
              
              // Keep logs under the maximum size
              if (appInstance.logs.length > MAX_LOGS) {
                appInstance.logs.shift();
              }
            }
            
            logger.debug(`Added ${newLogs.length} new logs from VM service for app ${appInstance.id}`);
            
            // Update last fetch time
            lastLogFetchTime = newLogs[newLogs.length - 1].timestamp;
          }
        }
      } catch (parseError) {
        logger.debug(`Error parsing VM service log response: ${parseError}`);
      }
    } catch (error) {
      logger.debug(`Error fetching logs via VM service: ${error}`);
    }
  }, 5000);
  
  // Clean up interval if process is killed
  if (appInstance.process) {
    appInstance.process.on('exit', () => {
      clearInterval(fetchInterval);
    });
  }
} 