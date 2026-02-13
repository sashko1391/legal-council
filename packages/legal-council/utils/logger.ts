/**
 * Logger utility for Legal Council
 * 
 * FIX #16 (Feb 13, 2026):
 * Replaces raw console.log/error throughout codebase with level-based logging.
 * In production, debug-level messages (raw LLM responses, token counts) are suppressed.
 * In development/testing, all levels are visible.
 * 
 * Prevents leaking confidential contract text into production logs.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Determine minimum log level from environment
function getMinLevel(): LogLevel {
  const env = process.env.LEGAL_COUNCIL_ENV || process.env.NODE_ENV || 'development';
  switch (env) {
    case 'production':
      return 'info'; // No debug in production
    case 'testing':
      return 'debug'; // All logs in testing
    case 'development':
    default:
      return 'debug'; // All logs in development
  }
}

const MIN_LEVEL = getMinLevel();

class Logger {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  /**
   * Create a child logger with a prefix (e.g., agent ID)
   */
  child(prefix: string): Logger {
    return new Logger(prefix);
  }

  /**
   * Debug: Raw LLM responses, token counts, parsing details.
   * SUPPRESSED in production to avoid leaking contract text.
   */
  debug(message: string, data?: any): void {
    if (LOG_LEVELS.debug >= LOG_LEVELS[MIN_LEVEL]) {
      const formatted = this.format(message);
      if (data !== undefined) {
        console.log(formatted, data);
      } else {
        console.log(formatted);
      }
    }
  }

  /**
   * Info: Agent start/complete, orchestrator progress, cost summaries.
   */
  info(message: string, data?: any): void {
    if (LOG_LEVELS.info >= LOG_LEVELS[MIN_LEVEL]) {
      const formatted = this.format(message);
      if (data !== undefined) {
        console.log(formatted, data);
      } else {
        console.log(formatted);
      }
    }
  }

  /**
   * Warn: Missing optional fields, fallbacks triggered, degraded quality.
   */
  warn(message: string, data?: any): void {
    if (LOG_LEVELS.warn >= LOG_LEVELS[MIN_LEVEL]) {
      const formatted = this.format(message);
      if (data !== undefined) {
        console.warn(formatted, data);
      } else {
        console.warn(formatted);
      }
    }
  }

  /**
   * Error: Agent failures, API errors, parsing failures.
   * Always visible in all environments.
   */
  error(message: string, data?: any): void {
    const formatted = this.format(message);
    if (data !== undefined) {
      console.error(formatted, data);
    } else {
      console.error(formatted);
    }
  }

  private format(message: string): string {
    if (this.prefix) {
      return `[${this.prefix}] ${message}`;
    }
    return message;
  }
}

// Default logger instance
export const logger = new Logger();

// Factory for agent-specific loggers
export function createAgentLogger(agentId: string): Logger {
  return new Logger(agentId);
}

export default logger;
