import { FlutterApp } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { FlutterVmServiceClient } from './vm-service-client.js';
import { v4 as uuidv4 } from 'uuid';
import { Socket } from 'net';
import { EventEmitter } from 'events';

/**
 * Service for discovering running Flutter applications
 */
export class AppDiscoveryService extends EventEmitter {
  private knownApps: Map<string, FlutterApp> = new Map();
  private discoveryInterval: NodeJS.Timeout | null = null;
  private isDiscovering = false;
  private portRangeStart: number;
  private portRangeEnd: number;
  private discoveryIntervalMs: number;

  /**
   * Create a new app discovery service
   * @param options Configuration options
   */
  constructor({
    portRangeStart = 8000,
    portRangeEnd = 9000,
    discoveryIntervalMs = 5000
  } = {}) {
    super();
    this.portRangeStart = portRangeStart;
    this.portRangeEnd = portRangeEnd;
    this.discoveryIntervalMs = discoveryIntervalMs;
  }

  /**
   * Start discovering Flutter apps
   */
  public startDiscovery(): void {
    if (this.discoveryInterval) {
      return;
    }

    logger.info('Starting Flutter app discovery service');
    this.discover();

    this.discoveryInterval = setInterval(() => {
      this.discover();
    }, this.discoveryIntervalMs);
  }

  /**
   * Stop discovering Flutter apps
   */
  public stopDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
      logger.info('Stopped Flutter app discovery service');
    }
  }

  /**
   * Get all known Flutter apps
   */
  public getApps(): FlutterApp[] {
    return Array.from(this.knownApps.values());
  }

  /**
   * Get a specific Flutter app by ID
   * @param id The ID of the app to get
   */
  public getApp(id: string): FlutterApp | undefined {
    return this.knownApps.get(id);
  }

  /**
   * Manually add a Flutter app to the known apps
   * @param port The port where the VM service is running
   * @param hostname The hostname of the VM service
   * @param deviceType The type of device (android, ios, web, etc.)
   * @param authToken Optional authentication token for the VM service
   */
  public async addApp(
    port: number, 
    hostname: string = '127.0.0.1', 
    deviceType: string = 'custom',
    authToken?: string
  ): Promise<FlutterApp | null> {
    try {
      const client = new FlutterVmServiceClient(port, hostname, authToken);
      await client.connect();
      
      const vm = await client.getVM();
      const name = vm.name || `Flutter App on port ${port}`;
      
      const id = uuidv4();
      const app: FlutterApp = {
        id,
        name,
        port,
        deviceType,
        startTime: new Date().toISOString(),
        authToken,
      };
      
      this.knownApps.set(id, app);
      await client.disconnect();
      
      logger.info(`Manually added Flutter app: ${name} (${id})`);
      this.emit('app-discovered', app);
      
      return app;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to manually add Flutter app on port ${port}: ${errorMessage}`);
      
      // If no auth token was provided and we got a 403, try to extract the token from the error
      if (!authToken && errorMessage.includes('403')) {
        try {
          // Try with a different approach - attempt to connect to the HTTP endpoint first
          const authToken = await this.detectAuthToken(port, hostname);
          if (authToken) {
            logger.info(`Detected auth token for port ${port}: ${authToken}`);
            return this.addApp(port, hostname, deviceType, authToken);
          }
        } catch (tokenErr) {
          logger.error(`Failed to detect auth token: ${tokenErr instanceof Error ? tokenErr.message : String(tokenErr)}`);
        }
      }
      
      return null;
    }
  }

  /**
   * Try to detect the authentication token for a VM service
   * @param port The port to check
   * @param hostname The hostname
   */
  private async detectAuthToken(port: number, hostname: string = '127.0.0.1'): Promise<string | null> {
    // This is a simplified implementation - in a real-world scenario,
    // you might want to make an HTTP request to the VM service and
    // check for redirects or parse the response for token information
    
    // For now, we'll try a few common token patterns
    const possibleTokens = [
      '', // No token
      'hqyzYdQKcLg=', // The token you provided
      'ws' // Just in case the path is different
    ];
    
    for (const token of possibleTokens) {
      try {
        const client = new FlutterVmServiceClient(port, hostname, token);
        await client.connect();
        await client.getVM();
        await client.disconnect();
        return token; // If we get here, the token worked
      } catch (err) {
        // Try the next token
        continue;
      }
    }
    
    return null;
  }

  /**
   * Parse a VM service URL to extract port and auth token
   * @param vmServiceUrl The VM service URL (e.g., ws://127.0.0.1:55285/hqyzYdQKcLg=/ws)
   * @returns Object containing port and authToken, or null if parsing failed
   */
  public parseVmServiceUrl(vmServiceUrl: string): { port: number; authToken: string } | null {
    try {
      // Handle both ws:// and http:// URLs
      const url = new URL(vmServiceUrl);
      
      // Extract port
      const port = parseInt(url.port, 10);
      if (isNaN(port)) {
        logger.error(`Failed to parse port from VM service URL: ${vmServiceUrl}`);
        return null;
      }
      
      // Extract auth token from path
      // The path is typically in the format: /AUTH_TOKEN/ws or /AUTH_TOKEN/
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      const authToken = pathParts.length > 0 ? pathParts[0] : '';
      
      logger.debug(`Parsed VM service URL: port=${port}, authToken=${authToken}`);
      return { port, authToken };
    } catch (err) {
      logger.error(`Failed to parse VM service URL: ${vmServiceUrl}`, err);
      return null;
    }
  }

  /**
   * Add a Flutter app from a VM service URL
   * @param vmServiceUrl The VM service URL (e.g., ws://127.0.0.1:55285/hqyzYdQKcLg=/ws)
   * @param deviceType Optional device type
   * @returns The added Flutter app, or null if adding failed
   */
  public async addAppFromUrl(vmServiceUrl: string, deviceType: string = 'custom'): Promise<FlutterApp | null> {
    const parsedUrl = this.parseVmServiceUrl(vmServiceUrl);
    if (!parsedUrl) {
      return null;
    }
    
    const { port, authToken } = parsedUrl;
    return this.addApp(port, '127.0.0.1', deviceType, authToken);
  }

  /**
   * Run a scan for Flutter apps
   */
  private async discover(): Promise<void> {
    if (this.isDiscovering) {
      return;
    }

    this.isDiscovering = true;
    logger.debug('Scanning for Flutter apps...');

    try {
      // Scan port range for VM services
      const ports = await this.scanPorts();
      
      // Check each port for a VM service
      for (const port of ports) {
        try {
          const app = await this.checkVmService(port);
          if (app) {
            if (!this.knownApps.has(app.id)) {
              logger.info(`Discovered new Flutter app: ${app.name} (${app.id})`);
              this.knownApps.set(app.id, app);
              this.emit('app-discovered', app);
            }
          }
        } catch (err) {
          // Ignore connection errors
        }
      }
      
      // Check for disappeared apps, but don't remove apps with auth tokens
      // as they might not be detected by the port scan
      for (const [id, app] of this.knownApps.entries()) {
        // Skip apps with auth tokens - they were manually added and should be kept
        if (app.authToken) {
          continue;
        }
        
        if (!ports.includes(app.port)) {
          logger.info(`Flutter app disappeared: ${app.name} (${id})`);
          this.knownApps.delete(id);
          this.emit('app-disappeared', app);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error discovering Flutter apps:', errorMessage);
    } finally {
      this.isDiscovering = false;
    }
  }

  /**
   * Scan the port range for open ports
   */
  private async scanPorts(): Promise<number[]> {
    const openPorts: number[] = [];
    const promises: Promise<void>[] = [];

    for (let port = this.portRangeStart; port <= this.portRangeEnd; port++) {
      promises.push(
        this.checkPort(port)
          .then(isOpen => {
            if (isOpen) {
              openPorts.push(port);
            }
          })
          .catch(() => {})
      );
    }

    await Promise.all(promises);
    return openPorts;
  }

  /**
   * Check if a port is open
   * @param port The port to check
   */
  private checkPort(port: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const socket = new Socket();
      const timeout = 300;

      socket.setTimeout(timeout);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, '127.0.0.1');
    });
  }

  /**
   * Check if a port has a VM service
   * @param port The port to check
   */
  private async checkVmService(port: number): Promise<FlutterApp | null> {
    try {
      // First try without auth token
      let client = new FlutterVmServiceClient(port);
      try {
        await client.connect();
      } catch (err) {
        // If connection fails, try to detect auth token
        const authToken = await this.detectAuthToken(port);
        if (!authToken) {
          return null;
        }
        
        // Try again with the detected auth token
        client = new FlutterVmServiceClient(port, '127.0.0.1', authToken);
        await client.connect();
      }
      
      const vm = await client.getVM();
      if (!vm) {
        await client.disconnect();
        return null;
      }
      
      // Check if it's a Flutter app
      const isFlutter = vm.name?.includes('Flutter') || 
                         vm.isolates?.some((isolate: any) => 
                           isolate.name?.includes('Flutter') || 
                           isolate.name?.includes('DartifactApp'));
      
      if (!isFlutter) {
        await client.disconnect();
        return null;
      }
      
      const name = vm.name || `Flutter App on port ${port}`;
      const deviceType = this.detectDeviceType(vm);
      
      const appId = this.generateAppId(port, vm);
      
      // Create app info
      const app: FlutterApp = {
        id: appId,
        name,
        port,
        deviceType,
        startTime: new Date().toISOString(),
        authToken: client['authToken'], // Get the auth token that worked
      };
      
      await client.disconnect();
      return app;
    } catch (err) {
      return null;
    }
  }

  /**
   * Generate a unique app ID from a VM and port
   * @param port The port of the VM service
   * @param vm The VM information
   */
  private generateAppId(port: number, vm: any): string {
    // Try to create a stable ID based on package name or VM name
    if (vm.isolates && vm.isolates.length > 0) {
      const mainIsolate = vm.isolates[0];
      if (mainIsolate.rootLib && mainIsolate.rootLib.uri) {
        // Try to extract package name from the root library URI
        const match = mainIsolate.rootLib.uri.match(/package:([^\/]+)/);
        if (match && match[1]) {
          return `flutter-${match[1]}-${port}`;
        }
      }
    }
    // Fallback to a generated ID
    return `flutter-app-${port}`;
  }

  /**
   * Detect the device type from VM information
   * @param vm The VM information
   */
  private detectDeviceType(vm: any): string {
    const architecture = vm.architectureName || '';
    
    if (architecture.includes('android')) {
      return 'android';
    } else if (architecture.includes('ios')) {
      return 'ios';
    } else if (vm.operatingSystem && vm.operatingSystem.includes('web')) {
      return 'web';
    } else if (vm.operatingSystem && vm.operatingSystem.includes('fuchsia')) {
      return 'fuchsia';
    } else if (vm.operatingSystem && vm.operatingSystem.includes('android')) {
      return 'android';
    } else if (vm.operatingSystem && vm.operatingSystem.includes('ios')) {
      return 'ios';
    } else if (vm.operatingSystem && vm.operatingSystem.includes('macos')) {
      return 'macos';
    } else if (vm.operatingSystem && vm.operatingSystem.includes('windows')) {
      return 'windows';
    } else if (vm.operatingSystem && vm.operatingSystem.includes('linux')) {
      return 'linux';
    }
    
    return 'unknown';
  }
} 