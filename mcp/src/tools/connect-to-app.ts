import { ConnectorClient } from '../services/connector-client.js';

// Connector client instance
const connectorClient = new ConnectorClient();

/**
 * Connect to a specific Flutter app by ID
 * @param args.appId The ID of the Flutter app to connect to
 */
export async function connectToApp(args: { appId: string }): Promise<any> {
  try {
    const { appId } = args;
    
    // Get app info to verify it exists
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
    
    // For this example, we're just returning the app info
    // In a real implementation, we might establish a persistent connection
    
    return {
      content: [
        {
          type: "text",
          text: `Successfully connected to Flutter app:\n\n` +
                `App: ${app.name}\n` +
                `ID: ${app.id}\n` +
                `Device: ${app.deviceType}\n` +
                `Port: ${app.port}\n` +
                `Started: ${new Date(app.startTime).toLocaleString()}\n\n` +
                `You can now use other tools to monitor and debug this app.`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error connecting to Flutter app: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
} 