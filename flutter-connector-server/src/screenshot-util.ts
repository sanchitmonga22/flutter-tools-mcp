/**
 * Flutter Screenshot Utility
 * 
 * This module provides functions for capturing screenshots from various Flutter app targets:
 * - Android emulators
 * - iOS simulators
 * - Physical Android devices
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { logger } from './utils/logger';

// Promisify exec
const execAsync = promisify(exec);

// Base directory for storing screenshots
const getScreenshotDir = (): string => {
  const homeDir = os.homedir();
  return path.join(homeDir, 'Downloads', 'flutter-screenshots');
};

/**
 * Take a screenshot of an Android emulator
 */
export async function takeAndroidEmulatorScreenshot(deviceId: string): Promise<string | null> {
  try {
    logger.info(`Taking screenshot from Android emulator ${deviceId}`);
    
    // Ensure screenshot directory exists
    const screenshotDir = getScreenshotDir();
    await fs.mkdir(screenshotDir, { recursive: true });
    
    // Generate a unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `flutter_screenshot_${timestamp}.png`;
    const screenshotPath = path.join(screenshotDir, filename);
    
    // Run adb command to take screenshot
    const adbCommand = `adb -s ${deviceId} exec-out screencap -p > "${screenshotPath}"`;
    await execAsync(adbCommand);
    
    // Verify the file exists and has content
    const stats = await fs.stat(screenshotPath);
    if (stats.size === 0) {
      throw new Error('Screenshot file is empty');
    }
    
    // Read the file and convert to base64
    const screenshotData = await fs.readFile(screenshotPath);
    const base64Data = screenshotData.toString('base64');
    
    logger.info(`Screenshot saved to ${screenshotPath}`);
    
    return `data:image/png;base64,${base64Data}`;
  } catch (error) {
    logger.error(`Error taking Android emulator screenshot: ${error}`);
    return null;
  }
}

/**
 * Take a screenshot of an iOS simulator
 */
export async function takeIOSSimulatorScreenshot(): Promise<string | null> {
  try {
    logger.info('Taking screenshot from iOS simulator');
    
    // Ensure screenshot directory exists
    const screenshotDir = getScreenshotDir();
    await fs.mkdir(screenshotDir, { recursive: true });
    
    // Generate a unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `flutter_screenshot_${timestamp}.png`;
    const screenshotPath = path.join(screenshotDir, filename);
    
    // Use xcrun command to take screenshot of the booted simulator
    const xcrunCommand = `xcrun simctl io booted screenshot "${screenshotPath}"`;
    await execAsync(xcrunCommand);
    
    // Verify the file exists and has content
    const stats = await fs.stat(screenshotPath);
    if (stats.size === 0) {
      throw new Error('Screenshot file is empty');
    }
    
    // Read the file and convert to base64
    const screenshotData = await fs.readFile(screenshotPath);
    const base64Data = screenshotData.toString('base64');
    
    logger.info(`Screenshot saved to ${screenshotPath}`);
    
    return `data:image/png;base64,${base64Data}`;
  } catch (error) {
    logger.error(`Error taking iOS simulator screenshot: ${error}`);
    return null;
  }
}

/**
 * Take a screenshot of a physical Android device
 */
export async function takeAndroidPhysicalDeviceScreenshot(deviceId: string): Promise<string | null> {
  try {
    logger.info(`Taking screenshot from Android device ${deviceId}`);
    
    // Ensure screenshot directory exists
    const screenshotDir = getScreenshotDir();
    await fs.mkdir(screenshotDir, { recursive: true });
    
    // Generate a unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `flutter_screenshot_${timestamp}.png`;
    const screenshotPath = path.join(screenshotDir, filename);
    
    // First, capture to the device
    const devicePath = '/sdcard/screenshot.png';
    await execAsync(`adb -s ${deviceId} shell screencap -p ${devicePath}`);
    
    // Then pull the file from the device
    await execAsync(`adb -s ${deviceId} pull ${devicePath} "${screenshotPath}"`);
    
    // Clean up the file on the device
    await execAsync(`adb -s ${deviceId} shell rm ${devicePath}`);
    
    // Verify the file exists and has content
    const stats = await fs.stat(screenshotPath);
    if (stats.size === 0) {
      throw new Error('Screenshot file is empty');
    }
    
    // Read the file and convert to base64
    const screenshotData = await fs.readFile(screenshotPath);
    const base64Data = screenshotData.toString('base64');
    
    logger.info(`Screenshot saved to ${screenshotPath}`);
    
    return `data:image/png;base64,${base64Data}`;
  } catch (error) {
    logger.error(`Error taking Android device screenshot: ${error}`);
    return null;
  }
} 