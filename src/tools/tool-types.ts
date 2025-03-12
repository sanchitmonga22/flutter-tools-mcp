/**
 * Types for Flutter MCP tools
 */

import { ChildProcess } from 'child_process';

// Flutter app instance
export interface FlutterAppInstance {
  id: string;
  process: ChildProcess | null; // Node.js process
  projectPath: string;
  deviceId: string;
  vmServiceUrl?: string;
  logs: string[];
  status: 'starting' | 'running' | 'stopped' | 'error';
  error?: string;
  networkRequests: NetworkRequest[];
  performanceData: PerformanceData;
}

// Network request data
export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  requestTime: number;
  responseTime?: number;
  status?: number;
  contentType?: string;
  requestSize?: number;
  responseSize?: number;
  error?: string;
}

// Performance data
export interface PerformanceData {
  cpuUsage?: number;
  memoryUsage?: number;
  frameRate?: number;
  lastUpdated?: number;
  measurements: {
    timestamp: number;
    metric: string;
    value: number;
  }[];
} 