# Flutter Tools MCP

A comprehensive toolset for Flutter development with AI assistant integration through the Model Context Protocol.

## Overview

This project provides a powerful platform for interacting with Flutter applications programmatically, enabling AI assistants and development tools to inspect, control, and optimize Flutter apps. The system follows a two-component architecture that provides scalability and robustness.

## Architecture

The project consists of two main components:

1. **Flutter Connector Server**: A standalone server that monitors Flutter applications, providing direct access to their state, logs, performance metrics, and more.

2. **MCP Server**: A Model Context Protocol server that provides AI assistants with tools to interact with Flutter applications through a standardized interface.

These components work together to provide a seamless experience for debugging, testing, and analyzing Flutter applications.

### Communication Flow

```
┌──────────────────┐          ┌───────────────────┐          ┌─────────────────┐
│                  │          │                   │          │                 │
│  AI Assistant    │◄─────────┤   MCP Server      │◄─────────┤ Flutter         │
│  (Claude, etc.)  │  MCP     │   (Tool Provider) │   REST   │ Connector       │
│                  ├─────────►│                   ├─────────►│ Server          │
└──────────────────┘          └───────────────────┘          └────────┬────────┘
                                                                      │
                                                                      │ VM Service
                                                                      │ Protocol
                                                                      ▼
                                                             ┌─────────────────┐
                                                             │                 │
                                                             │ Flutter Apps    │
                                                             │ (Debugging Mode)│
                                                             │                 │
                                                             └─────────────────┘
```

The system works as follows:

1. **Flutter Connector Server** discovers and connects to Flutter apps in debug mode via the VM Service Protocol
2. **MCP Server** communicates with the Flutter Connector Server via REST API calls
3. **AI Assistants** (like Claude) use the tools provided by the MCP Server through the Model Context Protocol
4. This layered approach allows AI tools to analyze, debug, and optimize Flutter applications seamlessly

## Features

- **Application Management**
  - Start/stop Flutter applications
  - List running applications
  - Hot reload apps
  - Monitor app logs

- **Device Management**
  - Discover connected devices (Android/iOS/simulators/emulators)
  - Get device information
  - Select the best device based on priority rules

- **Debugging Capabilities**
  - Take screenshots
  - Monitor network traffic
  - Collect performance metrics
  - Launch Flutter DevTools
  - Get widget hierarchies

- **Analytics and Insights**
  - Collect time-series performance data
  - Analyze trends
  - Detect anomalies
  - Generate optimization recommendations

- **Reliability**
  - Process monitoring
  - Automatic recovery
  - Self-healing mechanisms
  - Resource usage optimization

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- Flutter SDK
- Android SDK (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/flutter-tools-mcp.git
   cd flutter-tools-mcp
   ```

2. Install dependencies for both components:
   ```bash
   # Install MCP server dependencies
   cd mcp
   npm install
   npm run build
   cd ..

   # Install Flutter Connector Server dependencies
   cd flutter-connector-server
   npm install
   npm run build
   cd ..
   ```

### Running the Servers

You need to run both the Flutter Connector Server and the MCP Server:

1. **Start the Flutter Connector Server**:
   ```bash
   cd flutter-connector-server
   npm start
   ```
   This will start the connector server on port 5051 by default.

2. **Start the MCP Server** (in a new terminal):
   ```bash
   cd mcp
   npm start
   ```
   This will start the MCP server running on stdio, ready to connect to MCP clients.

### Using with Flutter Apps

To use the Flutter Tools MCP with your Flutter applications, follow these steps:

1. **Launch your Flutter app in debug mode**:
   ```bash
   flutter run
   ```

2. **Note the VM Service URL** that appears in the console output. It will look something like:
   ```
   Connecting to VM Service at ws://127.0.0.1:55285/xxxxxxxxxxxx=/ws
   ```

3. **IMPORTANT: Connect to your Flutter app using the VM Service URL first**:
   This is a crucial step! Before using any other tools, you must first connect to your Flutter app using the `connect-by-url` tool with the VM Service URL from step 2.

   Example:
   ```
   connect-by-url --vmServiceUrl ws://127.0.0.1:55285/xxxxxxxxxxxx=/ws
   ```

4. **After connecting**, you can use all other tools with the app ID returned from the connection step:
   ```
   get-performance-metrics --appId YOUR_APP_ID
   get-app-logs --appId YOUR_APP_ID
   take-screenshot --appId YOUR_APP_ID
   ```

### Using with Claude for Desktop

To use the Flutter Tools MCP with Claude for Desktop:

1. Open the Claude for Desktop configuration file:
   ```bash
   # On macOS
   nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
   
   # On Windows
   notepad %APPDATA%\Claude\claude_desktop_config.json
   ```

2. Add the configuration for the Flutter Tools MCP:
   ```json
   {
     "mcpServers": {
       "flutter-tools": {
         "command": "node",
         "args": [
           "/ABSOLUTE/PATH/TO/flutter-tools-mcp/mcp/build/index.js"
         ]
       }
     }
   }
   ```
   Make sure to replace `/ABSOLUTE/PATH/TO` with the actual absolute path to your project directory.

3. Save the file and restart Claude for Desktop.

4. You should now see the Flutter tools icon in the Claude for Desktop interface.

5. **Remember**: Always use the `connect-by-url` tool first with your VM Service URL before using any other tools.

### Using with Cursor

To integrate with Cursor:

1. Ensure you have Cursor installed with MCP support
2. Configure Cursor to use the Flutter Tools MCP:
   - Open Cursor settings
   - Navigate to the MCP section
   - Add a new MCP server with the command:
     ```
     node /ABSOLUTE/PATH/TO/flutter-tools-mcp/mcp/build/index.js
     ```
3. Restart Cursor to apply the changes
4. **Important**: When using the Flutter tools in Cursor, always start by connecting to your app with the `connect-by-url` tool and the VM Service URL before using any other tools.

## Available MCP Tools

The MCP server provides the following tools for AI assistants:

| Tool Name | Description |
|-----------|-------------|
| `connect-by-url` | **FIRST STEP**: Connect to a Flutter app using the VM Service URL |
| `list-flutter-apps` | List all running Flutter applications |
| `connect-to-app` | Connect to a specific Flutter app by ID |
| `get-app-logs` | Retrieve logs from a connected Flutter app |
| `get-performance-metrics` | Get performance metrics from a Flutter app |
| `get-network-requests` | Fetch network request data from a Flutter app |
| `take-screenshot` | Capture a screenshot of the Flutter app UI |
| `get-widget-tree` | Retrieve the widget tree structure of a Flutter app |
| `analyze-performance` | Run a performance analysis on the Flutter app |

## API Reference

### Flutter Connector Server API

```
GET /api/apps - List running apps
GET /api/apps/{appId} - Get app details
POST /api/apps/from-url - Add an app using VM service URL
GET /api/apps/{appId}/logs - Get app logs
GET /api/apps/{appId}/metrics - Get performance metrics
GET /api/apps/{appId}/network - Get network traffic
GET /api/apps/{appId}/screenshot - Take screenshot
GET /api/apps/{appId}/widget-tree - Get widget tree
GET /api/health - Server health check
```

## Development

### Project Structure

```
flutter-tools-mcp/
├── mcp/                  # MCP server
│   ├── src/
│   │   ├── tools/        # Tool implementations
│   │   ├── services/     # Services (connector client, etc.)
│   │   ├── types/        # TypeScript type definitions
│   │   └── index.ts      # Main entry point
│   └── package.json
│
├── flutter-connector-server/  # Flutter Connector Server
│   ├── src/
│   │   ├── services/          # Core services
│   │   ├── controllers/       # API controllers
│   │   ├── utils/             # Utility functions
│   │   └── server.ts          # Server implementation
│   └── package.json
│
└── README.md             # This documentation file
```

### Running in Development Mode

To run the servers with auto-reloading during development:

```bash
# MCP Server
cd mcp
npm run dev

# Flutter Connector Server
cd flutter-connector-server
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 