/**
 * Start Script for MCP and Flutter Connector Servers
 * 
 * This script starts both the MCP server and the Flutter Connector Server
 * in parallel using child processes.
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Configuration
const FLUTTER_CONNECTOR_PORT = process.env.FLUTTER_CONNECTOR_PORT || 3030;
const MCP_PORT = process.env.MCP_PORT || 3000;

// Colors for console output
const colors = {
  mcp: '\x1b[36m',      // Cyan
  connector: '\x1b[32m', // Green
  error: '\x1b[31m',     // Red
  reset: '\x1b[0m'       // Reset
};

// Get current working directory
const cwd = process.cwd();
const mcpPath = path.join(cwd, 'mcp');
const connectorPath = path.join(cwd, 'flutter-connector-server');

// Utility function to log with timestamps and colors
function log(source, message, isError = false) {
  const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
  const color = isError ? colors.error : (source === 'MCP' ? colors.mcp : colors.connector);
  console.log(`${timestamp} ${color}[${source}]${colors.reset} ${message}`);
}

// Start MCP Server
function startMcpServer() {
  log('Main', 'Starting MCP Server...');
  
  const npm = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
  const mcpServer = spawn(npm, ['start'], { cwd: mcpPath });
  
  mcpServer.stdout.on('data', (data) => {
    data.toString().split('\n').filter(line => line.trim()).forEach(line => {
      log('MCP', line);
    });
  });
  
  mcpServer.stderr.on('data', (data) => {
    data.toString().split('\n').filter(line => line.trim()).forEach(line => {
      log('MCP', line, true);
    });
  });
  
  mcpServer.on('close', (code) => {
    if (code !== 0) {
      log('Main', `MCP Server process exited with code ${code}`, true);
    } else {
      log('Main', 'MCP Server stopped');
    }
  });
  
  return mcpServer;
}

// Start Flutter Connector Server
function startFlutterConnectorServer() {
  log('Main', 'Starting Flutter Connector Server...');
  
  const npm = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
  const connectorServer = spawn(npm, ['start'], { cwd: connectorPath });
  
  connectorServer.stdout.on('data', (data) => {
    data.toString().split('\n').filter(line => line.trim()).forEach(line => {
      log('Connector', line);
    });
  });
  
  connectorServer.stderr.on('data', (data) => {
    data.toString().split('\n').filter(line => line.trim()).forEach(line => {
      log('Connector', line, true);
    });
  });
  
  connectorServer.on('close', (code) => {
    if (code !== 0) {
      log('Main', `Flutter Connector Server process exited with code ${code}`, true);
    } else {
      log('Main', 'Flutter Connector Server stopped');
    }
  });
  
  return connectorServer;
}

// Handle process termination
function setupProcessHandlers(mcpProcess, connectorProcess) {
  const cleanup = () => {
    log('Main', 'Shutting down servers...');
    
    // Send SIGTERM to child processes
    mcpProcess.kill();
    connectorProcess.kill();
  };
  
  // Handle various termination signals
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGHUP', cleanup);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    log('Main', `Uncaught exception: ${err.message}`, true);
    cleanup();
    process.exit(1);
  });
}

// Main function
function main() {
  log('Main', `Starting servers with configuration:
  - Flutter Connector Server Port: ${FLUTTER_CONNECTOR_PORT}
  - MCP Server Port: ${MCP_PORT}
  `);
  
  // Set environment variables for child processes
  process.env.FLUTTER_CONNECTOR_PORT = FLUTTER_CONNECTOR_PORT;
  process.env.MCP_PORT = MCP_PORT;
  
  // Start both servers
  const connectorProcess = startFlutterConnectorServer();
  
  // Give the connector server a head start
  setTimeout(() => {
    const mcpProcess = startMcpServer();
    setupProcessHandlers(mcpProcess, connectorProcess);
  }, 2000);
  
  log('Main', 'All servers started. Press Ctrl+C to stop.');
}

// Run the main function
main(); 