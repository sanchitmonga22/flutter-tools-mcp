// Helper functions for screenshot functionality

import { spawn, exec } from "child_process";
import { logger } from "../utils/logger.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { promisify } from "util";

const execAsync = promisify(exec);

// Get user's Downloads folder
function getDownloadsPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, 'Downloads');
}

// Generate a unique filename for the screenshot
function generateScreenshotFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `flutter_screenshot_${timestamp}.png`;
}

// Copy image to clipboard based on platform
async function copyImageToClipboard(imagePath: string): Promise<boolean> {
  try {
    const platform = process.platform;
    
    if (platform === 'darwin') {
      // macOS
      await execAsync(`osascript -e 'set the clipboard to (read (POSIX file "${imagePath}") as TIFF picture)'`);
      logger.info('Screenshot copied to clipboard (macOS)');
      return true;
    } else if (platform === 'win32') {
      // Windows - requires PowerShell
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $img = [System.Drawing.Image]::FromFile('${imagePath.replace(/\\/g, '\\\\')}')
        [System.Windows.Forms.Clipboard]::SetImage($img)
      `;
      await execAsync(`powershell -command "${psScript}"`);
      logger.info('Screenshot copied to clipboard (Windows)');
      return true;
    } else if (platform === 'linux') {
      // Linux - requires xclip
      await execAsync(`xclip -selection clipboard -t image/png -i "${imagePath}"`);
      logger.info('Screenshot copied to clipboard (Linux)');
      return true;
    } else {
      logger.warn(`Clipboard copy not supported on platform: ${platform}`);
      return false;
    }
  } catch (error) {
    logger.error(`Failed to copy image to clipboard: ${error}`);
    return false;
  }
}

export async function takeAndroidEmulatorScreenshot(deviceId: string): Promise<string | null> {
    try {
      const downloadsPath = getDownloadsPath();
      const filename = generateScreenshotFilename();
      const savePath = path.join(downloadsPath, filename);
      
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
      
      // Combine chunks and save to file
      const buffer = Buffer.concat(chunks);
      await fs.writeFile(savePath, buffer);
      logger.info(`Screenshot saved to: ${savePath}`);
      
      // Try to copy to clipboard
      await copyImageToClipboard(savePath);
      
      // Also return as base64 for clients that support it
      return buffer.toString('base64');
    } catch (error) {
      logger.error('Error taking Android screenshot:', error);
      return null;
    }
  }
  
export async function takeIOSSimulatorScreenshot(): Promise<string | null> {
    try {
      const downloadsPath = getDownloadsPath();
      const filename = generateScreenshotFilename();
      const savePath = path.join(downloadsPath, filename);
      
      // Execute xcrun simctl to take screenshot
      const xcrunProcess = spawn('xcrun', ['simctl', 'io', 'booted', 'screenshot', savePath], { stdio: 'pipe' });
      
      // Wait for process to finish
      const exitCode = await new Promise(resolve => {
        xcrunProcess.on('close', resolve);
      });
      
      if (exitCode !== 0) {
        logger.error(`Screenshot process exited with code ${exitCode}`);
        return null;
      }
      
      // Read the file for base64 conversion
      const fileData = await fs.readFile(savePath);
      logger.info(`Screenshot saved to: ${savePath}`);
      
      // Try to copy to clipboard
      await copyImageToClipboard(savePath);
      
      // Return base64 for clients that support it
      return fileData.toString('base64');
    } catch (error) {
      logger.error('Error taking iOS screenshot:', error);
      return null;
    }
  }
  
export async function takeAndroidPhysicalDeviceScreenshot(deviceId: string): Promise<string | null> {
    try {
      const downloadsPath = getDownloadsPath();
      const filename = generateScreenshotFilename();
      const savePath = path.join(downloadsPath, filename);
      const deviceTempPath = `/sdcard/temp_${filename}`;
      
      // Take screenshot on device
      let adbProcess = spawn('adb', ['-s', deviceId, 'shell', 'screencap', '-p', deviceTempPath], { stdio: 'pipe' });
      let exitCode = await new Promise(resolve => {
        adbProcess.on('close', resolve);
      });
      
      if (exitCode !== 0) {
        logger.error(`Screenshot process exited with code ${exitCode}`);
        return null;
      }
      
      // Pull file from device to downloads folder
      adbProcess = spawn('adb', ['-s', deviceId, 'pull', deviceTempPath, savePath], { stdio: 'pipe' });
      exitCode = await new Promise(resolve => {
        adbProcess.on('close', resolve);
      });
      
      if (exitCode !== 0) {
        logger.error(`File pull process exited with code ${exitCode}`);
        return null;
      }
      
      // Remove temp file from device
      adbProcess = spawn('adb', ['-s', deviceId, 'shell', 'rm', deviceTempPath], { stdio: 'pipe' });
      
      // Read the file for base64 conversion
      const fileData = await fs.readFile(savePath);
      logger.info(`Screenshot saved to: ${savePath}`);
      
      // Try to copy to clipboard
      await copyImageToClipboard(savePath);
      
      // Return base64 for clients that support it
      return fileData.toString('base64');
    } catch (error) {
      logger.error('Error taking Android physical device screenshot:', error);
      return null;
    }
  } 