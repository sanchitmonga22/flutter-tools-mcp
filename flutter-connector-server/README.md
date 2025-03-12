# Flutter Connector Server

A standalone server for monitoring and controlling Flutter applications. This server runs in the background and provides a REST API and WebSocket interface for the MCP (Model Context Protocol) server to interact with Flutter applications.

## Features

- Auto-discovery of running Flutter applications
- Real-time log collection from Flutter apps
- Performance metrics monitoring
- Hot reload support
- Screenshot capture
- API for starting and stopping Flutter apps
- WebSocket notifications for real-time updates

## Installation

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Start the server
npm start
```

## Development

```bash
# Start with auto-reloading for development
npm run dev
```

## Configuration

The server can be configured using environment variables:

- `FLUTTER_CONNECTOR_PORT`: Port to run the server on (default: 3030)
- `FLUTTER_CONNECTOR_HOST`: Host to bind to (default: 0.0.0.0)
- `LOG_LEVEL`: Logging level (0 = DEBUG, 1 = INFO, 2 = WARN, 3 = ERROR)

## API Endpoints

The following REST API endpoints are available:

### App Management

- `GET /api/apps`: List all monitored Flutter apps
- `GET /api/apps/:id`: Get details about a specific app
- `POST /api/apps`: Start a new Flutter app
- `DELETE /api/apps/:id`: Stop a running Flutter app

### Logs and Metrics

- `GET /api/apps/:id/logs`: Get logs for a specific app
- `POST /api/apps/:id/logs`: Add a log entry to an app
- `GET /api/apps/:id/performance`: Get performance metrics for an app
- `POST /api/apps/:id/performance`: Update performance metrics

### Operations

- `POST /api/apps/:id/hot-reload`: Trigger hot reload for an app
- `POST /api/screenshot/:id`: Take a screenshot of a running app

### System

- `GET /.identity`: Get server identity for MCP discovery
- `GET /.port`: Get current server port
- `GET /health`: Health check endpoint

## WebSocket API

The server also provides a WebSocket API at `/ws` for real-time updates. Clients can receive notifications about app status changes, logs, and other events.

## Architecture

This server is part of a two-component system:

1. **Flutter Connector Server**: Monitors and controls Flutter applications
2. **MCP Server**: Provides a model context protocol interface for AI models

The Flutter Connector Server runs continuously in the background, while the MCP Server connects to it as needed to fulfill tool requests from AI models. 