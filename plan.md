# Flutter Tools Architecture Improvement Plan

## Current State Analysis

The current flutter-tools-mcp implementation attempts to:
- Start/stop Flutter applications
- Gather logs, metrics, and screenshots directly within MCP tool functions
- Perform operations like hot reloads directly within the MCP server process

This approach has limitations:
1. The MCP server only collects data when a tool is explicitly invoked
2. There's no continuous background monitoring of Flutter apps
3. Apps started outside the MCP tools are harder to discover and monitor
4. Performance and reliability issues may occur when handling multiple apps

## Architecture Enhancement Proposal

We can significantly improve the architecture by adopting a similar approach to the browser-tools-mcp implementation, which uses a three-component system:

1. **Flutter Connector Server**
   - A standalone service that runs continuously in the background
   - Automatically discovers and monitors all Flutter applications (both those started by the tools and externally)
   - Connects to Flutter's VM Service Protocol to collect data
   - Collects logs, performance metrics, network activity, and other data in real-time
   - Provides a REST API for the MCP server to query

2. **Flutter Tools MCP Server**
   - Connects to the Flutter Connector Server when tools are invoked
   - Requests specific data from the connector rather than collecting it directly
   - Focuses on providing a clean tool interface and processing data for AI consumption

3. **Flutter App Integration** 
   - Instead of a browser extension, we use Flutter's built-in debugging capabilities
   - VM Service Protocol provides access to app metrics, logs, and state
   - Optional lightweight helper package for enhanced monitoring

## Detailed Implementation Checklist

### Phase 1: Flutter Connector Server

#### Step 1: Project Setup and Dependencies
- [ ] Initialize TypeScript/Node.js project with package.json
- [ ] Add dependencies:
  - [ ] express - for REST API server
  - [ ] ws - for WebSocket connections to VM Service
  - [ ] cors - for cross-origin resource sharing
  - [ ] body-parser - for parsing HTTP request bodies
  - [ ] node-fetch - for HTTP requests
  - [ ] typescript - for type safety
  - [ ] ts-node - for running TypeScript
  - [ ] @types/* packages for type definitions

#### Step 2: Core Data Structures
- [ ] Define interfaces for Flutter apps
  - [ ] App identification (id, name, port)
  - [ ] Device information
  - [ ] Connection status
- [ ] Define interfaces for collected data
  - [ ] Log entry structure
  - [ ] Performance metrics structure
  - [ ] Network request/response structure

#### Step 3: VM Service Protocol Client
- [ ] Implement WebSocket connection to VM Service
- [ ] Create JSON-RPC message handling
- [ ] Implement VM Service API methods:
  - [ ] getVM - Get VM information
  - [ ] getIsolate - Get isolate details
  - [ ] streamListen - Subscribe to event streams
  - [ ] getMemoryUsage - Get memory statistics
  - [ ] callExtensionMethod - Call Flutter extension methods

#### Step 4: App Discovery Mechanism
- [ ] Implement port scanning for VM services
- [ ] Create process monitoring to detect Flutter processes
- [ ] Build connection management system
- [ ] Implement app tracking across restarts

#### Step 5: Data Collection System
- [ ] Implement log collection from Stdout/Stderr streams
- [ ] Create metrics collection using VM Service methods
- [ ] Set up network request monitoring
- [ ] Implement screenshot capture feature
- [ ] Build storage system with configurable limits

#### Step 6: REST API Server
- [ ] Create Express server setup
- [ ] Implement server identity endpoint
- [ ] Create app listing endpoint
- [ ] Implement data access endpoints:
  - [ ] Logs retrieval
  - [ ] Metrics retrieval
  - [ ] Network request retrieval
  - [ ] UI tree retrieval
- [ ] Implement action endpoints:
  - [ ] Hot reload
  - [ ] Screenshot capture
  - [ ] Custom command execution

#### Step 7: Error Handling and Reliability
- [ ] Implement connection error handling
- [ ] Add reconnection logic
- [ ] Create health monitoring
- [ ] Implement data validation
- [ ] Add request timeout handling

### Phase 2: Flutter Tools MCP Server

#### Step 1: Project Setup and Dependencies
- [ ] Initialize MCP server project
- [ ] Add dependencies:
  - [ ] @modelcontextprotocol/sdk - MCP SDK
  - [ ] node-fetch - for HTTP requests
  - [ ] zod - for schema validation
  - [ ] typescript - for type safety

#### Step 2: Connector Service
- [ ] Implement connector discovery mechanism
- [ ] Create connection management system
- [ ] Build data retrieval methods

#### Step 3: MCP Tools Implementation
- [ ] Set up MCP server with basic configuration
- [ ] Implement tools:
  - [ ] getFlutterApps - List all running Flutter apps
  - [ ] getAppLogs - Get logs for a specific app
  - [ ] getPerformanceMetrics - Get app performance metrics
  - [ ] getNetworkActivity - View network requests
  - [ ] getWidgetTree - Examine UI component hierarchy
  - [ ] captureScreenshot - Take a screenshot of the app
  - [ ] hotReload - Trigger a hot reload
  - [ ] inspectMemory - Analyze memory usage
  - [ ] analyzeCrash - Debug crash reports

#### Step 4: Error Handling and Data Processing
- [ ] Create error handling for connector issues
- [ ] Implement data formatting for AI consumption
- [ ] Build progress reporting for long operations
- [ ] Add timeout handling

### Phase 3: Flutter Integration Package (Optional)

#### Step 1: Project Setup
- [ ] Create Flutter package project
- [ ] Setup pubspec.yaml with dependencies

#### Step 2: Network Monitoring
- [ ] Implement HTTP request/response interceptor
- [ ] Create VM service extension for network data access

#### Step 3: Performance Monitoring
- [ ] Implement widget rebuild tracking
- [ ] Create custom performance event system
- [ ] Build memory leak detection helpers

#### Step 4: Integration API
- [ ] Create simple initialization API
- [ ] Implement configuration options
- [ ] Build documentation and examples

## Technical Implementation

### Flutter Connector Server

#### Core Components

1. **App Discovery Mechanism**
   - Monitor running processes to detect Flutter debug ports
   - Scan standard port ranges (8000-9000) for VM services 
   - Support manual registration of apps
   - Track apps across restarts by app ID

2. **VM Service Protocol Integration**
   - Connect to Dart Observatory API (VM Service)
   - Monitor isolate state and performance
   - Stream logs from standard output and error channels
   - Collect memory usage, CPU metrics, and frame times
   - Support screenshot capture

3. **Event Monitoring System**
   - Continuous log collection with rotating buffer
   - Real-time performance metric tracking
   - Network request monitoring
   - UI event tracking

4. **REST API Layer**
   - Expose standardized endpoints for data access
   - Support filtering and querying of collected data
   - Implement server discovery via identity endpoint
   - Provide real-time data access

#### Key API Endpoints

```
GET /apps                       - List all detected Flutter apps
GET /apps/:id                   - Get details for a specific app
GET /apps/:id/logs              - Get logs for a specific app
GET /apps/:id/metrics           - Get performance metrics
GET /apps/:id/network           - Get network requests
GET /apps/:id/ui                - Get widget tree information
POST /apps/:id/hot-reload       - Trigger hot reload
POST /apps/:id/screenshot       - Capture screenshot
GET /.identity                  - Server identification endpoint
```

### Flutter Tools MCP Server

#### MCP Tool Integration

1. **Server Discovery**
   - Automatic discovery of Flutter Connector Server
   - Support for port configuration
   - Fallback to direct VM service connection if connector unavailable

2. **Tool Implementation**
   - `getFlutterApps` - List all running Flutter apps
   - `getAppLogs` - Get logs for a specific app
   - `getPerformanceMetrics` - Get app performance metrics
   - `getNetworkActivity` - View network requests
   - `getWidgetTree` - Examine UI component hierarchy
   - `captureScreenshot` - Take a screenshot of the app
   - `hotReload` - Trigger a hot reload
   - `inspectMemory` - Analyze memory usage
   - `analyzeCrash` - Debug crash reports

3. **Data Processing Pipeline**
   - Structured log parsing and formatting for AI consumption
   - Performance data visualization preparation
   - Network traffic analysis
   - Crash and error context collection

### Flutter App Integration

1. **VM Service Protocol Usage**
   - Leverage existing Flutter debug protocol
   - No modification required for most apps
   - Works with any Flutter app in debug mode

2. **Optional Helper Package**
   - Enhanced logging support
   - Custom performance events
   - Network request/response logging
   - Widget rebuild tracking

## Technical Implementation Details

### Flutter Connector Server

```typescript
// Core server architecture
class FlutterConnectorServer {
  private apps: Map<string, FlutterAppConnection> = new Map();
  private logStorage: Map<string, LogEntry[]> = new Map();
  private metricsStorage: Map<string, PerformanceMetrics[]> = new Map();
  private networkStorage: Map<string, NetworkRequest[]> = new Map();
  
  constructor(private config: ServerConfig) {
    this.initializeServer();
    this.startAppDiscovery();
  }
  
  private async startAppDiscovery() {
    // Periodically scan for new Flutter apps
    setInterval(async () => {
      const newApps = await this.discoverFlutterApps();
      for (const app of newApps) {
        if (!this.apps.has(app.id)) {
          await this.connectToApp(app);
        }
      }
    }, this.config.discoveryInterval);
  }
  
  private async connectToApp(app: FlutterApp) {
    try {
      // Connect to VM Service
      const connection = new FlutterAppConnection(app);
      await connection.connect();
      
      // Set up event listeners
      connection.on('log', (log) => this.storeLog(app.id, log));
      connection.on('metrics', (metrics) => this.storeMetrics(app.id, metrics));
      connection.on('network', (request) => this.storeNetwork(app.id, request));
      
      this.apps.set(app.id, connection);
      console.log(`Connected to Flutter app: ${app.name} (${app.id})`);
    } catch (error) {
      console.error(`Failed to connect to app ${app.id}:`, error);
    }
  }
  
  // API Endpoints implementation
  private initializeServer() {
    const app = express();
    
    // List all apps
    app.get('/apps', (req, res) => {
      const appList = Array.from(this.apps.values()).map(conn => conn.getAppInfo());
      res.json(appList);
    });
    
    // Get app logs
    app.get('/apps/:id/logs', (req, res) => {
      const logs = this.logStorage.get(req.params.id) || [];
      res.json(logs);
    });
    
    // Add other endpoints...
    
    app.listen(this.config.port, () => {
      console.log(`Flutter Connector Server running on port ${this.config.port}`);
    });
  }
}
```

### VM Service Protocol Integration

```typescript
class FlutterAppConnection extends EventEmitter {
  private vmService: VmServiceClient;
  private isConnected = false;
  
  constructor(private app: FlutterApp) {
    super();
  }
  
  async connect() {
    const uri = `ws://localhost:${this.app.port}/ws`;
    this.vmService = await connectToVmService(uri);
    
    // Set up stream listeners
    await this.vmService.streamListen('Stdout');
    await this.vmService.streamListen('Stderr');
    await this.vmService.streamListen('Extension');
    
    // Handle log events
    this.vmService.onEvent('Stdout', (event) => {
      this.emit('log', {
        level: 'info',
        message: event.log,
        timestamp: new Date().toISOString()
      });
    });
    
    this.vmService.onEvent('Stderr', (event) => {
      this.emit('log', {
        level: 'error',
        message: event.log,
        timestamp: new Date().toISOString()
      });
    });
    
    // Start collecting metrics
    this.startMetricsCollection();
    
    this.isConnected = true;
  }
  
  async startMetricsCollection() {
    // Collect metrics every second
    setInterval(async () => {
      if (!this.isConnected) return;
      
      try {
        const metrics = await this.getMetrics();
        this.emit('metrics', {
          ...metrics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to collect metrics:', error);
      }
    }, 1000);
  }
  
  async getMetrics() {
    const vm = await this.vmService.getVM();
    const isolateId = vm.isolates[0].id;
    
    // Get memory stats
    const memoryUsage = await this.vmService.getMemoryUsage(isolateId);
    
    // Get UI stats if available
    let uiMetrics = {};
    try {
      const result = await this.vmService.callExtensionMethod('ext.flutter.inspector.stats');
      uiMetrics = result.response;
    } catch (e) {
      // UI extension might not be available
    }
    
    return {
      memory: {
        heapUsage: memoryUsage.heapUsage,
        heapCapacity: memoryUsage.heapCapacity,
        externalUsage: memoryUsage.externalUsage
      },
      ui: uiMetrics
    };
  }
  
  async captureScreenshot() {
    try {
      const result = await this.vmService.callExtensionMethod('ext.flutter.inspector.screenshot');
      return result.response.data; // Base64 encoded image
    } catch (error) {
      throw new Error(`Failed to capture screenshot: ${error.message}`);
    }
  }
  
  async hotReload() {
    try {
      const vm = await this.vmService.getVM();
      const isolateId = vm.isolates[0].id;
      const result = await this.vmService.callExtensionMethod('ext.flutter.reassemble', {isolateId});
      return {success: true};
    } catch (error) {
      throw new Error(`Hot reload failed: ${error.message}`);
    }
  }
  
  getAppInfo() {
    return {
      id: this.app.id,
      name: this.app.name,
      deviceType: this.app.deviceType,
      startTime: this.app.startTime,
      status: this.isConnected ? 'connected' : 'disconnected'
    };
  }
}
```

### Flutter Tools MCP Server

```typescript
// MCP Server implementation
class FlutterToolsMcpServer {
  private server: McpServer;
  private connectorService: ConnectorService;
  private connected = false;
  
  constructor() {
    this.server = new McpServer({
      name: "Flutter Tools MCP",
      version: "1.0.0"
    });
    
    this.connectorService = new ConnectorService();
    this.setupTools();
  }
  
  private async setupTools() {
    // Tool: List Flutter apps
    this.server.tool("getFlutterApps", "List all running Flutter apps", async () => {
      await this.ensureConnected();
      const apps = await this.connectorService.getApps();
      return {
        content: [{ type: "text", text: JSON.stringify(apps, null, 2) }]
      };
    });
    
    // Tool: Get logs
    this.server.tool("getAppLogs", "Get logs for a Flutter app", 
                     { appId: z.string() }, 
                     async ({ appId }) => {
      await this.ensureConnected();
      const logs = await this.connectorService.getLogs(appId);
      return {
        content: [{ type: "text", text: JSON.stringify(logs, null, 2) }]
      };
    });
    
    // Other tools for metrics, network, UI inspection, etc.
  }
  
  private async ensureConnected() {
    if (!this.connected) {
      this.connected = await this.connectorService.discoverAndConnect();
      if (!this.connected) {
        throw new Error("Could not connect to Flutter Connector Server");
      }
    }
  }
  
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

## Implementation Schedule

1. **Week 1-2**: Flutter Connector Server Development
   - Implement VM Service Protocol integration
   - Build app discovery mechanism
   - Create log and metrics collection system
   - Develop REST API endpoints

2. **Week 3**: Optional Flutter Integration Package
   - Create lightweight Flutter package for enhanced monitoring
   - Implement network request tracking
   - Add custom performance event tracking
   - Develop widget rebuild monitoring

3. **Week 4**: Flutter Tools MCP Server 
   - Build connector discovery and connection management
   - Implement MCP tools interface
   - Create data processing and formatting for AI consumption
   - Develop error handling and recovery

4. **Week 5**: Integration Testing and Refinement
   - Test with various Flutter apps
   - Optimize performance and reliability
   - Enhance error handling
   - Improve documentation

## Future Extensions

1. **Advanced Debugging**
   - Visual widget tree exploration
   - State management analysis
   - Performance bottleneck detection
   - Memory leak detection

2. **Analytics Dashboard**
   - Real-time metrics visualization
   - Historical performance tracking
   - Crash analysis tools
   - Usage insights

3. **CI/CD Integration**
   - Automated testing integration
   - Performance regression detection
   - Build and deployment tools
   - Device lab integration

4. **Multi-Device Support**
   - Simultaneous monitoring of multiple devices
   - Cross-device performance comparison
   - Synchronized testing across platforms
   - Remote device debugging support

## Technical Requirements

### Development Environment
- Node.js 14+ for server components
- TypeScript for type safety and maintainability
- Express for REST API implementation
- Flutter SDK for testing and integration

### Deployment Requirements
- Works on Windows, macOS, and Linux
- Minimal dependencies for easy installation
- Support for remote debugging scenarios
- Compatible with Flutter 2.0+ applications 