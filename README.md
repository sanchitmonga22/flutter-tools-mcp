# Flutter Tools MCP

A comprehensive toolset for Flutter development with AI assistant integration through the Model Context Protocol.

## Overview

This project provides a powerful platform for interacting with Flutter applications programmatically, enabling AI assistants and development tools to inspect, control, and optimize Flutter apps. The system follows a two-component architecture that provides scalability and robustness.

## Architecture

The project consists of two main components:

1. **Flutter Connector Server**: A standalone server that monitors Flutter applications, providing direct access to their state, logs, performance metrics, and more.

2. **MCP Server**: A Model Context Protocol server that provides AI assistants with tools to interact with Flutter applications through a standardized interface.

These components work together to provide a seamless experience for debugging, testing, and analyzing Flutter applications.

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

- Node.js (v14 or later)
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

You can run both servers simultaneously using the provided script:

```bash
node start-servers.js
```

Or run them separately:

```bash
# Run MCP Server
cd mcp
npm start

# Run Flutter Connector Server (in another terminal)
cd flutter-connector-server
npm start
```

### Configuration

Both servers can be configured using environment variables:

- **MCP Server**
  - `MCP_PORT`: Port to listen on (default: 3000)
  - `MCP_HOST`: Host to bind to (default: localhost)

- **Flutter Connector Server**
  - `FLUTTER_CONNECTOR_PORT`: Port to listen on (default: 3030)
  - `FLUTTER_CONNECTOR_HOST`: Host to bind to (default: localhost)
  - `FLUTTER_CONNECTOR_API_KEY`: API key for authentication (optional)

## Usage

### AI Assistant Tools

The MCP server provides the following tools for AI assistants:

- `getRunningApps`: List all running Flutter apps
- `getApp`: Get details about a specific app
- `startApp`: Start a Flutter application
- `stopApp`: Stop a running Flutter application
- `getAppLogs`: Get logs from a running app
- `hotReload`: Perform a hot reload on an app
- `takeScreenshot`: Take a screenshot of an app
- `getNetworkTraffic`: Monitor network requests
- `getPerformanceMetrics`: Get performance data
- `getDevices`: List connected devices
- `getDebugInfo`: Get debug information and DevTools URL
- `getSystemHealth`: Get system health status
- `getAnalyticsInsights`: Get performance insights and recommendations

### Using the API Directly

Both servers provide RESTful APIs that can be accessed directly:

#### MCP Server API

```
GET /api/mcp/tools - List available tools
POST /api/mcp/runTool - Run a tool
```

#### Flutter Connector Server API

```
GET /api/apps - List running apps
POST /api/apps/start - Start a new app
GET /api/apps/{appId} - Get app details
POST /api/apps/{appId}/stop - Stop an app
GET /api/apps/{appId}/logs - Get app logs
POST /api/apps/{appId}/hot-reload - Perform hot reload
GET /api/apps/{appId}/screenshot - Take screenshot
GET /api/apps/{appId}/network - Get network traffic
GET /api/apps/{appId}/performance - Get performance metrics
GET /api/apps/{appId}/debug - Get debug information
GET /api/apps/{appId}/analytics - Get analytics insights
GET /api/devices - List connected devices
GET /api/health - Get system health
GET /api/health/check - Quick health check
```

## Development

### Project Structure

```
flutter-tools-mcp/
├── mcp/                  # MCP server
│   ├── src/
│   │   ├── tools/        # Tool implementations
│   │   ├── utils/        # Utilities
│   │   └── index.ts      # Main entry point
│   └── package.json
│
├── flutter-connector-server/  # Flutter Connector Server
│   ├── src/
│   │   ├── app-manager.ts     # App management
│   │   ├── device-manager.ts  # Device management
│   │   ├── server.ts          # Server implementation
│   │   ├── devtools-integration.ts # DevTools integration
│   │   ├── analytics-service.ts   # Analytics service
│   │   └── reliability/       # Self-healing components
│   └── package.json
│
└── start-servers.js      # Script to start both servers
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