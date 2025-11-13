import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data?: any;
  sessionId?: string;
  userId?: string;
  duration?: number;
}

export class Logger {
  private static logLevel: LogLevel = config.nodeEnv === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
  private static logsDir = path.join(config.dataDir, 'logs');
  private static enableFileLogging = true;

  /**
   * Initialize logger (create logs directory)
   */
  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  /**
   * Set logging level
   */
  static setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Core logging function
   */
  private static async log(
    level: LogLevel,
    levelName: string,
    category: string,
    message: string,
    data?: any,
    metadata?: { sessionId?: string; userId?: string; duration?: number }
  ): Promise<void> {
    if (level < this.logLevel) return;

    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      timestamp,
      level: levelName,
      category,
      message,
      ...metadata,
    };

    if (data !== undefined) {
      entry.data = data;
    }

    // Console output with colors
    const color = this.getColor(level);
    const reset = '\x1b[0m';
    const dim = '\x1b[2m';

    let consoleOutput = `${dim}${timestamp}${reset} ${color}[${levelName}]${reset} ${color}[${category}]${reset} ${message}`;

    if (metadata?.sessionId) {
      consoleOutput += ` ${dim}(session: ${metadata.sessionId.substring(0, 8)}...)${reset}`;
    }

    if (metadata?.duration !== undefined) {
      consoleOutput += ` ${dim}(${metadata.duration}ms)${reset}`;
    }

    console.log(consoleOutput);

    // Log detailed data if available
    if (data !== undefined && level <= LogLevel.DEBUG) {
      console.log(`${dim}${JSON.stringify(data, null, 2)}${reset}`);
    }

    // Write to file (async, non-blocking)
    if (this.enableFileLogging) {
      this.writeToFile(entry).catch(() => {
        // Silently fail file logging to not disrupt application
      });
    }
  }

  /**
   * Get ANSI color code for log level
   */
  private static getColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '\x1b[36m'; // Cyan
      case LogLevel.INFO:
        return '\x1b[32m'; // Green
      case LogLevel.WARN:
        return '\x1b[33m'; // Yellow
      case LogLevel.ERROR:
        return '\x1b[31m'; // Red
      default:
        return '\x1b[0m'; // Reset
    }
  }

  /**
   * Write log entry to daily log file
   */
  private static async writeToFile(entry: LogEntry): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logsDir, `${date}.jsonl`);

    try {
      await fs.appendFile(logFile, JSON.stringify(entry) + '\n');
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Debug level logging
   */
  static debug(category: string, message: string, data?: any, metadata?: { sessionId?: string; userId?: string; duration?: number }): void {
    this.log(LogLevel.DEBUG, 'DEBUG', category, message, data, metadata);
  }

  /**
   * Info level logging
   */
  static info(category: string, message: string, data?: any, metadata?: { sessionId?: string; userId?: string; duration?: number }): void {
    this.log(LogLevel.INFO, 'INFO', category, message, data, metadata);
  }

  /**
   * Warning level logging
   */
  static warn(category: string, message: string, data?: any, metadata?: { sessionId?: string; userId?: string; duration?: number }): void {
    this.log(LogLevel.WARN, 'WARN', category, message, data, metadata);
  }

  /**
   * Error level logging
   */
  static error(category: string, message: string, data?: any, metadata?: { sessionId?: string; userId?: string; duration?: number }): void {
    this.log(LogLevel.ERROR, 'ERROR', category, message, data, metadata);
  }

  /**
   * Agent-specific logging methods
   */
  static agentInit(sessionId: string, userId: string, resume: boolean): void {
    this.info('AGENT', resume ? 'Resuming conversation session' : 'Starting new conversation session', {
      resume,
    }, { sessionId, userId });
  }

  static agentMessage(sessionId: string, messageType: string, message: any): void {
    this.debug('AGENT_MSG', `Received ${messageType} message`, message, { sessionId });
  }

  static agentThinking(sessionId: string, thinking: string, isComplete: boolean): void {
    this.debug('AGENT_THINK', isComplete ? 'Thinking complete' : 'Thinking in progress', {
      thinking: thinking.length > 200 ? `${thinking.substring(0, 200)}...` : thinking,
      fullLength: thinking.length,
    }, { sessionId });
  }

  static agentToolUse(sessionId: string, toolName: string, toolInput: any): void {
    this.info('AGENT_TOOL', `Executing tool: ${toolName}`, toolInput, { sessionId });
  }

  static agentToolResult(sessionId: string, toolName: string, result: any, duration?: number): void {
    this.debug('AGENT_TOOL_RESULT', `Tool result: ${toolName}`, result, { sessionId, duration });
  }

  static agentContent(sessionId: string, content: string): void {
    this.debug('AGENT_CONTENT', 'Content delta received', {
      length: content.length,
      preview: content.substring(0, 100),
    }, { sessionId });
  }

  static agentComplete(sessionId: string, totalTokens?: number, duration?: number): void {
    this.info('AGENT', 'Conversation turn complete', {
      totalTokens,
    }, { sessionId, duration });
  }

  static agentError(sessionId: string | undefined, error: Error, context?: string): void {
    this.error('AGENT_ERROR', context || 'Agent error occurred', {
      error: error.message,
      stack: error.stack,
    }, { sessionId });
  }

  /**
   * HTTP request logging
   */
  static httpRequest(method: string, path: string, userId?: string): void {
    this.info('HTTP', `${method} ${path}`, undefined, { userId });
  }

  static httpResponse(method: string, path: string, statusCode: number, duration: number): void {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, level === LogLevel.WARN ? 'WARN' : 'INFO', 'HTTP', `${method} ${path} ${statusCode}`, undefined, { duration });
  }

  /**
   * Performance timing helper
   */
  static startTimer(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
  }
}
