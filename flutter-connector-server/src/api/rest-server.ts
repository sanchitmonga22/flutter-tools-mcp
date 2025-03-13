import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { ServerConfig, ConnectionStatus, FlutterAppInfo, HotReloadOptions } from '../types/index.js';
import { AppDiscoveryService } from '../services/app-discovery.js';
import { AppMonitorService } from '../services/app-monitor.js';
import { logger } from '../utils/logger.js';

/**
 * REST API server for the Flutter Connector
 */
export class RestServer {
  private app: express.Application;
  private server: any;
  private config: ServerConfig;

  /**
   * Create a new REST server
   * @param appDiscoveryService The app discovery service to use
   * @param appMonitorService The app monitor service to use
   * @param config Server configuration
   */
  constructor(
    private appDiscoveryService: AppDiscoveryService,
    private appMonitorService: AppMonitorService,
    config: Partial<ServerConfig> = {}
  ) {
    // Apply defaults to config
    this.config = {
      port: 5051,
      host: 'localhost',
      discoveryInterval: 5000,
      maxLogEntries: 1000,
      maxMetricsEntries: 100,
      maxNetworkEntries: 100,
      ...config
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Start the server
   */
  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        logger.info(`Flutter Connector Server listening on http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err: any) => {
        if (err) {
          reject(err);
        } else {
          logger.info('Flutter Connector Server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Configure middleware
   */
  private setupMiddleware(): void {
    // Enable CORS
    this.app.use(cors());

    // Parse JSON bodies
    this.app.use(bodyParser.json());

    // Request logging middleware
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });

    // Error handling middleware
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('API error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  /**
   * Configure API routes
   */
  private setupRoutes(): void {
    // Get server info
    this.app.get('/api/info', (req, res) => {
      res.json({
        version: '1.0.0',
        config: { ...this.config, host: undefined }, // Don't expose host in response
        uptime: process.uptime()
      });
    });

    // Get all apps
    this.app.get('/api/apps', (req, res) => {
      const apps = this.appDiscoveryService.getApps();
      const appInfos: FlutterAppInfo[] = apps.map(app => {
        const monitor = this.appMonitorService.getMonitor(app.id);
        const status = monitor ? monitor.getConnectionStatus() : ConnectionStatus.DISCONNECTED;
        
        return {
          id: app.id,
          name: app.name,
          deviceType: app.deviceType,
          startTime: app.startTime,
          status,
          port: app.port,
          pid: app.pid,
          packageName: app.packageName,
          authToken: app.authToken
        };
      });
      
      res.json(appInfos);
    });

    // Get specific app info
    this.app.get('/api/apps/:id', (req, res) => {
      const app = this.appDiscoveryService.getApp(req.params.id);
      if (!app) {
        res.status(404).json({ error: 'App not found' });
        return;
      }

      const monitor = this.appMonitorService.getMonitor(app.id);
      const status = monitor ? monitor.getConnectionStatus() : ConnectionStatus.DISCONNECTED;
      
      const appInfo: FlutterAppInfo = {
        id: app.id,
        name: app.name,
        deviceType: app.deviceType,
        startTime: app.startTime,
        status,
        port: app.port,
        pid: app.pid,
        packageName: app.packageName,
        authToken: app.authToken
      };
      
      res.json(appInfo);
    });

    // Manually add an app
    this.app.post('/api/apps', async (req, res) => {
      try {
        const { port, hostname, deviceType, authToken } = req.body;
        if (!port) {
          res.status(400).json({ error: 'Port is required' });
          return;
        }

        const app = await this.appDiscoveryService.addApp(port, hostname, deviceType, authToken);
        if (!app) {
          res.status(404).json({ error: 'Could not connect to Flutter app at the specified port' });
          return;
        }

        res.status(201).json({
          id: app.id,
          name: app.name,
          deviceType: app.deviceType,
          startTime: app.startTime,
          status: ConnectionStatus.DISCONNECTED,
          port: app.port,
          authToken: app.authToken
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error adding app: ${errorMessage}`);
        res.status(500).json({ error: errorMessage });
      }
    });

    // Add an app by VM service URL
    this.app.post('/api/apps/from-url', async (req, res) => {
      try {
        const { vmServiceUrl, deviceType } = req.body;
        if (!vmServiceUrl) {
          res.status(400).json({ error: 'VM service URL is required' });
          return;
        }

        const app = await this.appDiscoveryService.addAppFromUrl(vmServiceUrl, deviceType);
        if (!app) {
          res.status(404).json({ error: 'Could not connect to Flutter app at the specified URL' });
          return;
        }

        res.status(201).json({
          id: app.id,
          name: app.name,
          deviceType: app.deviceType,
          startTime: app.startTime,
          status: ConnectionStatus.DISCONNECTED,
          port: app.port,
          authToken: app.authToken
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error adding app from URL: ${errorMessage}`);
        res.status(500).json({ error: errorMessage });
      }
    });

    // Start monitoring an app
    this.app.post('/api/apps/:id/monitor', async (req, res) => {
      try {
        const app = this.appDiscoveryService.getApp(req.params.id);
        if (!app) {
          res.status(404).json({ error: 'App not found' });
          return;
        }

        await this.appMonitorService.startMonitoring(app);
        res.status(200).json({ success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error starting monitoring: ${errorMessage}`);
        res.status(500).json({ error: errorMessage });
      }
    });

    // Stop monitoring an app
    this.app.post('/api/apps/:id/stop', async (req, res) => {
      try {
        await this.appMonitorService.stopMonitoring(req.params.id);
        res.status(200).json({ success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error stopping monitoring: ${errorMessage}`);
        res.status(500).json({ error: errorMessage });
      }
    });

    // Get logs for an app
    this.app.get('/api/apps/:id/logs', (req, res) => {
      const monitor = this.appMonitorService.getMonitor(req.params.id);
      if (!monitor) {
        res.status(404).json({ error: 'App monitor not found' });
        return;
      }

      const logs = monitor.getLogs();
      res.json(logs);
    });

    // Clear logs for an app
    this.app.delete('/api/apps/:id/logs', (req, res) => {
      const monitor = this.appMonitorService.getMonitor(req.params.id);
      if (!monitor) {
        res.status(404).json({ error: 'App monitor not found' });
        return;
      }

      monitor.clearData();
      res.status(200).json({ success: true });
    });

    // Get metrics for an app
    this.app.get('/api/apps/:id/metrics', (req, res) => {
      const monitor = this.appMonitorService.getMonitor(req.params.id);
      if (!monitor) {
        res.status(404).json({ error: 'App monitor not found' });
        return;
      }

      const metrics = monitor.getMetrics();
      res.json(metrics);
    });

    // Get network requests for an app
    this.app.get('/api/apps/:id/network', (req, res) => {
      const monitor = this.appMonitorService.getMonitor(req.params.id);
      if (!monitor) {
        res.status(404).json({ error: 'App monitor not found' });
        return;
      }

      const requests = monitor.getNetworkRequests();
      res.json(requests);
    });

    // Hot reload an app
    this.app.post('/api/apps/:id/hot-reload', async (req, res) => {
      try {
        const monitor = this.appMonitorService.getMonitor(req.params.id);
        if (!monitor) {
          res.status(404).json({ error: 'App monitor not found' });
          return;
        }

        const options: HotReloadOptions = req.body || {};
        await monitor.hotReload(options.fullRestart);
        res.status(200).json({ success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error triggering hot reload: ${errorMessage}`);
        res.status(500).json({ error: errorMessage });
      }
    });

    // Capture a screenshot of an app
    this.app.get('/api/apps/:id/screenshot', async (req, res) => {
      try {
        const monitor = this.appMonitorService.getMonitor(req.params.id);
        if (!monitor) {
          res.status(404).json({ error: 'App monitor not found' });
          return;
        }

        const screenshot = await monitor.captureScreenshot();
        
        // The screenshot is a base64 encoded image
        res.set('Content-Type', 'image/png');
        const buffer = Buffer.from(screenshot, 'base64');
        res.send(buffer);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error capturing screenshot: ${errorMessage}`);
        res.status(500).json({ error: errorMessage });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });
  }
} 