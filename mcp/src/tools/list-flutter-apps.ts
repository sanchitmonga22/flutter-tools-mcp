import { ConnectorClient } from '../services/connector-client.js';
import { FlutterApp } from '../types/index.js';

// Connector client instance
const connectorClient = new ConnectorClient();

/**
 * List all running Flutter applications
 */
export async function listFlutterApps(): Promise<any> {
  try {
    const apps = await connectorClient.getApps();
    
    if (apps.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No Flutter applications are currently running."
          }
        ]
      };
    }
    
    // Format the app information for display
    const appInfo = apps.map((app: FlutterApp) => {
      return `• App: ${app.name}\n` +
             `  ID: ${app.id}\n` +
             `  Device: ${app.deviceType}\n` +
             `  Port: ${app.port}\n` +
             `  Started: ${new Date(app.startTime).toLocaleString()}`;
    }).join("\n\n");
    
    return {
      content: [
        {
          type: "text",
          text: `Found ${apps.length} running Flutter application${apps.length === 1 ? '' : 's'}:\n\n${appInfo}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error listing Flutter applications: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
} 