import axios, { AxiosInstance } from 'axios';
import { FlutterAppInfo, LogEntry, PerformanceMetrics, NetworkRequest, ConnectorInfo, HotReloadOptions } from '../types/index.js';

/**
 * Client for communicating with the Flutter Connector Server
 */
export class ConnectorClient {
  private client: AxiosInstance;
  private isConnected = false;
  private baseUrl: string;

  /**
   * Create a new connector client
   * @param baseUrl The base URL of the Flutter Connector Server
   */
  constructor(baseUrl: string = 'http://localhost:5051') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000
    });
  }

  /**
   * Check if the connector server is available
   */
  public async checkConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      this.isConnected = response.status === 200;
      return this.isConnected;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Get information about the connector server
   */
  public async getInfo(): Promise<ConnectorInfo> {
    try {
      const response = await this.client.get('/api/info');
      return response.data;
    } catch (error) {
      this.handleError('Error getting connector info', error);
      throw error;
    }
  }

  /**
   * Get all discovered Flutter apps
   */
  public async getApps(): Promise<FlutterAppInfo[]> {
    try {
      const response = await this.client.get('/api/apps');
      return response.data;
    } catch (error) {
      this.handleError('Failed to get apps', error);
      return [];
    }
  }

  /**
   * Get a specific Flutter app by ID
   * @param appId The ID of the Flutter app
   */
  public async getApp(appId: string): Promise<FlutterAppInfo | null> {
    try {
      const response = await this.client.get(`/api/apps/${appId}`);
      return response.data;
    } catch (error) {
      this.handleError(`Failed to get app ${appId}`, error);
      return null;
    }
  }

  /**
   * Manually add a Flutter app to the connector
   * @param port The port where the VM service is running
   * @param hostname The hostname of the VM service
   * @param deviceType The type of device
   */
  public async addApp(port: number, hostname?: string, deviceType?: string): Promise<FlutterAppInfo | null> {
    try {
      const response = await this.client.post('/api/apps', {
        port,
        hostname,
        deviceType
      });
      return response.data;
    } catch (error) {
      this.handleError(`Error adding Flutter app on port ${port}`, error);
      return null;
    }
  }

  /**
   * Start monitoring a Flutter app
   * @param appId The ID of the app
   */
  public async startMonitoring(appId: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/api/apps/${appId}/monitor`);
      return response.data.success === true;
    } catch (error) {
      this.handleError(`Error starting monitoring for app ${appId}`, error);
      return false;
    }
  }

  /**
   * Stop monitoring a Flutter app
   * @param appId The ID of the app
   */
  public async stopMonitoring(appId: string): Promise<boolean> {
    try {
      const response = await this.client.post(`/api/apps/${appId}/stop`);
      return response.data.success === true;
    } catch (error) {
      this.handleError(`Error stopping monitoring for app ${appId}`, error);
      return false;
    }
  }

  /**
   * Get logs from a Flutter app
   * @param appId The ID of the Flutter app
   * @param lines Number of log lines to retrieve (optional)
   */
  public async getLogs(appId: string, lines?: number): Promise<string[]> {
    try {
      const params = lines ? { lines } : {};
      const response = await this.client.get(`/api/apps/${appId}/logs`, { params });
      return response.data;
    } catch (error) {
      this.handleError(`Failed to get logs for app ${appId}`, error);
      return [];
    }
  }

  /**
   * Clear logs for a Flutter app
   * @param appId The ID of the app
   */
  public async clearLogs(appId: string): Promise<boolean> {
    try {
      const response = await this.client.delete(`/api/apps/${appId}/logs`);
      return response.data.success === true;
    } catch (error) {
      this.handleError(`Error clearing logs for app ${appId}`, error);
      return false;
    }
  }

  /**
   * Get performance metrics from a Flutter app
   * @param appId The ID of the Flutter app
   * @param metric Specific metric to retrieve (optional)
   */
  public async getMetrics(appId: string, metric?: string): Promise<any[]> {
    try {
      const params = metric ? { metric } : {};
      const response = await this.client.get(`/api/apps/${appId}/metrics`, { params });
      return response.data;
    } catch (error) {
      this.handleError(`Failed to get metrics for app ${appId}`, error);
      return [];
    }
  }

  /**
   * Get network requests from a Flutter app
   * @param appId The ID of the Flutter app
   * @param count Number of recent network requests to retrieve (optional)
   */
  public async getNetworkRequests(appId: string, count?: number): Promise<NetworkRequest[]> {
    try {
      const params = count ? { count } : {};
      const response = await this.client.get(`/api/apps/${appId}/network`, { params });
      return response.data;
    } catch (error) {
      this.handleError(`Failed to get network requests for app ${appId}`, error);
      return [];
    }
  }

  /**
   * Trigger a hot reload of a Flutter app
   * @param appId The ID of the app
   * @param options The hot reload options
   */
  public async hotReload(appId: string, options: HotReloadOptions = {}): Promise<boolean> {
    try {
      const response = await this.client.post(`/api/apps/${appId}/hot-reload`, options);
      return response.data.success === true;
    } catch (error) {
      this.handleError(`Error triggering hot reload for app ${appId}`, error);
      return false;
    }
  }

  /**
   * Take a screenshot of a Flutter app
   * @param appId The ID of the Flutter app
   */
  public async takeScreenshot(appId: string): Promise<string | null> {
    try {
      const response = await this.client.get(`/api/apps/${appId}/screenshot`);
      return response.data.screenshot;
    } catch (error) {
      this.handleError(`Failed to take screenshot for app ${appId}`, error);
      return null;
    }
  }

  /**
   * Get the widget tree of a Flutter app
   * @param appId The ID of the Flutter app
   */
  public async getWidgetTree(appId: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/api/apps/${appId}/widget-tree`);
      return response.data;
    } catch (error) {
      this.handleError(`Failed to get widget tree for app ${appId}`, error);
      return null;
    }
  }

  /**
   * Run a performance analysis on a Flutter app
   * @param appId The ID of the Flutter app
   * @param duration Duration of the analysis in seconds (optional)
   */
  public async analyzePerformance(appId: string, duration?: number): Promise<any | null> {
    try {
      const params = duration ? { duration } : {};
      const response = await this.client.get(`/api/apps/${appId}/analyze`, { params });
      return response.data;
    } catch (error) {
      this.handleError(`Failed to analyze performance for app ${appId}`, error);
      return null;
    }
  }

  /**
   * Handle and log errors
   * @param message Error message prefix
   * @param error The error object
   */
  private handleError(message: string, error: unknown): void {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`${message}: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        console.error(`${message}: No response received`);
      } else {
        console.error(`${message}: ${error.message}`);
      }
    } else {
      console.error(`${message}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 