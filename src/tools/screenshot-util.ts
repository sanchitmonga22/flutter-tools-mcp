// Helper functions for screenshot functionality

import { spawn } from "child_process";
import { logger } from "../utils/logger.js";
import fs from "fs/promises";

export async function takeAndroidEmulatorScreenshot(deviceId: string): Promise<string | null> {
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
  
export async function takeIOSSimulatorScreenshot(): Promise<string | null> {
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
  
export async function takeAndroidPhysicalDeviceScreenshot(deviceId: string): Promise<string | null> {
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