import { AppDiscoveryService } from './services/app-discovery.js';
import { AppMonitorService } from './services/app-monitor.js';
import { RestServer } from './api/rest-server.js';
import { logger } from './utils/logger.js';
import { ServerConfig } from './types/index.js';

/**
 * Main entry point for the Flutter Connector Server
 */
class FlutterConnectorServer {
  private appDiscoveryService: AppDiscoveryService;
  private appMonitorService: AppMonitorService;
  private restServer: RestServer;
  private config: ServerConfig;

  /**
   * Create a new Flutter Connector Server
   * @param config Server configuration
   */
  constructor(config: Partial<ServerConfig> = {}) {
    // Apply defaults to config
    this.config = {
      port: process.env.PORT ? parseInt(process.env.PORT) : 5051,
      host: process.env.HOST || 'localhost',
      discoveryInterval: process.env.DISCOVERY_INTERVAL ? parseInt(process.env.DISCOVERY_INTERVAL) : 5000,
      maxLogEntries: process.env.MAX_LOG_ENTRIES ? parseInt(process.env.MAX_LOG_ENTRIES) : 1000,
      maxMetricsEntries: process.env.MAX_METRICS_ENTRIES ? parseInt(process.env.MAX_METRICS_ENTRIES) : 100,
      maxNetworkEntries: process.env.MAX_NETWORK_ENTRIES ? parseInt(process.env.MAX_NETWORK_ENTRIES) : 100,
      ...config
    };

    // Create services
    this.appDiscoveryService = new AppDiscoveryService({
      portRangeStart: 8000,
      portRangeEnd: 9000,
      discoveryIntervalMs: this.config.discoveryInterval
    });

    this.appMonitorService = new AppMonitorService({
      maxLogEntries: this.config.maxLogEntries,
      maxMetricsEntries: this.config.maxMetricsEntries,
      maxNetworkEntries: this.config.maxNetworkEntries
    });

    // Create REST server
    this.restServer = new RestServer(
      this.appDiscoveryService,
      this.appMonitorService,
      this.config
    );

    // Set up event listeners
    this.appDiscoveryService.on('app-discovered', (app) => {
      logger.info(`Flutter app discovered: ${app.name} (${app.id}) on port ${app.port}`);
    });

    this.appDiscoveryService.on('app-disappeared', (app) => {
      logger.info(`Flutter app disappeared: ${app.name} (${app.id})`);
      this.appMonitorService.stopMonitoring(app.id).catch((err) => {
        logger.error(`Error stopping monitoring for app ${app.id}: ${err.message}`);
      });
    });
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    logger.info('Starting Flutter Connector Server...');

    // Start app discovery
    this.appDiscoveryService.startDiscovery();
    logger.info('Flutter app discovery started');

    // Start REST server
    await this.restServer.start();
    logger.info('Flutter Connector Server started successfully');
  }

  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    logger.info('Stopping Flutter Connector Server...');

    // Stop app discovery
    this.appDiscoveryService.stopDiscovery();
    logger.info('Flutter app discovery stopped');

    // Stop all app monitoring
    await this.appMonitorService.stopAll();
    logger.info('All app monitoring stopped');

    // Stop REST server
    await this.restServer.stop();
    logger.info('Flutter Connector Server stopped');
  }
}

// Start the server if this file is run directly
if (process.env.NODE_ENV !== 'test') {
  const server = new FlutterConnectorServer();
  
  // Handle process termination gracefully
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal, shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal, shutting down...');
    await server.stop();
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection:', reason);
  });

  // Start the server
  server.start().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { FlutterConnectorServer }; 