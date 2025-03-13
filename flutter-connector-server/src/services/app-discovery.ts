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
   */
  public async addApp(port: number, hostname: string = 'localhost', deviceType: string = 'custom'): Promise<FlutterApp | null> {
    try {
      const client = new FlutterVmServiceClient(port, hostname);
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
      };
      
      this.knownApps.set(id, app);
      await client.disconnect();
      
      logger.info(`Manually added Flutter app: ${name} (${id})`);
      this.emit('app-discovered', app);
      
      return app;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to manually add Flutter app on port ${port}: ${errorMessage}`);
      return null;
    }
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
      
      // Check for disappeared apps
      for (const [id, app] of this.knownApps.entries()) {
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

      socket.connect(port, 'localhost');
    });
  }

  /**
   * Check if a port has a VM service
   * @param port The port to check
   */
  private async checkVmService(port: number): Promise<FlutterApp | null> {
    try {
      const client = new FlutterVmServiceClient(port);
      await client.connect();
      
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