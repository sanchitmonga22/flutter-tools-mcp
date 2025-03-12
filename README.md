# Flutter Tools MCP

> AI-powered Flutter development tools using Anthropic's Model Context Protocol (MCP)

Flutter Tools MCP enables AI assistants to interact with Flutter applications, providing debugging, monitoring, and analysis capabilities through the Model Context Protocol. This tool bridges the gap between AI assistants and Flutter app development, making your development workflow more efficient.

## 🎯 Key Features

- **Cross-Platform Support**: Work with Flutter apps on iOS, Android, and web platforms
- **App Management**: Start, stop, and manage Flutter applications remotely
- **Real-time Monitoring**:
  - Capture and analyze detailed app logs
  - Monitor network requests and responses
  - Track performance metrics
- **Interactive Debugging**:
  - Take screenshots of running apps
  - Trigger hot reload for instant code changes
  - Get real-time debugging feedback

## 📱 Platform Support

Based on the implementation in the codebase, Flutter Tools MCP supports:

| Platform | Device Type | Status | Features |
|----------|-------------|--------|----------|
| Android | Emulators | ✅ Full support | Screenshots, logs, network monitoring |
| Android | Physical devices | ✅ Full support | Screenshots, logs, network monitoring |
| iOS | Simulators | ✅ Full support | Screenshots, logs, network monitoring |
| iOS | Physical devices | ⚠️ Requires macOS & Xcode | Screenshots, logs, network monitoring |
| Web | Browsers | 🚧 Basic support | Logs, network monitoring |

## 🚀 Quick Start

### Installation

```bash
# Install globally with npm
npm install -g @flutter-tools/mcp

# Or run directly with npx
npx @flutter-tools/mcp
```

## 🛠️ Development Setup

### Cloning and Running Locally

If you want to run the Flutter Tools MCP from source or contribute to its development, follow these steps:

```bash
# Clone the repository
git clone https://github.com/flutter-tools/mcp.git
cd flutter-tools-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run the MCP server
node build/index.js
```

### Connecting to Cursor with Local Build

To connect your locally built Flutter Tools MCP to Cursor:

1. Open Cursor IDE and go to Settings (⚙️)
2. Navigate to the "MCP" section in the sidebar
3. Click on "Add new MCP server"
4. Configure the server with the following information:
   - **Name**: Flutter Tools Local (or any name you prefer)
   - **Command**: `node /path/to/your/clone/flutter-tools-mcp/build/index.js`
   - Replace `/path/to/your/clone` with the actual path where you cloned the repository

5. Click "Add" to save the server configuration
6. The Flutter tools will now be available to use in your AI conversations

### Troubleshooting Connection Issues

If you encounter "Client closed" or "No tools available" issues:

1. **Verify Build**: Ensure the project is built correctly with `npm run build`
2. **Check Permissions**: Make sure `build/index.js` has execute permissions (`chmod +x build/index.js`)
3. **Restart Cursor**: After adding the MCP server, restart Cursor to ensure changes take effect
4. **Use Absolute Path**: Use the full absolute path to the `build/index.js` file in the command
5. **Check Requirements**: Ensure Flutter SDK is installed and available in your PATH

## 🔌 Connecting with MCP Clients

### Cursor IDE

To connect Flutter Tools MCP to Cursor IDE:

1. Open Cursor IDE and go to Settings (⚙️)
2. Navigate to the "MCP" section in the sidebar
3. Click on "Add new MCP server"
4. Configure the server with the following information:
   - **Name**: Flutter Tools (or any name you prefer)
   - **Command**: `npx @flutter-tools/mcp`

   ![Cursor MCP Setup](https://raw.githubusercontent.com/flutter-tools/mcp/main/docs/images/cursor-setup.png)

5. Click "Add" to save the server configuration
6. The Flutter tools will now be available to use in your AI conversations

### Claude Desktop

To connect Flutter Tools MCP to Claude Desktop:

1. Open Claude Desktop
2. Click on settings (gear icon)
3. Navigate to "MCP Servers"
4. Add a new server with:
   ```json
   {
     "mcpServers": {
       "flutter": {
         "command": "npx @flutter-tools/mcp"
       }
     }
   }
   ```
5. Restart Claude Desktop

### Other MCP Clients

For other MCP-compatible clients, consult their documentation for adding custom MCP servers, and use `npx @flutter-tools/mcp` as the command to run the Flutter Tools MCP server.

### Using with MCP-compatible Clients

Flutter Tools MCP is designed to be used with any MCP-compatible client like:

- Cursor IDE
- Claude Desktop
- Zed Editor
- Cline

### Example Commands

Here are some examples of how to use Flutter Tools MCP with a compatible MCP client:

```
# Starting a Flutter app
startApp --projectPath="/path/to/flutter/project"

# Taking a screenshot of a running app
takeScreenshot --appId="your-app-id"

# Getting logs from a running app
getLogs --appId="your-app-id" --limit=100
```

## 🏗️ Architecture

The Flutter Tools MCP system consists of these key components:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  MCP Client │ ──► │ Flutter Tools│ ──► │   Flutter   │
│  (e.g.      │ ◄── │ MCP Server   │ ◄── │   Process   │
│   Cursor)   │     │              │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
```

1. **MCP Client**: AI-powered tool like Cursor IDE that initiates requests
2. **Flutter Tools MCP Server**: Middleware that interprets requests and controls Flutter processes
3. **Flutter Process**: Actual Flutter app instance that runs on a device or emulator

## 🔧 Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `startApp` | Start a Flutter app | `projectPath`, `deviceId` (optional) |
| `stopApp` | Stop a running app | `appId` |
| `getLogs` | Get logs from app | `appId`, `limit` (optional), `filter` (optional) |
| `takeScreenshot` | Capture screen | `appId` |
| `getNetworkData` | Get network requests | `appId`, `limit` (optional) |
| `getPerformanceData` | Get performance metrics | `appId` |
| `hotReload` | Trigger hot reload | `appId` |
| `listRunningApps` | List all running apps | None |

## 📦 Requirements

- Node.js 18 or higher
- Flutter SDK installed and available in PATH
- For Android: ADB installed and available in PATH
- For iOS: macOS with Xcode and iOS Simulator

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting PRs.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 