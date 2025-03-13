import { ConnectorClient } from '../services/connector-client.js';

// Connector client instance
const connectorClient = new ConnectorClient();

/**
 * Retrieve logs from a connected Flutter app
 * @param args.appId The ID of the Flutter app to get logs from
 * @param args.lines Number of log lines to retrieve (optional)
 */
export async function getAppLogs(args: { appId: string; lines?: number }): Promise<any> {
  try {
    const { appId, lines } = args;
    
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
    
    // Get the logs
    const logs = await connectorClient.getLogs(appId, lines);
    
    if (logs.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No logs available for ${app.name}`
          }
        ]
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: `Logs for ${app.name} (${logs.length} entries):\n\n` +
                logs.join('\n')
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error retrieving logs: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
} 