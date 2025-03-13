import { ConnectorClient } from '../services/connector-client.js';

// Connector client instance
const connectorClient = new ConnectorClient();

/**
 * Connect to a Flutter app by VM service URL
 * @param args.vmServiceUrl The VM service URL (e.g., ws://127.0.0.1:55285/hqyzYdQKcLg=/ws)
 */
export async function connectByUrl(args: { vmServiceUrl: string }): Promise<any> {
  try {
    const { vmServiceUrl } = args;
    
    // Add the app using the VM service URL
    const app = await connectorClient.addAppFromUrl(vmServiceUrl);
    
    if (!app) {
      return {
        content: [
          {
            type: "text",
            text: `Could not connect to Flutter app at URL: ${vmServiceUrl}`
          }
        ]
      };
    }
    
    // Start monitoring the app
    const success = await connectorClient.startMonitoring(app.id);
    
    if (!success) {
      return {
        content: [
          {
            type: "text",
            text: `Connected to app but failed to start monitoring: ${app.name} (${app.id})`
          }
        ]
      };
    }
    
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
                `Monitoring has been started automatically. You can now use other tools to debug this app.`
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