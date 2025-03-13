# Flutter Connector Server

The Flutter Connector Server is a standalone server that provides a bridge between Flutter applications and monitoring tools. It leverages the Flutter VM Service Protocol to collect data from running Flutter apps.

## Features

- Automatic discovery of Flutter applications
- Real-time monitoring of app logs, performance metrics, and network requests
- REST API for accessing and controlling Flutter apps
- Screenshots and hot reload capabilities

## Getting Started

### Prerequisites

- Node.js 18 or higher
- A running Flutter application in debug mode

### Installation

```bash
git clone https://github.com/your-repo/flutter-connector-server.git
cd flutter-connector-server
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

The server will run on port 5051 by default.

### Connecting to Flutter Apps

When a Flutter app is running in debug mode, it exposes a VM Service URL that looks like:
```
Connecting to VM Service at ws://127.0.0.1:55285/xxxxxxxxxxxx=/ws
```

You can connect to this app in two ways:

1. **Automatic Discovery**: The server will automatically scan ports to find Flutter apps, but this may not work for apps that require authentication tokens.

2. **Manual Connection with VM Service URL** (Recommended):
   ```bash
   curl -X POST http://localhost:5051/api/apps/from-url -H "Content-Type: application/json" -d '{"vmServiceUrl": "ws://127.0.0.1:55285/xxxxxxxxxxxx=/ws"}'
   ```
   This method is more reliable as it correctly extracts the port and authentication token from the URL.

## API Reference

### Base URL

```
http://localhost:5051
```

### Endpoints

- `GET /api/info` - Get server information
- `GET /api/apps` - List all discovered Flutter apps
- `GET /api/apps/:id` - Get details for a specific app
- `POST /api/apps` - Manually add a Flutter app by port
- `POST /api/apps/from-url` - Add a Flutter app using VM service URL (recommended)
- `POST /api/apps/:id/monitor` - Start monitoring an app
- `POST /api/apps/:id/stop` - Stop monitoring an app
- `GET /api/apps/:id/logs` - Get logs for an app
- `DELETE /api/apps/:id/logs` - Clear logs for an app
- `GET /api/apps/:id/metrics` - Get performance metrics for an app
- `GET /api/apps/:id/network` - Get network requests for an app
- `POST /api/apps/:id/hot-reload` - Trigger a hot reload of an app
- `GET /api/apps/:id/screenshot` - Capture a screenshot of an app

## Environment Variables

- `PORT` - Server port (default: 5051)
- `HOST` - Server host (default: localhost)
- `DISCOVERY_INTERVAL` - How often to scan for new Flutter apps in milliseconds (default: 5000)
- `LOG_LEVEL` - Logging level (default: info)
- `LOG_FILE` - Optional file path for logs

## Architecture

The Flutter Connector Server is built with a modular architecture:

1. **App Discovery Service** - Scans for running Flutter applications
2. **VM Service Client** - Communicates with the Flutter VM Service Protocol
3. **App Monitor Service** - Collects and manages data from Flutter apps
4. **REST API Server** - Exposes the collected data via HTTP endpoints

## License

This project is licensed under the MIT License - see the LICENSE file for details. 