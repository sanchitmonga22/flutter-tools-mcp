import { EventEmitter } from 'events';
import { FlutterApp, LogEntry, PerformanceMetrics, NetworkRequest, ConnectionStatus, ScreenshotOptions } from '../types/index.js';
import { FlutterVmServiceClient } from './vm-service-client.js';
import { logger } from '../utils/logger.js';

/**
 * Manages monitoring and data collection for a single Flutter app
 */
export class FlutterAppMonitor extends EventEmitter {
  private client: FlutterVmServiceClient;
  private logs: LogEntry[] = [];
  private metrics: PerformanceMetrics[] = [];
  private networkRequests: NetworkRequest[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private isolateId: string | null = null;
  private maxLogEntries: number;
  private maxMetricsEntries: number;
  private maxNetworkEntries: number;

  /**
   * Create a new app monitor
   * @param app The Flutter app to monitor
   * @param options Configuration options
   */
  constructor(
    private app: FlutterApp,
    {
      maxLogEntries = 1000,
      maxMetricsEntries = 100,
      maxNetworkEntries = 100
    } = {}
  ) {
    super();
    this.client = new FlutterVmServiceClient(
      app.port, 
      '127.0.0.1', 
      app.authToken,
      this.handleDisconnect.bind(this)
    );
    this.maxLogEntries = maxLogEntries;
    this.maxMetricsEntries = maxMetricsEntries;
    this.maxNetworkEntries = maxNetworkEntries;
  }

  /**
   * Start monitoring the app
   */
  public async start(): Promise<void> {
    if (this.connectionStatus === ConnectionStatus.CONNECTED || 
        this.connectionStatus === ConnectionStatus.CONNECTING) {
      return;
    }

    this.setConnectionStatus(ConnectionStatus.CONNECTING);

    try {
      logger.info(`Connecting to Flutter app ${this.app.name} (${this.app.id}) on port ${this.app.port}`);
      await this.client.connect();
      
      // Get main isolate
      const vm = await this.client.getVM();
      if (!vm.isolates || vm.isolates.length === 0) {
        throw new Error('No isolates found in VM');
      }
      
      this.isolateId = vm.isolates[0].id;
      
      // Set up stream listeners
      await this.setupStreamListeners();
      
      // Start polling metrics
      this.startMetricsPolling();
      
      this.setConnectionStatus(ConnectionStatus.CONNECTED);
      logger.info(`Connected to Flutter app ${this.app.name} (${this.app.id})`);
      
      // Emit initial data
      this.emit('logs', this.logs);
      this.emit('metrics', this.metrics);
      this.emit('network-requests', this.networkRequests);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to connect to Flutter app ${this.app.name} (${this.app.id}): ${errorMessage}`);
      this.setConnectionStatus(ConnectionStatus.ERROR);
      throw error;
    }
  }

  /**
   * Stop monitoring the app
   */
  public async stop(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.connectionStatus === ConnectionStatus.CONNECTED) {
      try {
        await this.client.disconnect();
        logger.info(`Disconnected from Flutter app ${this.app.name} (${this.app.id})`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error disconnecting from Flutter app ${this.app.name} (${this.app.id}): ${errorMessage}`);
      }
    }

    this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
  }

  /**
   * Get the current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get all collected logs
   */
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get all collected metrics
   */
  public getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get all collected network requests
   */
  public getNetworkRequests(): NetworkRequest[] {
    return [...this.networkRequests];
  }

  /**
   * Clear all collected data
   */
  public clearData(): void {
    this.logs = [];
    this.metrics = [];
    this.networkRequests = [];
    
    this.emit('logs', this.logs);
    this.emit('metrics', this.metrics);
    this.emit('network-requests', this.networkRequests);
    
    logger.info(`Cleared data for Flutter app ${this.app.name} (${this.app.id})`);
  }

  /**
   * Trigger a hot reload of the app
   * @param fullRestart Whether to do a full restart
   */
  public async hotReload(fullRestart: boolean = false): Promise<void> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED || !this.isolateId) {
      throw new Error('Not connected to app');
    }

    try {
      await this.client.hotReload(this.isolateId, fullRestart);
      logger.info(`${fullRestart ? 'Hot restart' : 'Hot reload'} triggered for ${this.app.name} (${this.app.id})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to trigger ${fullRestart ? 'hot restart' : 'hot reload'}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Capture a screenshot of the app
   * @param options Screenshot options
   */
  public async captureScreenshot(options?: ScreenshotOptions): Promise<string> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Not connected to app');
    }

    try {
      // Call the screenshot extension method
      const screenshotData = await this.client.captureScreenshot();
      logger.info(`Screenshot captured for ${this.app.name} (${this.app.id})`);
      return screenshotData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to capture screenshot: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Set up stream listeners for logging and events
   */
  private async setupStreamListeners(): Promise<void> {
    // Listen to logging events
    await this.client.streamListen('Logging');
    this.client.onEvent('Logging', (event) => {
      this.handleLogEvent(event);
    });
    
    // Listen to debug events
    await this.client.streamListen('Debug');
    this.client.onEvent('Debug', (event) => {
      this.handleDebugEvent(event);
    });
    
    // Try to set up network profiling if available
    try {
      if (this.isolateId) {
        await this.client.callExtensionMethod('ext.flutter.inspector.enableNetworkTraffic', {});
        
        // Register a custom extension method callback
        this.client.onEvent('Extension', (event) => {
          if (event.extensionKind === 'Flutter.NetworkRequest') {
            this.handleNetworkEvent(event.extensionData);
          }
        });
      }
    } catch (error) {
      // Network profiling might not be available, that's ok
      logger.debug(`Network profiling not available: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start polling for performance metrics
   */
  private startMetricsPolling(): void {
    // Poll every 2 seconds
    this.pollingInterval = setInterval(async () => {
      try {
        if (this.connectionStatus === ConnectionStatus.CONNECTED && this.isolateId) {
          await this.collectPerformanceMetrics();
        }
      } catch (error) {
        logger.error(`Error collecting metrics: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, 2000);
  }

  /**
   * Collect performance metrics from the app
   */
  private async collectPerformanceMetrics(): Promise<void> {
    if (!this.isolateId) return;

    try {
      // Get memory usage
      const memoryData = await this.client.getMemoryUsage(this.isolateId);
      
      // Try to get UI metrics if available
      let uiMetrics = undefined;
      try {
        const performanceData = await this.client.callExtensionMethod('ext.flutter.inspector.getRenderFrameMetrics');
        if (performanceData) {
          uiMetrics = {
            fps: performanceData.fps,
            buildTimes: performanceData.buildTimes,
            rebuildCount: performanceData.rebuildCount
          };
        }
      } catch (error) {
        // UI metrics might not be available, that's ok
      }
      
      const metrics: PerformanceMetrics = {
        memory: {
          heapUsage: memoryData.heapUsage,
          heapCapacity: memoryData.heapCapacity,
          externalUsage: memoryData.externalUsage
        },
        ui: uiMetrics,
        timestamp: new Date().toISOString()
      };
      
      // Add metrics to list, maintaining the max size
      this.metrics.push(metrics);
      if (this.metrics.length > this.maxMetricsEntries) {
        this.metrics = this.metrics.slice(-this.maxMetricsEntries);
      }
      
      this.emit('metrics', this.metrics);
    } catch (error) {
      logger.error(`Error collecting performance metrics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle log events from the VM service
   * @param event The log event
   */
  private handleLogEvent(event: any): void {
    try {
      const logRecord = event.logRecord;
      if (!logRecord) return;
      
      // Map log level
      let level = 'info';
      if (logRecord.level) {
        const levelValue = parseInt(logRecord.level);
        if (levelValue >= 900) {
          level = 'error';
        } else if (levelValue >= 700) {
          level = 'warning';
        } else if (levelValue >= 500) {
          level = 'info';
        } else {
          level = 'debug';
        }
      }
      
      const logEntry: LogEntry = {
        level,
        message: logRecord.message || '',
        timestamp: new Date().toISOString(),
        source: logRecord.loggerName || 'flutter'
      };
      
      // Add error details if available
      if (logRecord.error) {
        logEntry.error = {
          message: logRecord.error,
          stack: logRecord.stackTrace
        };
      }
      
      // Add log to list, maintaining the max size
      this.logs.push(logEntry);
      if (this.logs.length > this.maxLogEntries) {
        this.logs = this.logs.slice(-this.maxLogEntries);
      }
      
      this.emit('log', logEntry);
      this.emit('logs', this.logs);
    } catch (error) {
      logger.error(`Error handling log event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle debug events from the VM service
   * @param event The debug event
   */
  private handleDebugEvent(event: any): void {
    // Handle debug events if needed
  }

  /**
   * Handle network events from the VM service
   * @param data The network event data
   */
  private handleNetworkEvent(data: any): void {
    try {
      if (!data || !data.url) return;
      
      const request: NetworkRequest = {
        url: data.url,
        method: data.method || 'GET',
        status: data.statusCode || 0,
        startTime: new Date(data.startTime || Date.now()).toISOString(),
        requestHeaders: data.requestHeaders,
        responseHeaders: data.responseHeaders,
        contentSize: data.contentLength,
      };
      
      // Calculate duration if both timestamps are available
      if (data.startTime && data.endTime) {
        request.endTime = new Date(data.endTime).toISOString();
        request.duration = data.endTime - data.startTime;
      }
      
      // Add error details if available
      if (data.error) {
        request.error = {
          message: data.error
        };
      }
      
      // Add request to list, maintaining the max size
      this.networkRequests.push(request);
      if (this.networkRequests.length > this.maxNetworkEntries) {
        this.networkRequests = this.networkRequests.slice(-this.maxNetworkEntries);
      }
      
      this.emit('network-request', request);
      this.emit('network-requests', this.networkRequests);
    } catch (error) {
      logger.error(`Error handling network event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle disconnection from the VM service
   */
  private handleDisconnect(): void {
    if (this.connectionStatus === ConnectionStatus.CONNECTED) {
      logger.warn(`Lost connection to Flutter app ${this.app.name} (${this.app.id})`);
      this.setConnectionStatus(ConnectionStatus.DISCONNECTED);
      
      // Try to reconnect
      setTimeout(() => {
        if (this.connectionStatus === ConnectionStatus.DISCONNECTED) {
          this.start().catch(() => {
            // Failed to reconnect, already logged
          });
        }
      }, 5000);
    }
  }

  /**
   * Set the connection status and emit an event
   * @param status The new connection status
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.emit('connection-status', status);
  }
}

/**
 * Service for monitoring multiple Flutter apps
 */
export class AppMonitorService {
  private monitors: Map<string, FlutterAppMonitor> = new Map();
  private maxLogEntries: number;
  private maxMetricsEntries: number;
  private maxNetworkEntries: number;

  /**
   * Create a new app monitor service
   * @param options Configuration options
   */
  constructor({
    maxLogEntries = 1000,
    maxMetricsEntries = 100,
    maxNetworkEntries = 100
  } = {}) {
    this.maxLogEntries = maxLogEntries;
    this.maxMetricsEntries = maxMetricsEntries;
    this.maxNetworkEntries = maxNetworkEntries;
  }

  /**
   * Start monitoring a Flutter app
   * @param app The app to monitor
   */
  public async startMonitoring(app: FlutterApp): Promise<void> {
    if (this.monitors.has(app.id)) {
      return;
    }

    const monitor = new FlutterAppMonitor(app, {
      maxLogEntries: this.maxLogEntries,
      maxMetricsEntries: this.maxMetricsEntries,
      maxNetworkEntries: this.maxNetworkEntries
    });

    try {
      await monitor.start();
      this.monitors.set(app.id, monitor);
      logger.info(`Started monitoring Flutter app ${app.name} (${app.id})`);
    } catch (error) {
      logger.error(`Failed to start monitoring Flutter app ${app.name} (${app.id}): ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Stop monitoring a Flutter app
   * @param appId The ID of the app to stop monitoring
   */
  public async stopMonitoring(appId: string): Promise<void> {
    const monitor = this.monitors.get(appId);
    if (!monitor) {
      return;
    }

    await monitor.stop();
    this.monitors.delete(appId);
    logger.info(`Stopped monitoring Flutter app with ID ${appId}`);
  }

  /**
   * Get the monitor for a specific app
   * @param appId The ID of the app
   */
  public getMonitor(appId: string): FlutterAppMonitor | undefined {
    return this.monitors.get(appId);
  }

  /**
   * Get all active monitors
   */
  public getMonitors(): Map<string, FlutterAppMonitor> {
    return new Map(this.monitors);
  }

  /**
   * Stop all monitoring
   */
  public async stopAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [appId, monitor] of this.monitors.entries()) {
      promises.push(monitor.stop());
      this.monitors.delete(appId);
    }
    await Promise.all(promises);
    logger.info('Stopped monitoring all Flutter apps');
  }
} 