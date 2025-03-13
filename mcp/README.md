# Flutter Tools MCP Server

The Flutter Tools MCP (Model Context Protocol) Server provides a bridge between AI assistants and Flutter applications. It enables AI models to interact with and debug Flutter apps by exposing tools for capturing metrics, logs, screenshots, and more.

## Features

- Connect to and monitor Flutter applications
- Real-time metrics and logs from Flutter apps
- Screenshot capabilities
- Hot reload support
- WebSocket API for real-time updates
- REST API for programmatic access

## Getting Started

### Prerequisites

- Node.js 18 or higher
- [Flutter Connector Server](../flutter-connector-server) running

### Installation

```bash
git clone https://github.com/your-repo/flutter-tools-mcp.git
cd flutter-tools-mcp/mcp
npm install
```

### Usage

To start the server:

```bash
npm run build
npm start
```

Or in development mode:

```bash
npm run dev
```

The server will run on port 5052 by default and connect to the Flutter Connector Server at `http://localhost:5051`.

### Connecting to Flutter Apps

**IMPORTANT**: When using the Flutter Tools MCP, you must always follow this workflow:

1. **Launch your Flutter app in debug mode**:
   ```bash
   flutter run
   ```

2. **Note the VM Service URL** that appears in the console output. It will look something like:
   ```
   Connecting to VM Service at ws://127.0.0.1:55285/xxxxxxxxxxxx=/ws
   ```

3. **Connect to your Flutter app using the VM Service URL first**:
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

## Available Tools

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

### Base URL

```
http://localhost:5052
```

### Endpoints

- `GET /api/info` - Get server information
- `GET /api/apps` - List all available Flutter apps
- `GET /api/apps/:id` - Get details for a specific app
- `POST /api/apps` - Manually add a Flutter app
- `POST /api/apps/from-url` - Add a Flutter app using VM service URL
- `POST /api/apps/:id/monitor` - Start monitoring an app
- `POST /api/apps/:id/stop` - Stop monitoring an app
- `GET /api/apps/:id/logs` - Get logs for an app
- `DELETE /api/apps/:id/logs` - Clear logs for an app
- `GET /api/apps/:id/metrics` - Get performance metrics for an app
- `GET /api/apps/:id/network` - Get network requests for an app
- `POST /api/apps/:id/hot-reload` - Trigger a hot reload of an app
- `GET /api/apps/:id/screenshot` - Capture a screenshot of an app

## WebSocket API

The server provides a WebSocket endpoint that emits real-time updates about Flutter apps. Connect to `ws://localhost:5052` to receive events.

### Message Types

- `apps` - List of all available Flutter apps
- `logs` - Logs from a specific app
- `metrics` - Performance metrics from a specific app
- `network` - Network requests from a specific app

## Environment Variables

- `PORT` - Server port (default: 5052)
- `HOST` - Server host (default: localhost)
- `CONNECTOR_URL` - URL of the Flutter Connector Server (default: http://localhost:5051)
- `POLLING_INTERVAL` - How often to poll for updates in milliseconds (default: 2000)

## Architecture

The Flutter Tools MCP Server connects to the Flutter Connector Server to retrieve information about Flutter applications and relay that information to AI assistants or other clients. It acts as a bridge between the AI models and the Flutter apps.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 