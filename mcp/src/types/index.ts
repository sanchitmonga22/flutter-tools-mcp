/**
 * Types for the Flutter Tools MCP Server
 */

/**
 * Configuration for the MCP server
 */
export interface MCPServerConfig {
  /** Server port to listen on */
  port: number;
  /** Host to bind to */
  host: string;
  /** URL of the Flutter Connector Server */
  connectorUrl: string;
  /** Polling interval for data updates (ms) */
  pollingInterval: number;
}

/**
 * Flutter app information from the Connector Server
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
  status: string;
  /** Port where the VM service is running */
  port: number;
  /** Process ID, if known */
  pid?: number;
  /** Package name or bundle identifier, if known */
  packageName?: string;
}

/**
 * Log entry from a Flutter app
 */
export interface LogEntry {
  /** Log level (info, warning, error, etc.) */
  level: string;
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
 * Represents a Flutter application
 */
export interface FlutterApp {
  /** Unique identifier for the app */
  id: string;
  /** The name of the app */
  name: string;
  /** The port where the VM service is running */
  port: number;
  /** The hostname of the VM service */
  hostname?: string;
  /** The type of device (android, ios, web, etc.) */
  deviceType: string;
  /** When the app was discovered */
  startTime: string;
}

/**
 * Performance metrics for a Flutter app
 */
export interface PerformanceMetrics {
  /** Memory usage in bytes */
  memoryUsage?: {
    /** Total heap size in bytes */
    heapSize: number;
    /** Used heap size in bytes */
    heapUsed: number;
    /** External memory usage in bytes */
    external: number;
  };
  /** CPU usage metrics */
  cpuUsage?: {
    /** CPU usage percentage (0-100) */
    percentage: number;
    /** Time spent in user code in milliseconds */
    userTime: number;
    /** Time spent in system code in milliseconds */
    systemTime: number;
  };
  /** UI metrics */
  uiMetrics?: {
    /** Frames per second */
    fps: number;
    /** Frame build time in milliseconds */
    frameBuildTime: number;
    /** Frame raster time in milliseconds */
    frameRasterTime: number;
    /** Total frame time in milliseconds */
    totalFrameTime: number;
  };
  /** Timestamp when the metrics were collected */
  timestamp: string;
}

/**
 * Network request information
 */
export interface NetworkRequest {
  /** Unique identifier for the request */
  id: string;
  /** The URL of the request */
  url: string;
  /** The HTTP method used (GET, POST, etc.) */
  method: string;
  /** HTTP status code of the response */
  statusCode?: number;
  /** Content type of the response */
  contentType?: string;
  /** Size of the request in bytes */
  requestSize?: number;
  /** Size of the response in bytes */
  responseSize?: number;
  /** Duration of the request in milliseconds */
  duration?: number;
  /** When the request was initiated */
  startTime: string;
  /** When the request completed */
  endTime?: string;
  /** Request headers */
  requestHeaders?: Record<string, string>;
  /** Response headers */
  responseHeaders?: Record<string, string>;
  /** Error message if the request failed */
  error?: string;
}

/**
 * Widget tree node
 */
export interface WidgetNode {
  /** The type of widget */
  type: string;
  /** Properties of the widget */
  properties: Record<string, unknown>;
  /** Child widgets */
  children?: WidgetNode[];
}

/**
 * Performance analysis result
 */
export interface PerformanceAnalysis {
  /** Overall score (0-100) */
  score: number;
  /** Duration of the analysis in seconds */
  duration: number;
  /** Memory trends */
  memoryTrend: PerformanceMetrics[];
  /** CPU trends */
  cpuTrend: PerformanceMetrics[];
  /** UI trends */
  uiTrend: PerformanceMetrics[];
  /** Issues detected */
  issues: {
    /** Severity of the issue (warning, error) */
    severity: string;
    /** Description of the issue */
    description: string;
    /** Recommendation to fix the issue */
    recommendation: string;
  }[];
  /** When the analysis was performed */
  timestamp: string;
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
 * Information about the Connector Server
 */
export interface ConnectorInfo {
  /** Connector server version */
  version: string;
  /** Connector server configuration */
  config: {
    port: number;
    discoveryInterval: number;
    maxLogEntries: number;
    maxMetricsEntries: number;
    maxNetworkEntries: number;
  };
  /** Connector server uptime in seconds */
  uptime: number;
} 