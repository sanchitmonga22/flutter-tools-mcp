/**
 * Flutter Device Manager
 * 
 * This module provides advanced device management capabilities:
 * - Discovering connected devices (Android, iOS, web)
 * - Maintaining device state and capabilities
 * - Custom device configuration management
 * - Intelligent device selection
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger.js';

// Promisify exec
const execAsync = promisify(exec);

// Device type enum
export enum DeviceType {
  ANDROID_EMULATOR = 'android-emulator',
  ANDROID_PHYSICAL = 'android-physical',
  IOS_SIMULATOR = 'ios-simulator',
  IOS_PHYSICAL = 'ios-physical',
  WEB = 'web',
  DESKTOP = 'desktop',
  CUSTOM = 'custom',
  UNKNOWN = 'unknown'
}

// Device interface
export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  platform: string;
  isConnected: boolean;
  lastSeen: number;
  capabilities: {
    supportsScreenshot: boolean;
    supportsHotReload: boolean;
    supportsDebugging: boolean;
    supportsNetworkInspection: boolean;
    supportsProfiling: boolean;
  };
  properties: Record<string, string>;
  customConfig?: Record<string, any>;
}

// Store connected devices
const devices: Map<string, Device> = new Map();

// Device discovery interval in milliseconds
const DEVICE_DISCOVERY_INTERVAL = 10000; // 10 seconds

// Timer for periodic discovery
let discoveryTimer: NodeJS.Timeout | null = null;

/**
 * Initialize device discovery
 */
export async function initDeviceDiscovery(): Promise<void> {
  logger.info('Initializing Flutter device discovery...');
  
  // Perform initial discovery
  await discoverDevices();
  
  // Set up periodic discovery
  discoveryTimer = setInterval(discoverDevices, DEVICE_DISCOVERY_INTERVAL);
  
  return Promise.resolve();
}

/**
 * Stop device discovery
 */
export function stopDeviceDiscovery(): void {
  if (discoveryTimer) {
    clearInterval(discoveryTimer);
    discoveryTimer = null;
  }
}

/**
 * Main device discovery function
 */
async function discoverDevices(): Promise<void> {
  try {
    logger.debug('Discovering Flutter devices...');
    
    // Get devices before discovery to compare later
    const devicesBefore = Array.from(devices.values());
    const deviceIdsBeforeDiscovery = new Set(devicesBefore.map(device => device.id));
    
    // Discover devices using Flutter CLI
    await discoverFlutterDevices();
    
    // Discover Android devices using ADB
    await discoverAndroidDevices();
    
    // Discover iOS devices
    await discoverIOSDevices();
    
    // Update connection status for devices not seen in this scan
    const currentTime = Date.now();
    devices.forEach(device => {
      // If device wasn't seen in the last 30 seconds, mark as disconnected
      if (currentTime - device.lastSeen > 30000) {
        device.isConnected = false;
      }
    });
    
    // Get devices after discovery to see what's new
    const devicesAfter = Array.from(devices.values());
    const newDevices = devicesAfter.filter(device => !deviceIdsBeforeDiscovery.has(device.id));
    
    if (newDevices.length > 0) {
      logger.info(`Discovered ${newDevices.length} new devices`);
      newDevices.forEach(device => {
        logger.info(`  - Device ID: ${device.id}, Name: ${device.name}, Type: ${device.type}`);
      });
    }
  } catch (error) {
    logger.error('Error during device discovery:', error);
  }
}

/**
 * Discover devices using Flutter CLI
 */
async function discoverFlutterDevices(): Promise<void> {
  try {
    // Run 'flutter devices' command to get connected devices
    const { stdout } = await execAsync('flutter devices --machine');
    
    // Parse JSON output
    const devicesData = JSON.parse(stdout);
    
    // Process each device
    for (const deviceData of devicesData) {
      const deviceId = deviceData.id;
      const deviceName = deviceData.name;
      const devicePlatform = deviceData.platform;
      const isEmulator = deviceData.emulator || false;
      
      // Determine device type
      let deviceType = DeviceType.UNKNOWN;
      if (devicePlatform === 'android') {
        deviceType = isEmulator ? DeviceType.ANDROID_EMULATOR : DeviceType.ANDROID_PHYSICAL;
      } else if (devicePlatform === 'ios') {
        deviceType = isEmulator ? DeviceType.IOS_SIMULATOR : DeviceType.IOS_PHYSICAL;
      } else if (devicePlatform === 'web') {
        deviceType = DeviceType.WEB;
      } else if (['windows', 'macos', 'linux'].includes(devicePlatform)) {
        deviceType = DeviceType.DESKTOP;
      }
      
      // Create or update device entry
      updateDevice(deviceId, {
        id: deviceId,
        name: deviceName,
        type: deviceType,
        platform: devicePlatform,
        isConnected: true,
        lastSeen: Date.now(),
        capabilities: {
          supportsScreenshot: detectScreenshotSupport(deviceType),
          supportsHotReload: true,
          supportsDebugging: true,
          supportsNetworkInspection: deviceType !== DeviceType.DESKTOP,
          supportsProfiling: true,
        },
        properties: {
          targetPlatform: deviceData.targetPlatform || '',
          emulator: String(isEmulator),
          sdk: deviceData.sdk || '',
        }
      });
    }
  } catch (error) {
    logger.error('Error discovering Flutter devices:', error);
  }
}

/**
 * Discover Android devices using ADB
 */
async function discoverAndroidDevices(): Promise<void> {
  try {
    // Run 'adb devices' command to get connected Android devices
    const { stdout } = await execAsync('adb devices -l');
    
    // Parse output - adb output looks like:
    // List of devices attached
    // emulator-5554 device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emulator64_arm64
    // 084113125J009188 device product:beyond1q model:SM_G973U device:beyond1q
    
    const lines = stdout.split('\n');
    // Skip the first line which is the header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      
      const deviceId = parts[0];
      const status = parts[1];
      
      // Skip unauthorized or offline devices
      if (status !== 'device') continue;
      
      // Get device properties
      const properties: Record<string, string> = {};
      
      for (let j = 2; j < parts.length; j++) {
        const propParts = parts[j].split(':');
        if (propParts.length === 2) {
          properties[propParts[0]] = propParts[1];
        }
      }
      
      // Get more detailed device info
      try {
        const { stdout: deviceProps } = await execAsync(`adb -s ${deviceId} shell getprop`);
        
        // Extract useful properties - example lines:
        // [ro.product.model]: [Pixel 4]
        // [ro.product.manufacturer]: [Google]
        const modelMatch = deviceProps.match(/\[ro\.product\.model\]:\s*\[(.*?)\]/);
        const manufacturerMatch = deviceProps.match(/\[ro\.product\.manufacturer\]:\s*\[(.*?)\]/);
        const versionMatch = deviceProps.match(/\[ro\.build\.version\.release\]:\s*\[(.*?)\]/);
        const sdkMatch = deviceProps.match(/\[ro\.build\.version\.sdk\]:\s*\[(.*?)\]/);
        
        if (modelMatch && modelMatch[1]) properties.model = modelMatch[1];
        if (manufacturerMatch && manufacturerMatch[1]) properties.manufacturer = manufacturerMatch[1];
        if (versionMatch && versionMatch[1]) properties.androidVersion = versionMatch[1];
        if (sdkMatch && sdkMatch[1]) properties.sdkVersion = sdkMatch[1];
      } catch (propError) {
        logger.debug(`Error getting properties for device ${deviceId}:`, propError);
      }
      
      // Determine if emulator or physical device
      const isEmulator = deviceId.startsWith('emulator-') || 
                         properties.model?.includes('sdk') || 
                         properties.model?.includes('emulator');
      
      const deviceType = isEmulator ? DeviceType.ANDROID_EMULATOR : DeviceType.ANDROID_PHYSICAL;
      const deviceName = properties.model || 
                         properties.manufacturer ? 
                         `${properties.manufacturer} ${properties.model}` : 
                         `Android Device (${deviceId})`;
      
      // Create or update device entry
      updateDevice(deviceId, {
        id: deviceId,
        name: deviceName,
        type: deviceType,
        platform: 'android',
        isConnected: true,
        lastSeen: Date.now(),
        capabilities: {
          supportsScreenshot: true,
          supportsHotReload: true,
          supportsDebugging: true,
          supportsNetworkInspection: true,
          supportsProfiling: true,
        },
        properties
      });
    }
  } catch (error) {
    logger.debug('Error discovering Android devices:', error);
  }
}

/**
 * Discover iOS devices
 */
async function discoverIOSDevices(): Promise<void> {
  try {
    // Only attempt on macOS
    if (process.platform !== 'darwin') {
      return;
    }
    
    // Run 'xcrun simctl list' command to get iOS simulators
    const { stdout } = await execAsync('xcrun simctl list devices --json');
    
    // Parse JSON output
    const data = JSON.parse(stdout);
    
    // Process simulators - data structure looks like:
    // { "devices": { "iOS 15.0": [ { "udid": "...", "name": "iPhone 13", "state": "Booted" } ] } }
    for (const [runtimeName, deviceList] of Object.entries(data.devices)) {
      for (const device of deviceList as any[]) {
        // Skip unavailable simulators
        if (device.availability !== '(available)' && !device.isAvailable) continue;
        
        const deviceId = device.udid;
        const deviceName = device.name;
        const state = device.state;
        
        // Create or update device entry
        updateDevice(deviceId, {
          id: deviceId,
          name: `${deviceName} (${runtimeName})`,
          type: DeviceType.IOS_SIMULATOR,
          platform: 'ios',
          isConnected: state === 'Booted',
          lastSeen: Date.now(),
          capabilities: {
            supportsScreenshot: true,
            supportsHotReload: true,
            supportsDebugging: true,
            supportsNetworkInspection: true,
            supportsProfiling: true,
          },
          properties: {
            state,
            runtime: runtimeName,
          }
        });
      }
    }
    
    // TODO: Add support for physical iOS devices using 'ios-deploy -c'
    // This would require installing ios-deploy: npm install -g ios-deploy
  } catch (error) {
    logger.debug('Error discovering iOS devices:', error);
  }
}

/**
 * Detect screenshot support for a device type
 */
function detectScreenshotSupport(deviceType: DeviceType): boolean {
  switch (deviceType) {
    case DeviceType.ANDROID_EMULATOR:
    case DeviceType.ANDROID_PHYSICAL:
    case DeviceType.IOS_SIMULATOR:
      return true;
    case DeviceType.IOS_PHYSICAL:
      return process.platform === 'darwin'; // Only supported on macOS
    case DeviceType.WEB:
      return false; // Web screenshots handled differently
    case DeviceType.DESKTOP:
      return false; // Desktop screenshots not yet supported
    default:
      return false;
  }
}

/**
 * Create or update a device entry
 */
function updateDevice(deviceId: string, deviceData: Partial<Device>): void {
  const existingDevice = devices.get(deviceId);
  
  if (existingDevice) {
    // Update existing device
    devices.set(deviceId, {
      ...existingDevice,
      ...deviceData,
      // Preserve customConfig if it exists
      customConfig: existingDevice.customConfig || deviceData.customConfig
    });
  } else {
    // Create new device entry
    devices.set(deviceId, {
      id: deviceId,
      name: deviceData.name || `Unknown (${deviceId})`,
      type: deviceData.type || DeviceType.UNKNOWN,
      platform: deviceData.platform || 'unknown',
      isConnected: deviceData.isConnected !== undefined ? deviceData.isConnected : true,
      lastSeen: deviceData.lastSeen || Date.now(),
      capabilities: deviceData.capabilities || {
        supportsScreenshot: false,
        supportsHotReload: false,
        supportsDebugging: false,
        supportsNetworkInspection: false,
        supportsProfiling: false,
      },
      properties: deviceData.properties || {},
      customConfig: deviceData.customConfig
    } as Device);
  }
}

/**
 * Register a custom device
 */
export function registerCustomDevice(deviceConfig: Partial<Device>): Device {
  // Generate a unique ID if not provided
  const deviceId = deviceConfig.id || `custom-${uuidv4()}`;
  
  // Create the device with custom config
  const device: Device = {
    id: deviceId,
    name: deviceConfig.name || `Custom Device (${deviceId})`,
    type: DeviceType.CUSTOM,
    platform: deviceConfig.platform || 'custom',
    isConnected: deviceConfig.isConnected !== undefined ? deviceConfig.isConnected : true,
    lastSeen: Date.now(),
    capabilities: deviceConfig.capabilities || {
      supportsScreenshot: false,
      supportsHotReload: true,
      supportsDebugging: true,
      supportsNetworkInspection: false,
      supportsProfiling: false,
    },
    properties: deviceConfig.properties || {},
    customConfig: deviceConfig.customConfig || {}
  };
  
  // Store the device
  devices.set(deviceId, device);
  
  logger.info(`Registered custom device: ${device.name} (${deviceId})`);
  
  return device;
}

/**
 * Get a specific device by ID
 */
export function getDevice(deviceId: string): Device | null {
  return devices.get(deviceId) || null;
}

/**
 * Get all devices
 */
export function getAllDevices(): Device[] {
  return Array.from(devices.values());
}

/**
 * Get all connected devices
 */
export function getConnectedDevices(): Device[] {
  return Array.from(devices.values()).filter(device => device.isConnected);
}

/**
 * Get devices by platform
 */
export function getDevicesByPlatform(platform: string): Device[] {
  return Array.from(devices.values()).filter(device => 
    device.platform === platform && device.isConnected
  );
}

/**
 * Get devices by type
 */
export function getDevicesByType(type: DeviceType): Device[] {
  return Array.from(devices.values()).filter(device => 
    device.type === type && device.isConnected
  );
}

/**
 * Get the best device for a platform based on priority rules
 */
export function getBestDeviceForPlatform(platform: string): Device | null {
  const platformDevices = getDevicesByPlatform(platform).filter(d => d.isConnected);
  
  if (platformDevices.length === 0) {
    return null;
  }
  
  // Define priorities for different device types
  const typePriority: Record<DeviceType, number> = {
    [DeviceType.ANDROID_PHYSICAL]: 1,
    [DeviceType.IOS_PHYSICAL]: 1,
    [DeviceType.ANDROID_EMULATOR]: 2,
    [DeviceType.IOS_SIMULATOR]: 2,
    [DeviceType.WEB]: 3,
    [DeviceType.DESKTOP]: 4, 
    [DeviceType.CUSTOM]: 5,
    [DeviceType.UNKNOWN]: 6
  };
  
  // Sort by type priority
  platformDevices.sort((a, b) => typePriority[a.type] - typePriority[b.type]);
  
  return platformDevices[0];
}

/**
 * Update device capabilities based on testing
 */
export async function updateDeviceCapabilities(deviceId: string): Promise<void> {
  const device = devices.get(deviceId);
  if (!device) return;
  
  try {
    // Test screenshot capability
    if (device.type === DeviceType.ANDROID_EMULATOR || device.type === DeviceType.ANDROID_PHYSICAL) {
      try {
        await execAsync(`adb -s ${deviceId} shell screencap -p /sdcard/test_screenshot.png`);
        device.capabilities.supportsScreenshot = true;
        // Clean up
        await execAsync(`adb -s ${deviceId} shell rm /sdcard/test_screenshot.png`);
      } catch (error) {
        device.capabilities.supportsScreenshot = false;
      }
    } else if (device.type === DeviceType.IOS_SIMULATOR) {
      try {
        const tempPath = `/tmp/test_screenshot_${Date.now()}.png`;
        await execAsync(`xcrun simctl io ${deviceId} screenshot ${tempPath}`);
        device.capabilities.supportsScreenshot = true;
        // Clean up
        await execAsync(`rm ${tempPath}`);
      } catch (error) {
        device.capabilities.supportsScreenshot = false;
      }
    }
    
    // Other capability tests can be added here
    
  } catch (error) {
    logger.error(`Error updating capabilities for device ${deviceId}:`, error);
  }
}

/**
 * Remove a device
 */
export function removeDevice(deviceId: string): boolean {
  return devices.delete(deviceId);
}

/**
 * Get device logs (for connected Android devices)
 */
export async function getDeviceLogs(deviceId: string, limit: number = 100): Promise<string[]> {
  const device = devices.get(deviceId);
  
  if (!device || !device.isConnected) {
    return [];
  }
  
  if (device.type === DeviceType.ANDROID_EMULATOR || device.type === DeviceType.ANDROID_PHYSICAL) {
    try {
      // Use adb logcat to get logs
      const { stdout } = await execAsync(`adb -s ${deviceId} logcat -d -v threadtime -t ${limit}`);
      return stdout.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
      logger.error(`Error getting logs for device ${deviceId}:`, error);
      return [];
    }
  } else if (device.type === DeviceType.IOS_SIMULATOR) {
    try {
      // Get simulator log - newer versions of Xcode use unified logging
      const { stdout } = await execAsync(
        `xcrun simctl spawn ${deviceId} log show --style compact --predicate 'subsystem contains "com.apple.CoreSimulator.SimDevice"' --last ${limit}`
      );
      return stdout.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
      logger.error(`Error getting logs for iOS simulator ${deviceId}:`, error);
      return [];
    }
  }
  
  return [];
}

// Export types
export { Device }; 