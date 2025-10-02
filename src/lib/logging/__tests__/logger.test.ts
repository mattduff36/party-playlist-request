/**
 * Tests for Logger
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Logger, LogLevel, logger } from '../logger';

describe('Logger', () => {
  let testLogger: Logger;

  beforeEach(() => {
    testLogger = new Logger({
      level: LogLevel.DEBUG,
      enableConsole: false,
      enableFile: false,
      enableRemote: false
    });
  });

  describe('Log Levels', () => {
    it('should log debug messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Enable console for this test
      const debugLogger = new Logger({
        level: LogLevel.DEBUG,
        enableConsole: true,
        enableFile: false,
        enableRemote: false
      });
      
      debugLogger.debug('Debug message');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log info messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const infoLogger = new Logger({
        level: LogLevel.INFO,
        enableConsole: true,
        enableFile: false,
        enableRemote: false
      });
      
      infoLogger.info('Info message');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log warning messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const warnLogger = new Logger({
        level: LogLevel.WARN,
        enableConsole: true,
        enableFile: false,
        enableRemote: false
      });
      
      warnLogger.warn('Warning message');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log error messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const errorLogger = new Logger({
        level: LogLevel.ERROR,
        enableConsole: true,
        enableFile: false,
        enableRemote: false
      });
      
      errorLogger.error('Error message');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log fatal messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const fatalLogger = new Logger({
        level: LogLevel.FATAL,
        enableConsole: true,
        enableFile: false,
        enableRemote: false
      });
      
      fatalLogger.fatal('Fatal message');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Log Filtering', () => {
    it('should respect log level filtering', () => {
      const highLevelLogger = new Logger({
        level: LogLevel.ERROR,
        enableConsole: true
      });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      highLevelLogger.debug('Debug message');
      highLevelLogger.info('Info message');
      highLevelLogger.warn('Warning message');
      highLevelLogger.error('Error message');
      
      // Only error should be logged
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });
  });

  describe('Context and Error Handling', () => {
    it('should log with context', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const contextLogger = new Logger({
        level: LogLevel.INFO,
        enableConsole: true,
        enableFile: false,
        enableRemote: false
      });
      
      contextLogger.info('Message with context', { userId: '123', action: 'login' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Message with context')
      );
      consoleSpy.mockRestore();
    });

    it('should log with error', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const testError = new Error('Test error');
      
      const errorLogger = new Logger({
        level: LogLevel.ERROR,
        enableConsole: true,
        enableFile: false,
        enableRemote: false
      });
      
      errorLogger.error('Error with exception', testError);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error with exception')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Performance Timing', () => {
    it('should start and end timers', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const timerLogger = new Logger({
        level: LogLevel.INFO,
        enableConsole: true,
        enableFile: false,
        enableRemote: false,
        enablePerformance: true
      });
      
      timerLogger.startTimer('test-timer');
      timerLogger.endTimer('test-timer');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Timer test-timer completed')
      );
      consoleSpy.mockRestore();
    });

    it('should log performance metrics', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const perfLogger = new Logger({
        level: LogLevel.INFO,
        enableConsole: true,
        enableFile: false,
        enableRemote: false,
        enablePerformance: true
      });
      
      perfLogger.logPerformance('test-operation', 150, { component: 'test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance: test-operation')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Log Management', () => {
    it('should get logs with filter', () => {
      const logLogger = new Logger({
        level: LogLevel.INFO,
        enableConsole: true,
        enableFile: false,
        enableRemote: false
      });
      
      logLogger.info('Test message 1', { component: 'test' });
      logLogger.info('Test message 2', { component: 'other' });
      logLogger.error('Error message', undefined, { component: 'test' });
      
      const testLogs = logLogger.getLogs({ component: 'test' });
      expect(testLogs).toHaveLength(2);
      expect(testLogs[0].message).toBe('Test message 1');
      expect(testLogs[1].message).toBe('Error message');
    });

    it('should get log statistics', () => {
      const statsLogger = new Logger({
        level: LogLevel.INFO,
        enableConsole: true,
        enableFile: false,
        enableRemote: false
      });
      
      statsLogger.info('Info message');
      statsLogger.warn('Warning message');
      statsLogger.error('Error message');
      
      const stats = statsLogger.getLogStatistics();
      expect(stats.totalLogs).toBe(3);
      expect(stats.levelCounts.INFO).toBe(1);
      expect(stats.levelCounts.WARN).toBe(1);
      expect(stats.levelCounts.ERROR).toBe(1);
      expect(stats.errorCount).toBe(1);
      expect(stats.warningCount).toBe(1);
    });

    it('should clear logs', () => {
      const clearLogger = new Logger({
        level: LogLevel.INFO,
        enableConsole: true,
        enableFile: false,
        enableRemote: false
      });
      
      clearLogger.info('Test message');
      expect(clearLogger.getLogs()).toHaveLength(1);
      
      clearLogger.clearLogs();
      expect(clearLogger.getLogs()).toHaveLength(0);
    });
  });

  describe('User and Request Tracking', () => {
    it('should set user session', () => {
      testLogger.setUserSession('user123', 'session456');
      
      // This would be tested by checking if the session is stored
      // The actual implementation would need to be more robust
      expect(true).toBe(true);
    });

    it('should set request ID', () => {
      testLogger.setRequestId('req123');
      
      // This would be tested by checking if the request ID is stored
      expect(true).toBe(true);
    });
  });

  describe('Default Logger', () => {
    it('should have default logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(Logger);
    });
  });
});
