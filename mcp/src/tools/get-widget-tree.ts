import { ConnectorClient } from '../services/connector-client.js';
import { WidgetNode } from '../types/index.js';

// Connector client instance
const connectorClient = new ConnectorClient();

/**
 * Format a widget tree node for display
 * @param node The widget node to format
 * @param depth The current depth in the tree
 */
function formatWidgetNode(node: WidgetNode, depth: number = 0): string {
  const indent = '  '.repeat(depth);
  let result = `${indent}• ${node.type}`;
  
  // Add key properties if available
  if (node.properties) {
    const keyProps = ['key', 'id', 'name', 'text'].filter(key => node.properties[key]);
    if (keyProps.length > 0) {
      const propStrings = keyProps.map(key => `${key}: ${node.properties[key]}`);
      result += ` (${propStrings.join(', ')})`;
    }
  }
  
  result += '\n';
  
  // Add children recursively
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      result += formatWidgetNode(child, depth + 1);
    }
  }
  
  return result;
}

/**
 * Format the full widget tree
 */
function formatWidgetTree(rootNode: WidgetNode): string {
  return formatWidgetNode(rootNode);
}

/**
 * Retrieve the widget tree structure of a Flutter app
 * @param args.appId The ID of the Flutter app to get widget tree from
 */
export async function getWidgetTree(args: { appId: string }): Promise<any> {
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
    
    // Get the widget tree
    const widgetTree = await connectorClient.getWidgetTree(appId);
    
    if (!widgetTree) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve widget tree for ${app.name}`
          }
        ]
      };
    }
    
    // Format the widget tree
    const formattedTree = formatWidgetTree(widgetTree);
    
    return {
      content: [
        {
          type: "text",
          text: `Widget Tree for ${app.name}:\n\n${formattedTree}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error retrieving widget tree: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
} 