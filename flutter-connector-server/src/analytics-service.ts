/**
 * Flutter App Analytics Service
 * 
 * This module provides analytics and insights for Flutter applications:
 * - Collecting and storing time-series performance data
 * - Analyzing performance trends
 * - Detecting performance anomalies
 * - Generating performance recommendations
 */

import { FlutterApp } from './app-manager.js';
import { logger } from './utils/logger.js';

// Performance metrics threshold constants
const PERFORMANCE_THRESHOLDS = {
  HIGH_CPU_USAGE: 80, // 80%
  HIGH_MEMORY_USAGE: 200, // 200 MB
  LOW_FRAME_RATE: 40, // Below 40 FPS
  STARTUP_TIME_SLOW: 3000, // 3 seconds
  NETWORK_REQUEST_SLOW: 1000, // 1 second
};

// Metric types
type MetricType = 'cpu' | 'memory' | 'frameRate' | 'startupTime' | 'networkLatency';

// Analytics data point
interface AnalyticsDataPoint {
  timestamp: number;
  appId: string;
  metricType: MetricType;
  value: number;
  metadata?: Record<string, any>;
}

// Performance anomaly
interface PerformanceAnomaly {
  appId: string;
  metricType: MetricType;
  timestamp: number;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// Performance trend
interface PerformanceTrend {
  appId: string;
  metricType: MetricType;
  startTime: number;
  endTime: number;
  startValue: number;
  endValue: number;
  changePercent: number;
  changeDirection: 'improving' | 'degrading' | 'stable';
  description: string;
}

// Performance recommendation
interface PerformanceRecommendation {
  appId: string;
  metricType: MetricType;
  severity: 'low' | 'medium' | 'high';
  issue: string;
  recommendation: string;
  relatedAnomalies?: PerformanceAnomaly[];
  relatedTrends?: PerformanceTrend[];
}

// Performance insight
interface PerformanceInsight {
  anomalies: PerformanceAnomaly[];
  trends: PerformanceTrend[];
  recommendations: PerformanceRecommendation[];
}

// Store analytics data - memory-based implementation for now
// In a production environment, this would use a time-series database
const analyticsData: AnalyticsDataPoint[] = [];
const anomalies: PerformanceAnomaly[] = [];
const trends: PerformanceTrend[] = [];
const recommendations: PerformanceRecommendation[] = [];

// Maximum data points to keep in memory
const MAX_DATA_POINTS = 10000;

/**
 * Record a performance metric
 */
export function recordMetric(
  appId: string,
  metricType: MetricType,
  value: number,
  metadata?: Record<string, any>
): void {
  const dataPoint: AnalyticsDataPoint = {
    timestamp: Date.now(),
    appId,
    metricType,
    value,
    metadata,
  };
  
  // Add to analytics data
  analyticsData.push(dataPoint);
  
  // Limit the number of data points
  if (analyticsData.length > MAX_DATA_POINTS) {
    // Remove oldest data points
    analyticsData.splice(0, analyticsData.length - MAX_DATA_POINTS);
  }
  
  // Check for anomalies
  checkForAnomalies(dataPoint);
  
  // Update trends periodically (every 10 data points)
  if (analyticsData.length % 10 === 0) {
    updateTrends();
    updateRecommendations();
  }
}

/**
 * Record multiple metrics at once
 */
export function recordMetrics(
  appId: string,
  metrics: Record<MetricType, number>,
  metadata?: Record<string, any>
): void {
  Object.entries(metrics).forEach(([metricType, value]) => {
    recordMetric(appId, metricType as MetricType, value, metadata);
  });
}

/**
 * Check for performance anomalies based on thresholds
 */
function checkForAnomalies(dataPoint: AnalyticsDataPoint): void {
  const { appId, metricType, value, timestamp } = dataPoint;
  
  let threshold: number = 0;
  let severity: 'low' | 'medium' | 'high' = 'low';
  let description: string = '';
  
  switch (metricType) {
    case 'cpu':
      threshold = PERFORMANCE_THRESHOLDS.HIGH_CPU_USAGE;
      if (value >= threshold) {
        severity = value >= threshold * 1.2 ? 'high' : 'medium';
        description = `High CPU usage detected: ${value.toFixed(1)}%`;
        createAnomaly(appId, metricType, timestamp, value, threshold, severity, description);
      }
      break;
    case 'memory':
      threshold = PERFORMANCE_THRESHOLDS.HIGH_MEMORY_USAGE;
      if (value >= threshold) {
        severity = value >= threshold * 1.5 ? 'high' : 'medium';
        description = `High memory usage detected: ${value.toFixed(1)} MB`;
        createAnomaly(appId, metricType, timestamp, value, threshold, severity, description);
      }
      break;
    case 'frameRate':
      threshold = PERFORMANCE_THRESHOLDS.LOW_FRAME_RATE;
      if (value < threshold) {
        severity = value < threshold * 0.7 ? 'high' : 'medium';
        description = `Low frame rate detected: ${value.toFixed(1)} FPS`;
        createAnomaly(appId, metricType, timestamp, value, threshold, severity, description);
      }
      break;
    case 'startupTime':
      threshold = PERFORMANCE_THRESHOLDS.STARTUP_TIME_SLOW;
      if (value > threshold) {
        severity = value > threshold * 1.5 ? 'high' : 'medium';
        description = `Slow startup time detected: ${value.toFixed(0)} ms`;
        createAnomaly(appId, metricType, timestamp, value, threshold, severity, description);
      }
      break;
    case 'networkLatency':
      threshold = PERFORMANCE_THRESHOLDS.NETWORK_REQUEST_SLOW;
      if (value > threshold) {
        severity = value > threshold * 1.5 ? 'high' : 'medium';
        description = `Slow network request detected: ${value.toFixed(0)} ms`;
        createAnomaly(appId, metricType, timestamp, value, threshold, severity, description);
      }
      break;
  }
}

/**
 * Create and store a performance anomaly
 */
function createAnomaly(
  appId: string,
  metricType: MetricType,
  timestamp: number,
  value: number,
  threshold: number,
  severity: 'low' | 'medium' | 'high',
  description: string
): void {
  const anomaly: PerformanceAnomaly = {
    appId,
    metricType,
    timestamp,
    value,
    threshold,
    severity,
    description,
  };
  
  anomalies.push(anomaly);
  
  // Limit the number of anomalies to keep (keep last 100)
  if (anomalies.length > 100) {
    anomalies.shift();
  }
  
  // Log high severity anomalies
  if (severity === 'high') {
    logger.warn(`Performance anomaly detected: ${description} for app ${appId}`);
  }
}

/**
 * Update performance trends based on collected data
 */
function updateTrends(): void {
  // Clear old trends
  trends.length = 0;
  
  // Get unique app IDs
  const appIds = [...new Set(analyticsData.map(point => point.appId))];
  
  // Get unique metric types
  const metricTypes = [...new Set(analyticsData.map(point => point.metricType))];
  
  // For each app and metric type, analyze trend
  for (const appId of appIds) {
    for (const metricType of metricTypes) {
      analyzeTrend(appId, metricType as MetricType);
    }
  }
}

/**
 * Analyze trend for a specific app and metric
 */
function analyzeTrend(appId: string, metricType: MetricType): void {
  // Get data points for this app and metric, sorted by timestamp
  const dataPoints = analyticsData
    .filter(point => point.appId === appId && point.metricType === metricType)
    .sort((a, b) => a.timestamp - b.timestamp);
  
  // Need at least 5 data points to establish a trend
  if (dataPoints.length < 5) {
    return;
  }
  
  // Split the data into segments (last hour, last day)
  const now = Date.now();
  const lastHour = now - (60 * 60 * 1000);
  const lastDay = now - (24 * 60 * 60 * 1000);
  
  const lastHourPoints = dataPoints.filter(point => point.timestamp >= lastHour);
  const lastDayPoints = dataPoints.filter(point => point.timestamp >= lastDay);
  
  // Analyze short-term trend (last hour)
  if (lastHourPoints.length >= 5) {
    createTrendFromDataPoints(appId, metricType, lastHourPoints, 'short-term');
  }
  
  // Analyze long-term trend (last day)
  if (lastDayPoints.length >= 5) {
    createTrendFromDataPoints(appId, metricType, lastDayPoints, 'long-term');
  }
}

/**
 * Create a trend from a set of data points
 */
function createTrendFromDataPoints(
  appId: string,
  metricType: MetricType,
  dataPoints: AnalyticsDataPoint[],
  trendType: 'short-term' | 'long-term'
): void {
  // Get first and last data points
  const firstPoint = dataPoints[0];
  const lastPoint = dataPoints[dataPoints.length - 1];
  
  // Calculate change
  const startValue = firstPoint.value;
  const endValue = lastPoint.value;
  const changeValue = endValue - startValue;
  
  // Calculate percent change
  const changePercent = startValue !== 0 ? (changeValue / Math.abs(startValue)) * 100 : 0;
  
  // Determine if it's a significant change (more than 10%)
  if (Math.abs(changePercent) < 10) {
    return; // Not a significant trend
  }
  
  // Determine trend direction
  let changeDirection: 'improving' | 'degrading' | 'stable' = 'stable';
  
  // For each metric type, define what's 'improving' vs 'degrading'
  switch (metricType) {
    case 'cpu':
    case 'memory':
    case 'startupTime':
    case 'networkLatency':
      // For these metrics, lower is better
      changeDirection = changeValue < 0 ? 'improving' : 'degrading';
      break;
      
    case 'frameRate':
      // For frame rate, higher is better
      changeDirection = changeValue > 0 ? 'improving' : 'degrading';
      break;
  }
  
  // Create description
  const timeFrame = trendType === 'short-term' ? 'the last hour' : 'the last day';
  let description = '';
  
  switch (metricType) {
    case 'cpu':
      description = `CPU usage has ${changeDirection === 'improving' ? 'decreased' : 'increased'} by ${Math.abs(changePercent).toFixed(1)}% over ${timeFrame}`;
      break;
    case 'memory':
      description = `Memory usage has ${changeDirection === 'improving' ? 'decreased' : 'increased'} by ${Math.abs(changePercent).toFixed(1)}% over ${timeFrame}`;
      break;
    case 'frameRate':
      description = `Frame rate has ${changeDirection === 'improving' ? 'improved' : 'degraded'} by ${Math.abs(changePercent).toFixed(1)}% over ${timeFrame}`;
      break;
    case 'startupTime':
      description = `Startup time has ${changeDirection === 'improving' ? 'improved' : 'degraded'} by ${Math.abs(changePercent).toFixed(1)}% over ${timeFrame}`;
      break;
    case 'networkLatency':
      description = `Network latency has ${changeDirection === 'improving' ? 'decreased' : 'increased'} by ${Math.abs(changePercent).toFixed(1)}% over ${timeFrame}`;
      break;
  }
  
  // Create the trend
  const trend: PerformanceTrend = {
    appId,
    metricType,
    startTime: firstPoint.timestamp,
    endTime: lastPoint.timestamp,
    startValue,
    endValue,
    changePercent,
    changeDirection,
    description,
  };
  
  trends.push(trend);
  
  // Log significant trends
  if (Math.abs(changePercent) > 20) {
    const logMethod = changeDirection === 'degrading' ? logger.warn : logger.info;
    logMethod(`Performance trend detected: ${description} for app ${appId}`);
  }
}

/**
 * Update performance recommendations based on anomalies and trends
 */
function updateRecommendations(): void {
  // Clear old recommendations
  recommendations.length = 0;
  
  // Get unique app IDs
  const appIds = [...new Set([
    ...anomalies.map(anomaly => anomaly.appId),
    ...trends.map(trend => trend.appId),
  ])];
  
  // For each app, generate recommendations
  for (const appId of appIds) {
    // Get anomalies for this app
    const appAnomalies = anomalies.filter(anomaly => anomaly.appId === appId);
    
    // Get trends for this app
    const appTrends = trends.filter(trend => trend.appId === appId);
    
    // Check for specific issues and generate recommendations
    
    // High CPU usage issues
    const cpuAnomalies = appAnomalies.filter(anomaly => 
      anomaly.metricType === 'cpu' && anomaly.severity !== 'low'
    );
    
    if (cpuAnomalies.length > 0) {
      const severity = cpuAnomalies.some(a => a.severity === 'high') ? 'high' : 'medium';
      
      recommendations.push({
        appId,
        metricType: 'cpu',
        severity,
        issue: 'High CPU usage detected in the application',
        recommendation: 'Consider optimizing compute-intensive operations, reducing unnecessary rebuilds, and using compute operations on background isolates.',
        relatedAnomalies: cpuAnomalies,
      });
    }
    
    // High memory usage issues
    const memoryAnomalies = appAnomalies.filter(anomaly => 
      anomaly.metricType === 'memory' && anomaly.severity !== 'low'
    );
    
    if (memoryAnomalies.length > 0) {
      const severity = memoryAnomalies.some(a => a.severity === 'high') ? 'high' : 'medium';
      
      recommendations.push({
        appId,
        metricType: 'memory',
        severity,
        issue: 'High memory usage detected in the application',
        recommendation: 'Look for memory leaks, optimize image caching, and reduce unnecessary object allocations. Consider using DevTools memory profiler to identify specific issues.',
        relatedAnomalies: memoryAnomalies,
      });
    }
    
    // Low frame rate issues
    const frameRateAnomalies = appAnomalies.filter(anomaly => 
      anomaly.metricType === 'frameRate' && anomaly.severity !== 'low'
    );
    
    if (frameRateAnomalies.length > 0) {
      const severity = frameRateAnomalies.some(a => a.severity === 'high') ? 'high' : 'medium';
      
      recommendations.push({
        appId,
        metricType: 'frameRate',
        severity,
        issue: 'Low frame rate detected in the application',
        recommendation: 'Optimize widget rebuilds, use RepaintBoundary wisely, simplify complex layouts, and reduce work on the UI thread. Consider using Flutter DevTools performance view to identify jank.',
        relatedAnomalies: frameRateAnomalies,
      });
    }
    
    // Slow startup time
    const startupAnomalies = appAnomalies.filter(anomaly => 
      anomaly.metricType === 'startupTime' && anomaly.severity !== 'low'
    );
    
    if (startupAnomalies.length > 0) {
      const severity = startupAnomalies.some(a => a.severity === 'high') ? 'high' : 'medium';
      
      recommendations.push({
        appId,
        metricType: 'startupTime',
        severity,
        issue: 'Slow application startup time detected',
        recommendation: 'Consider using deferred loading, optimizing initialization code, reducing the app size, and moving heavy initialization work to background tasks after the UI is displayed.',
        relatedAnomalies: startupAnomalies,
      });
    }
    
    // Network latency issues
    const networkAnomalies = appAnomalies.filter(anomaly => 
      anomaly.metricType === 'networkLatency' && anomaly.severity !== 'low'
    );
    
    if (networkAnomalies.length > 0) {
      const severity = networkAnomalies.some(a => a.severity === 'high') ? 'high' : 'medium';
      
      recommendations.push({
        appId,
        metricType: 'networkLatency',
        severity,
        issue: 'Slow network requests detected in the application',
        recommendation: 'Implement caching strategies, optimize API calls, reduce payload sizes, and use appropriate timeout settings. Consider implementing retry mechanisms for failed requests.',
        relatedAnomalies: networkAnomalies,
      });
    }
    
    // Trend-based recommendations
    const degradingTrends = appTrends.filter(trend => 
      trend.changeDirection === 'degrading' && Math.abs(trend.changePercent) > 15
    );
    
    for (const trend of degradingTrends) {
      // Only add if we don't already have a recommendation for this metric
      if (!recommendations.some(rec => rec.appId === appId && rec.metricType === trend.metricType)) {
        let recommendation = '';
        
        switch (trend.metricType) {
          case 'cpu':
            recommendation = 'CPU usage is trending upward. Consider profiling the application to identify new bottlenecks that may have been introduced recently.';
            break;
          case 'memory':
            recommendation = 'Memory usage is trending upward. Check for memory leaks or increased object allocations in recent changes.';
            break;
          case 'frameRate':
            recommendation = 'Frame rate is trending downward. Recent changes may have introduced performance regressions in the UI rendering.';
            break;
          case 'startupTime':
            recommendation = 'Startup time is getting slower. Review recent changes that might be adding to the initialization time.';
            break;
          case 'networkLatency':
            recommendation = 'Network latency is increasing. Check if API endpoints are performing differently or if response payloads have grown.';
            break;
        }
        
        if (recommendation) {
          recommendations.push({
            appId,
            metricType: trend.metricType,
            severity: 'medium',
            issue: `Performance degradation detected: ${trend.description}`,
            recommendation,
            relatedTrends: [trend],
          });
        }
      }
    }
  }
}

/**
 * Get insights for a specific app
 */
export function getAppInsights(appId: string): PerformanceInsight {
  return {
    anomalies: anomalies.filter(anomaly => anomaly.appId === appId),
    trends: trends.filter(trend => trend.appId === appId),
    recommendations: recommendations.filter(rec => rec.appId === appId),
  };
}

/**
 * Get metrics for a specific app and metric type
 */
export function getAppMetrics(
  appId: string,
  metricType: MetricType,
  startTime?: number,
  endTime?: number
): AnalyticsDataPoint[] {
  let filteredData = analyticsData.filter(point => 
    point.appId === appId && point.metricType === metricType
  );
  
  if (startTime !== undefined) {
    filteredData = filteredData.filter(point => point.timestamp >= startTime);
  }
  
  if (endTime !== undefined) {
    filteredData = filteredData.filter(point => point.timestamp <= endTime);
  }
  
  return filteredData.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Process app data for analytics
 */
export function processAppForAnalytics(app: FlutterApp): void {
  // Only process running apps
  if (app.status !== 'running') {
    return;
  }
  
  // Record CPU and memory usage if available
  if (app.performanceData) {
    if (app.performanceData.cpuUsage !== undefined) {
      recordMetric(app.id, 'cpu', app.performanceData.cpuUsage);
    }
    
    if (app.performanceData.memoryUsage !== undefined) {
      recordMetric(app.id, 'memory', app.performanceData.memoryUsage);
    }
    
    if (app.performanceData.frameRate !== undefined) {
      recordMetric(app.id, 'frameRate', app.performanceData.frameRate);
    }
  }
  
  // Calculate average network latency from recent requests
  if (app.networkRequests && app.networkRequests.length > 0) {
    const recentRequests = app.networkRequests
      .filter(req => req.responseTime && req.requestTime)
      .slice(-5);
    
    if (recentRequests.length > 0) {
      const avgLatency = recentRequests.reduce((sum, req) => 
        sum + ((req.responseTime || 0) - (req.requestTime || 0)), 0
      ) / recentRequests.length;
      
      if (avgLatency > 0) {
        recordMetric(app.id, 'networkLatency', avgLatency);
      }
    }
  }
  
  // Record startup time for newly started apps
  if (app.startTime && !app.endTime && app.status === 'running') {
    // Check if we've already recorded startup time for this app
    const existingStartupMetrics = analyticsData.filter(
      point => point.appId === app.id && point.metricType === 'startupTime'
    );
    
    if (existingStartupMetrics.length === 0) {
      // This is a new app, record its startup time
      const now = Date.now();
      const startupTime = now - app.startTime;
      
      if (startupTime > 0 && startupTime < 60000) { // Sanity check: < 1 minute
        recordMetric(app.id, 'startupTime', startupTime);
      }
    }
  }
}

// Export analytics types
export type { 
  MetricType, 
  AnalyticsDataPoint, 
  PerformanceAnomaly, 
  PerformanceTrend,
  PerformanceRecommendation,
  PerformanceInsight
}; 