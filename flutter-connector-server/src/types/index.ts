/**
 * Types for the Flutter Connector Server
 */

/**
 * Server configuration options
 */
export interface ServerConfig {
  /** Server port to listen on */
  port: number;
  /** Host to bind to */
  host: string;
  /** How often to scan for new Flutter apps (ms) */
  discoveryInterval: number;
  /** Maximum number of log entries to keep per app */
  maxLogEntries: number;
  /** Maximum number of metrics entries to keep per app */
  maxMetricsEntries: number;
  /** Maximum number of network requests to keep per app */
  maxNetworkEntries: number;
}

/**
 * Information about a detected Flutter application
 */
export interface FlutterApp {
  /** Unique identifier for the app */
  id: string;
  /** Human-readable name of the app */
  name: string;
  /** Port where the VM service is running */
  port: number;
  /** Type of device (android, ios, web, etc.) */
  deviceType: string;
  /** When the app was first discovered */
  startTime: string;
  /** Process ID, if known */
  pid?: number;
  /** Package name or bundle identifier, if known */
  packageName?: string;
  /** Authentication token for VM service, if required */
  authToken?: string;
}

/**
 * Log entry from a Flutter app
 */
export interface LogEntry {
  /** Log level (info, warning, error, etc.) */
  level: 'info' | 'warning' | 'error' | 'debug' | string;
  /** Log message content */
  message: string;
  /** When the log was captured */
  timestamp: string;
  /** Optional source of the log */
  source?: string;
  /** Optional error details */
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Performance metrics from a Flutter app
 */
export interface PerformanceMetrics {
  /** Memory usage statistics */
  memory: {
    /** Current heap size in bytes */
    heapUsage: number;
    /** Maximum heap capacity in bytes */
    heapCapacity: number;
    /** External memory usage in bytes */
    externalUsage: number;
  };
  /** UI performance statistics, if available */
  ui?: {
    /** Current frame rate */
    fps?: number;
    /** Frame build times in milliseconds */
    buildTimes?: number[];
    /** Number of widget rebuilds */
    rebuildCount?: number;
  };
  /** When metrics were captured */
  timestamp: string;
}

/**
 * Network request information
 */
export interface NetworkRequest {
  /** Request URL */
  url: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** HTTP status code */
  status: number;
  /** Request headers */
  requestHeaders?: Record<string, string>;
  /** Response headers */
  responseHeaders?: Record<string, string>;
  /** Request body, if available */
  requestBody?: string;
  /** Response body, if available */
  responseBody?: string;
  /** Time when request was initiated */
  startTime: string;
  /** Time when response was received */
  endTime?: string;
  /** Total duration in milliseconds */
  duration?: number;
  /** Content size in bytes */
  contentSize?: number;
  /** Error information, if request failed */
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * VM Service client interface
 */
export interface VmServiceClient {
  /** Connect to the VM service */
  connect(): Promise<void>;
  /** Disconnect from the VM service */
  disconnect(): Promise<void>;
  /** Get VM information */
  getVM(): Promise<any>;
  /** Get isolate information */
  getIsolate(isolateId: string): Promise<any>;
  /** Get memory usage for an isolate */
  getMemoryUsage(isolateId: string): Promise<any>;
  /** Listen to a VM service stream */
  streamListen(streamId: string): Promise<void>;
  /** Call a VM service extension method */
  callExtensionMethod(method: string, params?: any): Promise<any>;
  /** Set callback for stream events */
  onEvent(streamId: string, callback: (event: any) => void): void;
}

/**
 * Status of a Flutter app connection
 */
export enum ConnectionStatus {
  CONNECTED = 'connected',
  CONNECTING = 'connecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

/**
 * Public info about a Flutter app to share via API
 */
export interface FlutterAppInfo {
  /** App ID */
  id: string;
  /** App name */
  name: string;
  /** Device type */
  deviceType: string;
  /** App start time */
  startTime: string;
  /** Connection status */
  status: ConnectionStatus;
  /** Port where the VM service is running */
  port: number;
  /** Process ID, if known */
  pid?: number;
  /** Package name or bundle identifier, if known */
  packageName?: string;
  /** Authentication token for VM service, if required */
  authToken?: string;
}

/**
 * Hot reload request options
 */
export interface HotReloadOptions {
  /** Whether to do a full restart instead of a hot reload */
  fullRestart?: boolean;
  /** Whether to pause after restart */
  pause?: boolean;
}

/**
 * Screenshot capture options
 */
export interface ScreenshotOptions {
  /** Maximum width of the screenshot */
  maxWidth?: number;
  /** Maximum height of the screenshot */
  maxHeight?: number;
  /** Quality of the screenshot (0-100) */
  quality?: number;
} 