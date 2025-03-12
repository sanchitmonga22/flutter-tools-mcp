/**
 * Simple logger utility for the Flutter Connector Server
 */

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Set default log level from environment variable or default to INFO
const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL
  ? parseInt(process.env.LOG_LEVEL, 10)
  : LogLevel.INFO;

class Logger {
  private logLevel: LogLevel;

  constructor(logLevel: LogLevel = DEFAULT_LOG_LEVEL) {
    this.logLevel = logLevel;
  }

  /**
   * Set the log level
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Debug level logging
   */
  public debug(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Info level logging
   */
  public info(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * Warning level logging
   */
  public warn(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  /**
   * Error level logging
   */
  public error(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

// Create and export a singleton instance
export const logger = new Logger();

// Export the LogLevel enum for external configuration
export { LogLevel }; 