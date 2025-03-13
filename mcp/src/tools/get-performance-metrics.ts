import { ConnectorClient } from '../services/connector-client.js';
import { PerformanceMetrics } from '../types/index.js';

// Connector client instance
const connectorClient = new ConnectorClient();

/**
 * Format memory metrics for display
 */
function formatMemoryMetrics(metrics: PerformanceMetrics['memoryUsage']): string {
  if (!metrics) return 'No memory metrics available';
  
  const heapSizeMB = (metrics.heapSize / (1024 * 1024)).toFixed(2);
  const heapUsedMB = (metrics.heapUsed / (1024 * 1024)).toFixed(2);
  const externalMB = (metrics.external / (1024 * 1024)).toFixed(2);
  const usagePercentage = ((metrics.heapUsed / metrics.heapSize) * 100).toFixed(1);
  
  return `Memory Usage:\n` +
         `  Heap Size: ${heapSizeMB} MB\n` +
         `  Heap Used: ${heapUsedMB} MB (${usagePercentage}%)\n` +
         `  External: ${externalMB} MB`;
}

/**
 * Format CPU metrics for display
 */
function formatCpuMetrics(metrics: PerformanceMetrics['cpuUsage']): string {
  if (!metrics) return 'No CPU metrics available';
  
  return `CPU Usage:\n` +
         `  Usage: ${metrics.percentage.toFixed(1)}%\n` +
         `  User Time: ${metrics.userTime} ms\n` +
         `  System Time: ${metrics.systemTime} ms`;
}

/**
 * Format UI metrics for display
 */
function formatUiMetrics(metrics: PerformanceMetrics['uiMetrics']): string {
  if (!metrics) return 'No UI metrics available';
  
  return `UI Performance:\n` +
         `  FPS: ${metrics.fps.toFixed(1)}\n` +
         `  Frame Build Time: ${metrics.frameBuildTime.toFixed(2)} ms\n` +
         `  Frame Raster Time: ${metrics.frameRasterTime.toFixed(2)} ms\n` +
         `  Total Frame Time: ${metrics.totalFrameTime.toFixed(2)} ms`;
}

/**
 * Get performance metrics from a Flutter app
 * @param args.appId The ID of the Flutter app to get metrics from
 * @param args.metric Specific metric to retrieve (optional)
 */
export async function getPerformanceMetrics(args: { 
  appId: string; 
  metric?: 'memory' | 'cpu' | 'ui' | 'all'
}): Promise<any> {
  try {
    const { appId, metric = 'all' } = args;
    
    // Verify the app exists
    const app = await connectorClient.getApp(appId);
    
    if (!app) {
      return {
        content: [
          {
            type: "text",
            text: `Could not find a Flutter app with ID: ${appId}`
          }
        ]
      };
    }
    
    // Get the metrics
    const metrics = await connectorClient.getMetrics(appId, metric);
    
    if (!metrics) {
      return {
        content: [
          {
            type: "text",
            text: `No performance metrics available for ${app.name}`
          }
        ]
      };
    }
    
    // Format the metrics based on what was requested
    let formattedMetrics = '';
    
    if (metric === 'all') {
      formattedMetrics = [
        formatMemoryMetrics(metrics.memoryUsage),
        formatCpuMetrics(metrics.cpuUsage),
        formatUiMetrics(metrics.uiMetrics)
      ].join('\n\n');
    } else if (metric === 'memory') {
      formattedMetrics = formatMemoryMetrics(metrics.memoryUsage);
    } else if (metric === 'cpu') {
      formattedMetrics = formatCpuMetrics(metrics.cpuUsage);
    } else if (metric === 'ui') {
      formattedMetrics = formatUiMetrics(metrics.uiMetrics);
    }
    
    return {
      content: [
        {
          type: "text",
          text: `Performance Metrics for ${app.name}:\n` +
                `Collected at: ${new Date(metrics.timestamp).toLocaleString()}\n\n` +
                formattedMetrics
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error retrieving performance metrics: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
} 