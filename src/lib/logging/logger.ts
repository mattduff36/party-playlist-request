/**
 * Comprehensive Logging System
 * 
 * This module provides a comprehensive logging system with multiple
 * output formats, log levels, and debugging capabilities.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  filePath?: string;
  remoteEndpoint?: string;
  maxFileSize: number; // in bytes
  maxFiles: number;
  enableColors: boolean;
  enableTimestamps: boolean;
  enableStackTrace: boolean;
  enablePerformance: boolean;
  enableUserTracking: boolean;
  enableRequestTracking: boolean;
}

export interface LogFilter {
  level?: LogLevel;
  component?: string;
  userId?: string;
  sessionId?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}

export class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private performanceMetrics: Map<string, number> = new Map();
  private userSessions: Map<string, string> = new Map();
  private requestIds: Set<string> = new Set();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      enableRemote: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      enableColors: true,
      enableTimestamps: true,
      enableStackTrace: true,
      enablePerformance: true,
      enableUserTracking: true,
      enableRequestTracking: true,
      ...config
    };
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.FATAL, message, context, error);
  }

  /**
   * Log a message with specified level
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    if (level < this.config.level) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      component: context?.component,
      ...this.getTrackingInfo()
    };

    // Add to buffer
    this.logBuffer.push(logEntry);

    // Output to configured destinations
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry);
    }

    if (this.config.enableFile) {
      this.outputToFile(logEntry);
    }

    if (this.config.enableRemote) {
      this.outputToRemote(logEntry);
    }

    // Clean up old logs if buffer is too large
    if (this.logBuffer.length > 10000) {
      this.logBuffer = this.logBuffer.slice(-5000);
    }
  }

  /**
   * Get current tracking information
   */
  private getTrackingInfo(): Partial<LogEntry> {
    const info: Partial<LogEntry> = {};

    if (this.config.enableUserTracking) {
      // Get current user ID from context or session
      const userId = this.getCurrentUserId();
      if (userId) {
        info.userId = userId;
        info.sessionId = this.userSessions.get(userId);
      }
    }

    if (this.config.enableRequestTracking) {
      // Get current request ID from context
      const requestId = this.getCurrentRequestId();
      if (requestId) {
        info.requestId = requestId;
      }
    }

    return info;
  }

  /**
   * Get current user ID from context
   */
  private getCurrentUserId(): string | undefined {
    // This would be implemented based on your authentication system
    // For now, return undefined
    return undefined;
  }

  /**
   * Get current request ID from context
   */
  private getCurrentRequestId(): string | undefined {
    // This would be implemented based on your request tracking system
    // For now, return undefined
    return undefined;
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = this.config.enableTimestamps 
      ? `[${entry.timestamp}] ` 
      : '';
    
    const levelStr = this.getLevelString(entry.level);
    const contextStr = entry.context 
      ? ` ${JSON.stringify(entry.context)}` 
      : '';
    
    const errorStr = entry.error 
      ? `\n${this.formatError(entry.error)}` 
      : '';

    const message = `${timestamp}${levelStr} ${entry.message}${contextStr}${errorStr}`;
    
    if (this.config.enableColors) {
      console.log(this.colorizeMessage(message, entry.level));
    } else {
      console.log(message);
    }
  }

  /**
   * Output log entry to file
   */
  private outputToFile(entry: LogEntry): void {
    if (!this.config.filePath) return;

    try {
      const fs = require('fs');
      const path = require('path');
      
      // Ensure directory exists
      const dir = path.dirname(this.config.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Rotate file if too large
      this.rotateLogFile();

      // Append to file
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.config.filePath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Output log entry to remote endpoint
   */
  private outputToRemote(entry: LogEntry): void {
    if (!this.config.remoteEndpoint) return;

    // This would be implemented to send logs to a remote service
    // For now, just log to console
    console.log('Remote logging not implemented yet');
  }

  /**
   * Rotate log file if it's too large
   */
  private rotateLogFile(): void {
    if (!this.config.filePath) return;

    try {
      const fs = require('fs');
      const path = require('path');
      
      if (!fs.existsSync(this.config.filePath)) return;

      const stats = fs.statSync(this.config.filePath);
      if (stats.size < this.config.maxFileSize) return;

      // Rotate files
      for (let i = this.config.maxFiles - 1; i > 0; i--) {
        const oldFile = `${this.config.filePath}.${i}`;
        const newFile = `${this.config.filePath}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === this.config.maxFiles - 1) {
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current file to .1
      fs.renameSync(this.config.filePath, `${this.config.filePath}.1`);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Get level string representation
   */
  private getLevelString(level: LogLevel): string {
    const levelStrings = {
      [LogLevel.DEBUG]: 'DEBUG',
      [LogLevel.INFO]: 'INFO',
      [LogLevel.WARN]: 'WARN',
      [LogLevel.ERROR]: 'ERROR',
      [LogLevel.FATAL]: 'FATAL'
    };
    return levelStrings[level];
  }

  /**
   * Colorize message based on log level
   */
  private colorizeMessage(message: string, level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.FATAL]: '\x1b[35m'  // Magenta
    };
    
    const reset = '\x1b[0m';
    return `${colors[level]}${message}${reset}`;
  }

  /**
   * Format error with stack trace
   */
  private formatError(error: Error): string {
    let errorStr = `Error: ${error.message}`;
    
    if (this.config.enableStackTrace && error.stack) {
      errorStr += `\nStack Trace:\n${error.stack}`;
    }
    
    return errorStr;
  }

  /**
   * Start performance timing
   */
  startTimer(name: string): void {
    if (this.config.enablePerformance) {
      this.performanceMetrics.set(name, Date.now());
    }
  }

  /**
   * End performance timing and log duration
   */
  endTimer(name: string, message?: string): void {
    if (this.config.enablePerformance) {
      const startTime = this.performanceMetrics.get(name);
      if (startTime) {
        const duration = Date.now() - startTime;
        this.performanceMetrics.delete(name);
        
        this.info(message || `Timer ${name} completed`, {
          timer: name,
          duration: `${duration}ms`
        });
      }
    }
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, context?: Record<string, any>): void {
    if (this.config.enablePerformance) {
      this.info(`Performance: ${operation}`, {
        operation,
        duration: `${duration}ms`,
        ...context
      });
    }
  }

  /**
   * Set user session
   */
  setUserSession(userId: string, sessionId: string): void {
    if (this.config.enableUserTracking) {
      this.userSessions.set(userId, sessionId);
    }
  }

  /**
   * Clear user session
   */
  clearUserSession(userId: string): void {
    if (this.config.enableUserTracking) {
      this.userSessions.delete(userId);
    }
  }

  /**
   * Set request ID
   */
  setRequestId(requestId: string): void {
    if (this.config.enableRequestTracking) {
      this.requestIds.add(requestId);
    }
  }

  /**
   * Clear request ID
   */
  clearRequestId(requestId: string): void {
    if (this.config.enableRequestTracking) {
      this.requestIds.delete(requestId);
    }
  }

  /**
   * Get logs with filter
   */
  getLogs(filter: LogFilter = {}): LogEntry[] {
    let logs = [...this.logBuffer];

    if (filter.level !== undefined) {
      logs = logs.filter(log => log.level >= filter.level!);
    }

    if (filter.component) {
      logs = logs.filter(log => log.component === filter.component);
    }

    if (filter.userId) {
      logs = logs.filter(log => log.userId === filter.userId);
    }

    if (filter.sessionId) {
      logs = logs.filter(log => log.sessionId === filter.sessionId);
    }

    if (filter.timeRange) {
      const start = filter.timeRange.start.getTime();
      const end = filter.timeRange.end.getTime();
      logs = logs.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= start && logTime <= end;
      });
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      logs = logs.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        (log.context && JSON.stringify(log.context).toLowerCase().includes(searchLower))
      );
    }

    return logs;
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Get log statistics
   */
  getLogStatistics(): Record<string, any> {
    const stats = {
      totalLogs: this.logBuffer.length,
      levelCounts: {} as Record<string, number>,
      componentCounts: {} as Record<string, number>,
      errorCount: 0,
      warningCount: 0,
      averageLogsPerMinute: 0
    };

    // Count by level
    this.logBuffer.forEach(log => {
      const levelStr = this.getLevelString(log.level);
      stats.levelCounts[levelStr] = (stats.levelCounts[levelStr] || 0) + 1;
      
      if (log.level >= LogLevel.ERROR) {
        stats.errorCount++;
      } else if (log.level >= LogLevel.WARN) {
        stats.warningCount++;
      }
    });

    // Count by component
    this.logBuffer.forEach(log => {
      if (log.component) {
        stats.componentCounts[log.component] = (stats.componentCounts[log.component] || 0) + 1;
      }
    });

    // Calculate average logs per minute
    if (this.logBuffer.length > 0) {
      const firstLog = new Date(this.logBuffer[0].timestamp);
      const lastLog = new Date(this.logBuffer[this.logBuffer.length - 1].timestamp);
      const durationMinutes = (lastLog.getTime() - firstLog.getTime()) / (1000 * 60);
      stats.averageLogsPerMinute = durationMinutes > 0 ? this.logBuffer.length / durationMinutes : 0;
    }

    return stats;
  }

  /**
   * Export logs to file
   */
  exportLogs(filePath: string, filter?: LogFilter): void {
    try {
      const fs = require('fs');
      const logs = this.getLogs(filter);
      const exportData = {
        exportedAt: new Date().toISOString(),
        filter,
        logs
      };
      
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  }
}

// Create default logger instance
export const logger = new Logger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false,
  enableColors: true,
  enableTimestamps: true,
  enableStackTrace: true,
  enablePerformance: true
});

// Export convenience functions
export const debug = (message: string, context?: Record<string, any>) => logger.debug(message, context);
export const info = (message: string, context?: Record<string, any>) => logger.info(message, context);
export const warn = (message: string, context?: Record<string, any>) => logger.warn(message, context);
export const error = (message: string, error?: Error, context?: Record<string, any>) => logger.error(message, error, context);
export const fatal = (message: string, error?: Error, context?: Record<string, any>) => logger.fatal(message, error, context);
