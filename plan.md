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

We can significantly improve the architecture by adopting a similar approach to the browser-tools-mcp implementation, which uses a two-component system:

1. **Flutter Connector Server**
   - A standalone service that runs continuously in the background
   - Automatically discovers and monitors all Flutter applications (both those started by the tools and externally)
   - Collects logs, performance metrics, and other data in real-time
   - Provides a REST API for the MCP server to query

2. **Flutter Tools MCP Server**
   - Connects to the Flutter Connector Server when tools are invoked
   - Requests specific data from the connector rather than collecting it directly
   - Focuses on providing a clean tool interface and processing data for AI consumption

## Implementation Plan

### Phase 1: Flutter Connector Server

1. Create a standalone server application:
   - Express.js server similar to browser-connector.ts
   - Configurable port (default: 3030)
   - Identity endpoint for MCP server discovery

2. Implement Flutter app discovery mechanisms:
   - Monitor running processes to detect Flutter apps
   - Scan log files in standard locations
   - Identify apps via VM service protocol (Dart Observatory)
   - Support for manual registration of apps

3. Build log collection functionality:
   - Continuously collect logs from detected apps
   - Parse and structure log data for easier consumption
   - Maintain log history with configurable limits

4. Add performance metrics collection:
   - Connect to VM service for memory/CPU metrics
   - Track startup time, frame rate, and other performance indicators
   - Collect network request information when possible

5. Create REST API endpoints:
   - GET `/apps` - List all detected Flutter apps
   - GET `/apps/:id/logs` - Get logs for a specific app
   - GET `/apps/:id/metrics` - Get performance metrics
   - POST `/apps/:id/hot-reload` - Trigger hot reload
   - POST `/screenshot/:id` - Capture screenshot
   - Additional endpoints for other operations

### Phase 2: Update MCP Server

1. Modify the existing Flutter tools MCP server:
   - Add connector discovery similar to browser-tools-mcp
   - Update tool implementations to query the connector server
   - Handle connection errors and fallbacks

2. Enhance tool functions:
   - Update all tool functions to use the connector server
   - Add robust error handling for connector server communication
   - Implement reconnection logic for reliability

3. Add new capabilities:
   - System-wide Flutter app monitoring (not just MCP-started apps)
   - Better visualization of app performance data
   - More detailed network request monitoring

### Phase 3: Additional Features

1. Enhanced device management:
   - Better detection of connected devices
   - Support for custom device configurations
   - Improved device selection logic

2. Extended debugging capabilities:
   - Integration with Flutter DevTools
   - Support for more complex debugging scenarios
   - Custom instrumentation options

3. Analytics and insights:
   - Trend analysis for performance metrics
   - Anomaly detection for app behavior
   - Recommendations for performance improvements

## Implementation Schedule

1. **Week 1-2**: Develop core Flutter Connector Server
   - Basic app discovery and monitoring
   - Log collection functionality
   - Initial REST API endpoints

2. **Week 3**: Update MCP Server tools
   - Connector discovery implementation
   - Update existing tools to use connector
   - Testing and debugging

3. **Week 4**: Refinement and additional features
   - Enhance connector capabilities
   - Add new tools and features
   - Documentation and polishing

## Technical Considerations

1. **Cross-platform Support**:
   - Ensure Windows, macOS, and Linux compatibility
   - Handle platform-specific paths and commands

2. **Security**:
   - Implement authentication for connector API
   - Consider encrypting sensitive data

3. **Performance**:
   - Optimize log collection for minimal overhead
   - Implement efficient data storage and retrieval

4. **Reliability**:
   - Robust error handling
   - Graceful degradation when services are unavailable
   - Self-healing mechanisms

## Future Extensions

1. Integration with cloud services for remote debugging
2. Support for custom plugins to extend functionality
3. Historical data analysis for performance trends
4. CI/CD integration for automated testing 