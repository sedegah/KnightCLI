/**
 * Logger Utility
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class Logger {
  constructor(level = 'info') {
    this.level = LOG_LEVELS[level] || LOG_LEVELS.info;
  }

  debug(...args) {
    if (this.level <= LOG_LEVELS.debug) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args) {
    if (this.level <= LOG_LEVELS.info) {
      console.log('[INFO]', ...args);
    }
  }

  warn(...args) {
    if (this.level <= LOG_LEVELS.warn) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args) {
    if (this.level <= LOG_LEVELS.error) {
      console.error('[ERROR]', ...args);
    }
  }
}

export const logger = new Logger(process.env.LOG_LEVEL || 'info');
