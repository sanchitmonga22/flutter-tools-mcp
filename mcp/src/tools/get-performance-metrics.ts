import { ConnectorClient } from '../services/connector-client.js';
import { PerformanceMetrics } from '../types/index.js';

// Connector client instance
const connectorClient = new ConnectorClient();

/**
 * Format memory metrics for display
 */
function formatMemoryMetrics(metrics: any): string {
  if (!metrics) return 'No memory metrics available';
  
  const heapSizeMB = (metrics.heapCapacity / (1024 * 1024)).toFixed(2);
  const heapUsedMB = (metrics.heapUsage / (1024 * 1024)).toFixed(2);
  const externalMB = (metrics.externalUsage / (1024 * 1024)).toFixed(2);
  const usagePercentage = ((metrics.heapUsage / metrics.heapCapacity) * 100).toFixed(1);
  
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
    
    // Get the metrics - the API returns an array of metrics
    const metricsArray: any[] = await connectorClient.getMetrics(appId, metric);
    
    console.log('Metrics array:', JSON.stringify(metricsArray).substring(0, 200) + '...');
    
    if (!metricsArray || metricsArray.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No performance metrics available for ${app.name}`
          }
        ]
      };
    }
    
    // Get the most recent metric
    const latestMetric = metricsArray[metricsArray.length - 1];
    console.log('Latest metric:', JSON.stringify(latestMetric));
    
    const timestamp = latestMetric.timestamp;
    
    // Format the metrics based on what was requested
    let formattedMetrics = '';
    
    if (metric === 'all' || metric === 'memory') {
      if (latestMetric.memory) {
        console.log('Memory metrics:', JSON.stringify(latestMetric.memory));
        formattedMetrics += formatMemoryMetrics(latestMetric.memory);
      } else {
        formattedMetrics += 'No memory metrics available';
      }
    }
    
    if (metric === 'all' || metric === 'cpu') {
      if (formattedMetrics) formattedMetrics += '\n\n';
      if (latestMetric.cpu) {
        formattedMetrics += formatCpuMetrics(latestMetric.cpu);
      } else {
        formattedMetrics += 'No CPU metrics available';
      }
    }
    
    if (metric === 'all' || metric === 'ui') {
      if (formattedMetrics) formattedMetrics += '\n\n';
      if (latestMetric.ui) {
        formattedMetrics += formatUiMetrics(latestMetric.ui);
      } else {
        formattedMetrics += 'No UI metrics available';
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: `Performance Metrics for ${app.name}:\n` +
                `Collected at: ${new Date(timestamp).toLocaleString()}\n\n` +
                formattedMetrics
        }
      ]
    };
  } catch (error) {
    console.error('Error in getPerformanceMetrics:', error);
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