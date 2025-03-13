import { ConnectorClient } from '../services/connector-client.js';

// Connector client instance
const connectorClient = new ConnectorClient();

/**
 * Capture a screenshot of the Flutter app UI
 * @param args.appId The ID of the Flutter app to take screenshot from
 */
export async function takeScreenshot(args: { appId: string }): Promise<any> {
  try {
    const { appId } = args;
    
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
    
    // Take the screenshot
    const screenshotBase64 = await connectorClient.takeScreenshot(appId);
    
    if (!screenshotBase64) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to capture screenshot for ${app.name}`
          }
        ]
      };
    }
    
    // Return the screenshot as an image
    return {
      content: [
        {
          type: "text",
          text: `Screenshot captured for ${app.name} at ${new Date().toLocaleString()}`
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: screenshotBase64
          }
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error capturing screenshot: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
} 