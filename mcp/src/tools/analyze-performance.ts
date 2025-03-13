import { ConnectorClient } from '../services/connector-client.js';
import { PerformanceAnalysis } from '../types/index.js';

// Connector client instance
const connectorClient = new ConnectorClient();

/**
 * Format performance issues for display
 */
function formatIssues(issues: PerformanceAnalysis['issues']): string {
  if (!issues || issues.length === 0) {
    return 'No issues detected';
  }
  
  return issues.map((issue, index) => {
    const icon = issue.severity === 'error' ? '🔴' : '🟡';
    return `${index + 1}. ${icon} ${issue.severity.toUpperCase()}: ${issue.description}\n` +
           `   Recommendation: ${issue.recommendation}`;
  }).join('\n\n');
}

/**
 * Run a performance analysis on the Flutter app
 * @param args.appId The ID of the Flutter app to analyze
 * @param args.duration Duration of the analysis in seconds (optional)
 */
export async function analyzePerformance(args: { appId: string; duration?: number }): Promise<any> {
  try {
    const { appId, duration } = args;
    
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
    
    // Run the performance analysis
    const analysis = await connectorClient.analyzePerformance(appId, duration);
    
    if (!analysis) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to analyze performance for ${app.name}`
          }
        ]
      };
    }
    
    // Format the analysis results
    const summary = `Performance Score: ${analysis.score}/100\n` +
                    `Analysis Duration: ${analysis.duration} seconds\n` +
                    `Timestamp: ${new Date(analysis.timestamp).toLocaleString()}\n\n` +
                    `Average Memory Usage: ${(analysis.memoryTrend[0]?.memoryUsage?.heapUsed || 0) / (1024 * 1024)} MB\n` +
                    `Average CPU Usage: ${analysis.cpuTrend[0]?.cpuUsage?.percentage || 0}%\n` +
                    `Average FPS: ${analysis.uiTrend[0]?.uiMetrics?.fps || 0}\n`;
    
    const issues = formatIssues(analysis.issues);
    
    return {
      content: [
        {
          type: "text",
          text: `Performance Analysis for ${app.name}:\n\n` +
                `${summary}\n` +
                `Detected Issues:\n\n${issues}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error analyzing performance: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
} 