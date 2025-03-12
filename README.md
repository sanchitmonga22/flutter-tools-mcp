# Flutter Tools MCP

A Model Context Protocol (MCP) implementation for Flutter development tools. This project provides a set of tools that can be used by AI assistants to help with Flutter app development, debugging, and analysis.

## Features

- **App Management**: Start, stop, and manage Flutter applications
- **Logging**: Capture and analyze app logs
- **Screenshots**: Take screenshots of running Flutter apps
- **Network Monitoring**: Capture and analyze network requests
- **Performance Analysis**: Collect performance metrics from running apps
- **Hot Reload**: Trigger hot reload for faster development

## Requirements

- Node.js 18 or higher
- Flutter SDK installed and available in PATH
- For Android device support: ADB installed and available in PATH
- For iOS device support: Xcode and iOS Simulator

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/flutter-tools-mcp.git
cd flutter-tools-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Starting the MCP Server

```bash
# Using npm
npm start

# Or using the start script directly
./start.js
```

### Available Tools

The following tools are available through the MCP interface:

1. **startApp**: Start a Flutter app on a device or emulator
   - Parameters: `projectPath` (required), `deviceId` (optional)

2. **stopApp**: Stop a running Flutter app
   - Parameters: `appId` (required)

3. **getLogs**: Get logs from a running Flutter app
   - Parameters: `appId` (required), `logType` (optional, defaults to "all")

4. **takeScreenshot**: Take a screenshot of a running Flutter app
   - Parameters: `appId` (required)

5. **getNetworkData**: Get network requests from a running Flutter app
   - Parameters: `appId` (required)

6. **getPerformanceData**: Get performance metrics from a running Flutter app
   - Parameters: `appId` (required), `metrics` (optional)

7. **hotReload**: Trigger hot reload for a running Flutter app
   - Parameters: `appId` (required)

8. **listRunningApps**: List all running Flutter apps

## Development

### Project Structure

```
flutter-tools-mcp/
├── src/
│   ├── index.ts           # Main entry point
│   ├── tools/
│   │   ├── app-manager.ts  # Flutter app instance management
│   │   ├── flutter-tools.ts # Tool implementations
│   │   ├── tool-types.ts   # TypeScript interfaces
│   │   └── index.ts        # Tools exports
│   └── utils/
│       └── logger.ts       # Logging utility
├── dist/                  # Compiled JavaScript files
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── start.js               # Executable start script
└── README.md              # This file
```

### Building

```bash
npm run build
```

### Running in Development Mode

```bash
npm run dev
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 