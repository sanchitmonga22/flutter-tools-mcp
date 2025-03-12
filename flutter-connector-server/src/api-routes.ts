/**
 * API Routes for Flutter Connector Server
 * 
 * This module sets up the REST API routes for the Flutter Connector Server
 */

import express, { Request, Response, Router } from 'express';
import { getAppInstance, getAppInstances, startFlutterApp, stopFlutterApp, addAppLog, updatePerformanceMetrics } from './app-manager';
import { takeAndroidEmulatorScreenshot, takeIOSSimulatorScreenshot, takeAndroidPhysicalDeviceScreenshot } from './screenshot-util';
import { logger } from './utils/logger';

export interface SetupApiRoutesOptions {
  broadcastMessage: (message: any) => void;
}

/**
 * Set up API routes for the Flutter Connector Server
 */
export function setupApiRoutes(app: express.Application, options: SetupApiRoutesOptions): void {
  const { broadcastMessage } = options;
  const router = express.Router();
  
  // GET /api/apps - List all apps
  router.get('/apps', async (req: Request, res: Response) => {
    try {
      const apps = getAppInstances();
      res.json({ apps });
    } catch (error) {
      logger.error('Error getting app instances:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // GET /api/apps/:id - Get app details
  router.get('/apps/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const app = await getAppInstance(id);
      
      if (!app) {
        return res.status(404).json({ error: `App with ID ${id} not found` });
      }
      
      res.json({ app });
    } catch (error) {
      logger.error(`Error getting app ${req.params.id}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // POST /api/apps - Start a new app
  router.post('/apps', async (req: Request, res: Response) => {
    try {
      const { projectPath, deviceId } = req.body;
      
      if (!projectPath) {
        return res.status(400).json({ error: 'Project path is required' });
      }
      
      const app = await startFlutterApp(projectPath, deviceId);
      
      // Broadcast that a new app was started
      broadcastMessage({
        type: 'app-started',
        appId: app.id,
      });
      
      res.status(201).json({ app });
    } catch (error) {
      logger.error('Error starting app:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // DELETE /api/apps/:id - Stop an app
  router.delete('/apps/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await stopFlutterApp(id);
      
      if (!success) {
        return res.status(404).json({ error: `App with ID ${id} not found or already stopped` });
      }
      
      // Broadcast that an app was stopped
      broadcastMessage({
        type: 'app-stopped',
        appId: id,
      });
      
      res.json({ success });
    } catch (error) {
      logger.error(`Error stopping app ${req.params.id}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // GET /api/apps/:id/logs - Get app logs
  router.get('/apps/:id/logs', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const app = await getAppInstance(id);
      
      if (!app) {
        return res.status(404).json({ error: `App with ID ${id} not found` });
      }
      
      // Optional query parameters
      const limit = parseInt(req.query.limit as string) || 100;
      const filter = req.query.filter as string;
      
      // Get logs, filter if needed, and take the limit
      let logs = app.logs;
      
      if (filter) {
        logs = logs.filter(log => log.includes(filter));
      }
      
      logs = logs.slice(-Math.min(logs.length, limit));
      
      res.json({ logs });
    } catch (error) {
      logger.error(`Error getting logs for app ${req.params.id}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // POST /api/apps/:id/logs - Add a log entry
  router.post('/apps/:id/logs', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { log } = req.body;
      
      if (!log) {
        return res.status(400).json({ error: 'Log entry is required' });
      }
      
      const success = await addAppLog(id, log);
      
      if (!success) {
        return res.status(404).json({ error: `App with ID ${id} not found` });
      }
      
      res.json({ success });
    } catch (error) {
      logger.error(`Error adding log for app ${req.params.id}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // GET /api/apps/:id/performance - Get performance data
  router.get('/apps/:id/performance', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const app = await getAppInstance(id);
      
      if (!app) {
        return res.status(404).json({ error: `App with ID ${id} not found` });
      }
      
      res.json({ performanceData: app.performanceData });
    } catch (error) {
      logger.error(`Error getting performance data for app ${req.params.id}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // POST /api/apps/:id/performance - Update performance metrics
  router.post('/apps/:id/performance', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { metrics } = req.body;
      
      if (!metrics || typeof metrics !== 'object') {
        return res.status(400).json({ error: 'Metrics object is required' });
      }
      
      const success = await updatePerformanceMetrics(id, metrics);
      
      if (!success) {
        return res.status(404).json({ error: `App with ID ${id} not found` });
      }
      
      res.json({ success });
    } catch (error) {
      logger.error(`Error updating performance metrics for app ${req.params.id}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // POST /api/apps/:id/hot-reload - Trigger hot reload
  router.post('/apps/:id/hot-reload', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const app = await getAppInstance(id);
      
      if (!app) {
        return res.status(404).json({ error: `App with ID ${id} not found` });
      }
      
      if (app.status !== 'running') {
        return res.status(400).json({ error: `App with ID ${id} is not running (status: ${app.status})` });
      }
      
      // Trigger hot reload - different methods
      let reloadSuccess = false;
      let errorMessage = '';
      
      // Method 1: Use process stdin if available
      if (app.process && app.process.stdin) {
        try {
          logger.info(`Triggering hot reload via process stdin for app ID ${id}`);
          app.process.stdin.write('r\n');
          
          // Add to logs
          await addAppLog(id, '[INFO] Hot reload triggered via stdin');
          
          reloadSuccess = true;
        } catch (error) {
          logger.error(`Error triggering hot reload via stdin:`, error);
          errorMessage = error instanceof Error ? error.message : String(error);
        }
      }
      
      // Method 2: Use VM service URL if available and stdin failed
      if (!reloadSuccess && app.vmServiceUrl) {
        try {
          logger.info(`Triggering hot reload via VM service for app ID ${id}`);
          
          // For simplicity, we're using the Node.js http module directly
          // In a real implementation, you might want to use a dedicated
          // Dart VM Service client library
          const result = await fetch(`${app.vmServiceUrl}/hot-reload`, {
            method: 'POST',
          });
          
          if (result.ok) {
            // Add to logs
            await addAppLog(id, '[INFO] Hot reload triggered via VM service');
            reloadSuccess = true;
          } else {
            throw new Error(`VM service returned status ${result.status}`);
          }
        } catch (error) {
          logger.error(`Error triggering hot reload via VM service:`, error);
          errorMessage = `${errorMessage}\nVM service error: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      
      if (reloadSuccess) {
        // Broadcast that a hot reload was triggered
        broadcastMessage({
          type: 'hot-reload',
          appId: id,
        });
        
        res.json({ success: true });
      } else {
        res.status(500).json({
          error: `Cannot trigger hot reload: process not available or VM service not accessible.\n${errorMessage}`,
        });
      }
    } catch (error) {
      logger.error(`Error triggering hot reload for app ${req.params.id}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // POST /api/screenshot/:id - Take screenshot
  router.post('/screenshot/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const app = await getAppInstance(id);
      
      if (!app) {
        return res.status(404).json({ error: `App with ID ${id} not found` });
      }
      
      if (app.status !== 'running') {
        return res.status(400).json({ error: `App with ID ${id} is not running (status: ${app.status})` });
      }
      
      // Platform-specific screenshot implementation
      const deviceId = app.deviceId;
      let screenshotData: string | null = null;
      
      if (deviceId.includes('emulator-') || deviceId.includes('emulator:')) {
        // Android emulator
        screenshotData = await takeAndroidEmulatorScreenshot(deviceId);
      } else if (
        deviceId.includes('simulator-') || 
        deviceId === 'default' ||
        // Match iOS simulator UUID pattern
        /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(deviceId)
      ) {
        // iOS simulator
        screenshotData = await takeIOSSimulatorScreenshot();
      } else {
        // Try a general adb method for physical devices
        screenshotData = await takeAndroidPhysicalDeviceScreenshot(deviceId);
      }
      
      if (!screenshotData) {
        return res.status(500).json({ error: `Failed to take screenshot for app with ID ${id}` });
      }
      
      // Broadcast that a screenshot was taken
      broadcastMessage({
        type: 'screenshot',
        appId: id,
        timestamp: Date.now(),
      });
      
      res.json({
        success: true,
        data: screenshotData,
      });
    } catch (error) {
      logger.error(`Error taking screenshot for app ${req.params.id}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Mount router at /api
  app.use('/api', router);
} 