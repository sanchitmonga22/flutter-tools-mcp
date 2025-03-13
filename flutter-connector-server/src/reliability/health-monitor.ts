/**
 * Health Monitor and Self-healing System
 * 
 * This module provides advanced reliability and self-healing capabilities:
 * - Process monitoring and auto-recovery
 * - Automatic reconnection to devices
 * - Self-recovery for Flutter app crashes
 * - Performance monitoring and optimization
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { getAppInstances, registerApp } from '../app-manager.js';

// Promisify exec
const exec = promisify(execCallback);

// Health check intervals (ms)
const SYSTEM_HEALTH_CHECK_INTERVAL = 60000; // 1 minute
const ADB_CONNECTION_CHECK_INTERVAL = 120000; // 2 minutes
const FLUTTER_APPS_CHECK_INTERVAL = 30000; // 30 seconds
const VM_SERVICE_CHECK_INTERVAL = 45000; // 45 seconds

// Resource usage thresholds
const HIGH_CPU_THRESHOLD = 80; // 80% CPU usage
const HIGH_MEMORY_THRESHOLD = 80; // 80% memory usage
const HIGH_DISK_THRESHOLD = 90; // 90% disk usage

// Store timer references for cleanup
let systemHealthCheckTimer: NodeJS.Timeout | null = null;
let adbConnectionCheckTimer: NodeJS.Timeout | null = null;
let flutterAppsCheckTimer: NodeJS.Timeout | null = null;
let vmServiceCheckTimer: NodeJS.Timeout | null = null;

// Track recovery attempts to avoid infinite recovery loops
const recoveryAttempts: Map<string, { count: number, lastAttempt: number }> = new Map();
const MAX_RECOVERY_ATTEMPTS = 3;
const RECOVERY_RESET_TIME = 3600000; // 1 hour

// Health status tracking
interface HealthStatus {
  systemHealth: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    timestamp: number;
  };
  adbStatus: {
    connected: boolean;
    lastChecked: number;
  };
  devicesStatus: {
    count: number;
    healthy: number;
    lastChecked: number;
  };
  appsStatus: {
    count: number;
    healthy: number;
    lastChecked: number;
  };
  vmServicesStatus: {
    count: number;
    healthy: number;
    lastChecked: number;
  };
  recoveryActions: {
    total: number;
    successful: number;
    lastAction: string | null;
    lastActionTime: number | null;
  };
}

const healthStatus: HealthStatus = {
  systemHealth: {
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    timestamp: 0
  },
  adbStatus: {
    connected: false,
    lastChecked: 0
  },
  devicesStatus: {
    count: 0,
    healthy: 0,
    lastChecked: 0
  },
  appsStatus: {
    count: 0,
    healthy: 0,
    lastChecked: 0
  },
  vmServicesStatus: {
    count: 0,
    healthy: 0,
    lastChecked: 0
  },
  recoveryActions: {
    total: 0,
    successful: 0,
    lastAction: null,
    lastActionTime: null
  }
};

/**
 * Initialize the health monitor
 */
export function initHealthMonitor(): void {
  logger.info('Initializing health monitor and self-healing system...');
  
  // Check system health periodically
  systemHealthCheckTimer = setInterval(checkSystemHealth, SYSTEM_HEALTH_CHECK_INTERVAL);
  
  // Check ADB connection periodically
  adbConnectionCheckTimer = setInterval(checkAdbConnection, ADB_CONNECTION_CHECK_INTERVAL);
  
  // Check Flutter apps health periodically
  flutterAppsCheckTimer = setInterval(checkAppsHealth, FLUTTER_APPS_CHECK_INTERVAL);
  
  // Check VM service connections periodically
  vmServiceCheckTimer = setInterval(checkVmServiceConnections, VM_SERVICE_CHECK_INTERVAL);
  
  // Run initial checks
  setTimeout(() => {
    checkSystemHealth();
    checkAdbConnection();
    checkAppsHealth();
    checkVmServiceConnections();
  }, 5000);
  
  logger.info('Health monitor initialized');
}

/**
 * Stop the health monitor
 */
export function stopHealthMonitor(): void {
  logger.info('Stopping health monitor...');
  
  // Clear all timers
  if (systemHealthCheckTimer) clearInterval(systemHealthCheckTimer);
  if (adbConnectionCheckTimer) clearInterval(adbConnectionCheckTimer);
  if (flutterAppsCheckTimer) clearInterval(flutterAppsCheckTimer);
  if (vmServiceCheckTimer) clearInterval(vmServiceCheckTimer);
  
  systemHealthCheckTimer = null;
  adbConnectionCheckTimer = null;
  flutterAppsCheckTimer = null;
  vmServiceCheckTimer = null;
  
  logger.info('Health monitor stopped');
}

/**
 * Check system health and perform self-healing if necessary
 */
async function checkSystemHealth(): Promise<void> {
  try {
    logger.debug('Checking system health...');
    
    // Get system resource usage
    const cpuUsage = await getCpuUsage();
    const memoryUsage = await getMemoryUsage();
    const diskUsage = await getDiskUsage();
    
    // Update health status
    healthStatus.systemHealth = {
      cpuUsage,
      memoryUsage,
      diskUsage,
      timestamp: Date.now()
    };
    
    // Log high resource usage
    if (cpuUsage > HIGH_CPU_THRESHOLD) {
      logger.warn(`High CPU usage detected: ${cpuUsage.toFixed(1)}%`);
    }
    
    if (memoryUsage > HIGH_MEMORY_THRESHOLD) {
      logger.warn(`High memory usage detected: ${memoryUsage.toFixed(1)}%`);
    }
    
    if (diskUsage > HIGH_DISK_THRESHOLD) {
      logger.warn(`High disk usage detected: ${diskUsage.toFixed(1)}%`);
    }
    
    // Check Flutter and ADB tools availability
    await checkToolsAvailability();
    
    // Self-healing for high resource usage
    if (memoryUsage > HIGH_MEMORY_THRESHOLD) {
      logger.info('Attempting to optimize memory usage...');
      await optimizeMemoryUsage();
    }
    
    if (diskUsage > HIGH_DISK_THRESHOLD) {
      logger.info('Attempting to clean up temporary files...');
      await cleanupTempFiles();
    }
  } catch (error) {
    logger.error('Error checking system health:', error);
  }
}

/**
 * Get current CPU usage
 */
async function getCpuUsage(): Promise<number> {
  try {
    // First measurement
    const startMeasure = os.cpus();
    
    // Wait a short period
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Second measurement
    const endMeasure = os.cpus();
    
    let idleDiff = 0;
    let totalDiff = 0;
    
    // Calculate the difference
    for (let i = 0; i < startMeasure.length; i++) {
      const startCpu = startMeasure[i];
      const endCpu = endMeasure[i];
      
      // Calculate total time
      const startTotal = Object.values(startCpu.times).reduce((a, b) => a + b, 0);
      const endTotal = Object.values(endCpu.times).reduce((a, b) => a + b, 0);
      
      idleDiff += (endCpu.times.idle - startCpu.times.idle);
      totalDiff += (endTotal - startTotal);
    }
    
    // Calculate CPU usage percentage
    const cpuUsage = 100 - (idleDiff / totalDiff * 100);
    return Math.min(100, Math.max(0, cpuUsage));
  } catch (error) {
    logger.error('Error getting CPU usage:', error);
    return 0;
  }
}

/**
 * Get current memory usage
 */
function getMemoryUsage(): number {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Calculate memory usage percentage
    return (usedMem / totalMem) * 100;
  } catch (error) {
    logger.error('Error getting memory usage:', error);
    return 0;
  }
}

/**
 * Get current disk usage
 */
async function getDiskUsage(): Promise<number> {
  try {
    // This is platform-specific; for simplicity, we'll use df on Unix-like systems
    if (os.platform() === 'win32') {
      // On Windows, we'd use wmic, but we'll just return a placeholder for now
      return 0;
    } else {
      // On Unix-like systems, use df
      const { stdout } = await exec('df -k / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 5) {
        // Parse the used percentage
        const percentStr = parts[4].replace('%', '');
        return parseInt(percentStr, 10);
      }
    }
    
    return 0;
  } catch (error) {
    logger.error('Error getting disk usage:', error);
    return 0;
  }
}

/**
 * Check Flutter and ADB tools availability
 */
async function checkToolsAvailability(): Promise<boolean> {
  try {
    // Check Flutter
    await exec('flutter --version');
    
    // Check ADB (only on platforms that typically use it)
    if (os.platform() !== 'darwin' && os.platform() !== 'win32') {
      await exec('adb version');
    }
    
    return true;
  } catch (error) {
    logger.error('Error checking tools availability:', error);
    return false;
  }
}

/**
 * Optimize memory usage by forcing garbage collection
 */
async function optimizeMemoryUsage(): Promise<void> {
  try {
    // In Node.js, we can only suggest garbage collection
    if (global.gc) {
      global.gc();
      logger.info('Forced garbage collection');
    }
    
    // Additional memory optimization steps could be added here
  } catch (error) {
    logger.error('Error optimizing memory usage:', error);
  }
}

/**
 * Clean up temporary files
 */
async function cleanupTempFiles(): Promise<void> {
  try {
    // Determine temp directory
    const tempDir = os.tmpdir();
    
    // Look for Flutter/Dart related temp files
    const flutterTempPattern = /flutter_.*|dart_.*|\.dart_tool/;
    
    // Read temp directory
    const files = await fs.readdir(tempDir);
    
    // Filter and delete relevant temp files
    let deletedCount = 0;
    for (const file of files) {
      if (flutterTempPattern.test(file)) {
        const filePath = path.join(tempDir, file);
        try {
          const stats = await fs.stat(filePath);
          
          // Only delete files older than 1 hour
          const fileAgeMs = Date.now() - stats.mtime.getTime();
          if (fileAgeMs > 3600000) { // 1 hour
            if (stats.isDirectory()) {
              await fs.rm(filePath, { recursive: true, force: true });
            } else {
              await fs.unlink(filePath);
            }
            deletedCount++;
          }
        } catch (e) {
          // Ignore errors for specific files
          logger.debug(`Could not delete temp file ${file}:`, e);
        }
      }
    }
    
    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} temporary files`);
    }
  } catch (error) {
    logger.error('Error cleaning up temporary files:', error);
  }
}

/**
 * Check ADB connection and attempt to restart if needed
 */
async function checkAdbConnection(): Promise<void> {
  try {
    logger.debug('Checking ADB connection...');
    
    // Skip if not on a platform that typically uses ADB
    if (os.platform() === 'darwin' || os.platform() === 'win32') {
      healthStatus.adbStatus = {
        connected: true, // Assume connected on platforms where we don't check
        lastChecked: Date.now()
      };
      return;
    }
    
    // Check ADB status
    const { stdout } = await exec('adb devices');
    const isConnected = !stdout.includes('daemon not running') && !stdout.includes('daemon starting');
    
    // Update health status
    healthStatus.adbStatus = {
      connected: isConnected,
      lastChecked: Date.now()
    };
    
    // Attempt to restart ADB if not connected
    if (!isConnected) {
      logger.warn('ADB daemon is not running properly, attempting to restart...');
      
      // Kill and restart ADB server
      try {
        await exec('adb kill-server');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await exec('adb start-server');
        
        // Verify restart was successful
        const { stdout: verifyStdout } = await exec('adb devices');
        const restartSuccessful = !verifyStdout.includes('daemon not running');
        
        if (restartSuccessful) {
          logger.info('Successfully restarted ADB daemon');
          
          // Update recovery stats
          healthStatus.recoveryActions.total++;
          healthStatus.recoveryActions.successful++;
          healthStatus.recoveryActions.lastAction = 'restart_adb';
          healthStatus.recoveryActions.lastActionTime = Date.now();
        } else {
          logger.error('Failed to restart ADB daemon');
        }
      } catch (restartError) {
        logger.error('Error restarting ADB daemon:', restartError);
      }
    }
  } catch (error) {
    logger.error('Error checking ADB connection:', error);
  }
}

/**
 * Check health of Flutter apps and attempt recovery if needed
 */
async function checkAppsHealth(): Promise<void> {
  try {
    logger.debug('Checking Flutter apps health...');
    
    const apps = getAppInstances();
    let healthyCount = 0;
    
    // Update apps status
    healthStatus.appsStatus = {
      count: apps.length,
      healthy: 0, // Will be updated
      lastChecked: Date.now()
    };
    
    // Check each app
    for (const app of apps) {
      // Skip apps that are intentionally stopped
      if (app.state === 'stopped') {
        healthyCount++;
        continue;
      }
      
      let isHealthy = true;
      
      // Check if process is still running
      if (app.pid) {
        try {
          const { stdout } = await exec(
            os.platform() === 'win32'
              ? `tasklist /FI "PID eq ${app.pid}" /NH`
              : `ps -p ${app.pid} -o comm=`
          );
          
          if (!stdout.trim()) {
            logger.warn(`App ${app.id} process (PID: ${app.pid}) is no longer running`);
            isHealthy = false;
          }
        } catch (error) {
          logger.warn(`Failed to check process for app ${app.id}:`, error);
          isHealthy = false;
        }
      }
      
      // Check VM service connection
      if (app.vmServiceUrl && isHealthy) {
        try {
          const response = await fetch(app.vmServiceUrl, { method: 'GET' });
          if (!response.ok) {
            logger.warn(`VM service for app ${app.id} is not responsive`);
            isHealthy = false;
          }
        } catch (error) {
          logger.warn(`Failed to connect to VM service for app ${app.id}:`, error);
          isHealthy = false;
        }
      }
      
      if (isHealthy) {
        healthyCount++;
      } else {
        // Attempt recovery for unhealthy app
        await attemptAppRecovery(app.id);
      }
    }
    
    // Update healthy count
    healthStatus.appsStatus.healthy = healthyCount;
    
    logger.debug(`Apps health check: ${healthyCount}/${apps.length} healthy`);
  } catch (error) {
    logger.error('Error checking apps health:', error);
  }
}

/**
 * Attempt to recover a Flutter app
 */
async function attemptAppRecovery(appId: string): Promise<boolean> {
  try {
    logger.info(`Attempting to recover app ${appId}...`);
    
    // Check recovery attempts to prevent infinite recovery loops
    const appRecovery = recoveryAttempts.get(appId) || { count: 0, lastAttempt: 0 };
    const now = Date.now();
    
    // Reset recovery count if last attempt was long ago
    if (now - appRecovery.lastAttempt > RECOVERY_RESET_TIME) {
      appRecovery.count = 0;
    }
    
    // Check if we've exceeded max recovery attempts
    if (appRecovery.count >= MAX_RECOVERY_ATTEMPTS) {
      logger.warn(`Exceeded maximum recovery attempts for app ${appId}`);
      return false;
    }
    
    // Get the app instance
    const app = getAppInstances().find(a => a.id === appId);
    if (!app) {
      logger.warn(`Cannot recover app ${appId}: App not found`);
      return false;
    }
    
    // Update recovery attempts
    appRecovery.count++;
    appRecovery.lastAttempt = now;
    recoveryAttempts.set(appId, appRecovery);
    
    // Update recovery stats
    healthStatus.recoveryActions.total++;
    healthStatus.recoveryActions.lastAction = `recover_app_${appId}`;
    healthStatus.recoveryActions.lastActionTime = now;
    
    // Strategy depends on the app state
    if (app.launchCommand) {
      // If we have the launch command, we can restart the app
      logger.info(`Restarting app ${appId} using launch command`);
      
      // Kill the current process if it exists
      if (app.pid) {
        try {
          if (os.platform() === 'win32') {
            await exec(`taskkill /PID ${app.pid} /F`);
          } else {
            await exec(`kill -9 ${app.pid}`);
          }
        } catch (killError) {
          logger.debug(`Error killing process for app ${appId}:`, killError);
          // Continue anyway as the process might already be dead
        }
      }
      
      // Register a new app instance with the same launch command
      try {
        const recoveredApp = await registerApp({
          appName: app.name,
          appType: app.type,
          launchCommand: app.launchCommand,
          workingDirectory: app.workingDirectory,
          deviceId: app.deviceId
        });
        
        if (recoveredApp) {
          logger.info(`Successfully recovered app ${appId}`);
          healthStatus.recoveryActions.successful++;
          return true;
        }
      } catch (registerError) {
        logger.error(`Error registering recovered app ${appId}:`, registerError);
      }
    } else {
      logger.warn(`Cannot recover app ${appId}: No launch command available`);
    }
    
    return false;
  } catch (error) {
    logger.error(`Error recovering app ${appId}:`, error);
    return false;
  }
}

/**
 * Check VM service connections
 */
async function checkVmServiceConnections(): Promise<void> {
  try {
    logger.debug('Checking VM service connections...');
    
    const apps = getAppInstances();
    let healthyCount = 0;
    
    // Update VM services status
    healthStatus.vmServicesStatus = {
      count: apps.filter(a => a.vmServiceUrl).length,
      healthy: 0, // Will be updated
      lastChecked: Date.now()
    };
    
    // Check each app with a VM service URL
    for (const app of apps) {
      if (!app.vmServiceUrl || app.state === 'stopped') {
        continue;
      }
      
      try {
        const response = await fetch(app.vmServiceUrl, { method: 'GET' });
        if (response.ok) {
          healthyCount++;
        } else {
          logger.warn(`VM service for app ${app.id} returned status ${response.status}`);
        }
      } catch (error) {
        logger.warn(`Failed to connect to VM service for app ${app.id}:`, error);
      }
    }
    
    // Update healthy count
    healthStatus.vmServicesStatus.healthy = healthyCount;
    
    logger.debug(`VM service check: ${healthyCount}/${healthStatus.vmServicesStatus.count} healthy`);
  } catch (error) {
    logger.error('Error checking VM service connections:', error);
  }
}

/**
 * Get health status report
 */
export function getHealthStatus(): HealthStatus {
  return { ...healthStatus };
} 