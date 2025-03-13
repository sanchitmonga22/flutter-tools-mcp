import { ConnectorClient } from '../services/connector-client.js';
import { NetworkRequest } from '../types/index.js';

// Connector client instance
const connectorClient = new ConnectorClient();

/**
 * Format a network request for display
 */
function formatNetworkRequest(request: NetworkRequest): string {
  const status = request.statusCode 
    ? `${request.statusCode} ${request.statusCode >= 200 && request.statusCode < 300 ? '✓' : '✗'}`
    : 'Pending';
  
  const duration = request.duration 
    ? `${request.duration.toFixed(2)} ms` 
    : 'N/A';
  
  const size = request.responseSize 
    ? `${(request.responseSize / 1024).toFixed(2)} KB` 
    : 'N/A';
  
  return `${request.method} ${status} ${request.url}\n` +
         `  Time: ${new Date(request.startTime).toLocaleTimeString()}\n` +
         `  Duration: ${duration}\n` +
         `  Size: ${size}\n` +
         `  Type: ${request.contentType || 'Unknown'}\n` +
         (request.error ? `  Error: ${request.error}\n` : '');
}

/**
 * Fetch network request data from a Flutter app
 * @param args.appId The ID of the Flutter app to get network requests from
 * @param args.count Number of recent network requests to retrieve (optional)
 */
export async function getNetworkRequests(args: { appId: string; count?: number }): Promise<any> {
  try {
    const { appId, count } = args;
    
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
    
    // Get the network requests
    const requests = await connectorClient.getNetworkRequests(appId, count);
    
    if (requests.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No network requests recorded for ${app.name}`
          }
        ]
      };
    }
    
    // Summary statistics
    const totalRequests = requests.length;
    const successRequests = requests.filter(r => r.statusCode && r.statusCode >= 200 && r.statusCode < 300).length;
    const failedRequests = requests.filter(r => r.statusCode && (r.statusCode < 200 || r.statusCode >= 300)).length;
    const pendingRequests = requests.filter(r => !r.statusCode).length;
    
    const summary = `Summary:\n` +
                    `  Total Requests: ${totalRequests}\n` +
                    `  Successful: ${successRequests}\n` +
                    `  Failed: ${failedRequests}\n` +
                    `  Pending: ${pendingRequests}\n`;
    
    // Format each request
    const formattedRequests = requests.map((req, index) => 
      `Request ${index + 1}:\n${formatNetworkRequest(req)}`
    ).join('\n\n');
    
    return {
      content: [
        {
          type: "text",
          text: `Network Requests for ${app.name}:\n\n` +
                summary + '\n' +
                formattedRequests
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error retrieving network requests: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
} 