# Flutter Tools MCP

A Model Context Protocol (MCP) server for Flutter development tools. This server provides AI assistants with the ability to interact with Flutter applications through a standardized interface.

## Features

- Start and stop Flutter applications
- Get logs from running apps
- Take screenshots
- Monitor network traffic
- Collect performance metrics
- Trigger hot reloads
- List running Flutter apps

## Architecture

The Flutter Tools MCP consists of two components:

1. **MCP Server**: This is the main server that implements the Model Context Protocol and exposes Flutter tools to AI assistants.
2. **Flutter Connector Server**: A standalone server that runs in the background and monitors Flutter applications. The MCP server connects to this server to get information about running apps.

## Installation

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Start the server
npm start
```

## Usage with Flutter Connector Server

For the best experience, you should run the Flutter Connector Server alongside the MCP server. The Flutter Connector Server provides real-time monitoring of Flutter applications and enables features like auto-discovery of running apps.

### Starting the Flutter Connector Server

```bash
# Navigate to the Flutter Connector Server directory
cd flutter-connector-server

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Start the server
npm start
```

By default, the Flutter Connector Server runs on port 3030. You can configure this using environment variables:

```bash
FLUTTER_CONNECTOR_PORT=3031 npm start
```

### Configuring the MCP Server to Connect to the Flutter Connector Server

The MCP server will automatically try to connect to the Flutter Connector Server at `localhost:3030`. You can configure this using environment variables:

```bash
FLUTTER_CONNECTOR_HOST=192.168.1.100 FLUTTER_CONNECTOR_PORT=3031 npm start
```

## Available Tools

The following tools are available to AI assistants:

- `start-app`: Start a Flutter app on a device or emulator
- `stop-app`: Stop a running Flutter app
- `get-logs`: Get logs from a running Flutter app
- `take-screenshot`: Take a screenshot of a running Flutter app
- `get-network-data`: Get network traffic data from a running Flutter app
- `get-performance-data`: Get performance metrics from a running Flutter app
- `hot-reload`: Trigger a hot reload in a running Flutter app
- `list-apps`: List all running Flutter apps

## Development

```bash
# Start with auto-reloading for development
npm run dev
```

## License

MIT 