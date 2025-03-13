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