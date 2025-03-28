/**
 * Auto Clicker Extension Logger
 * 
 * A comprehensive logging system for the Auto Clicker extension that provides:
 * - Multiple log levels (DEBUG, INFO, WARNING, ERROR)
 * - Log persistence to chrome.storage
 * - Timestamp formatting
 * - Module/component identification
 * - Performance timing functions
 * - Log rotation and management
 */

// Check if we're in a service worker context or browser context
const isServiceWorker = typeof self !== 'undefined' && !self.window;
const globalScope = isServiceWorker ? self : window;

// Create the logger only if it doesn't already exist in the global scope
if (!globalScope.autoClickerLogger) {
    class Logger {
        constructor() {
            // Log levels with numeric values for filtering
            this.LOG_LEVELS = {
                DEBUG: 0,
                INFO: 1,
                WARNING: 2,
                ERROR: 3
            };

            // Current log level (can be changed dynamically)
            this.currentLogLevel = this.LOG_LEVELS.INFO;

            // Maximum number of logs to keep in storage
            this.maxLogEntries = 1000;

            // In-memory log cache
            this.logCache = [];

            // Performance timing cache
            this.timers = {};
        }

        /**
         * Set the current log level
         * @param {string} level - The log level to set (DEBUG, INFO, WARNING, ERROR)
         */
        setLogLevel(level) {
            if (this.LOG_LEVELS[level] !== undefined) {
                this.currentLogLevel = this.LOG_LEVELS[level];
                this.info('Logger', `Log level set to ${level}`);
            } else {
                this.error('Logger', `Invalid log level: ${level}`);
            }
        }

        /**
         * Format a timestamp for logging
         * @returns {string} Formatted timestamp
         */
        formatTimestamp() {
            const now = new Date();
            return now.toISOString();
        }

        /**
         * Log a message if the level is at or above the current log level
         * @param {string} level - Log level
         * @param {string} module - Source module/component
         * @param {string} message - Log message
         * @param {object} data - Optional data to include
         */
        log(level, module, message, data = null) {
            if (this.LOG_LEVELS[level] < this.currentLogLevel) {
                return;
            }

            const logEntry = {
                timestamp: this.formatTimestamp(),
                level,
                module,
                message,
                data: data ? JSON.stringify(data) : null,
                url: isServiceWorker ? 'background' : (window.location ? window.location.href : 'unknown')
            };

            // Add to in-memory cache
            this.logCache.push(logEntry);

            // Keep cache within size limits
            if (this.logCache.length > this.maxLogEntries) {
                this.logCache.shift();
            }

            // Log to console with appropriate styling
            const consoleStyles = {
                DEBUG: 'color: #6c757d',
                INFO: 'color: #0275d8',
                WARNING: 'color: #f0ad4e',
                ERROR: 'color: #d9534f; font-weight: bold'
            };

            // In service workers, styled console logs don't work the same way
            if (!isServiceWorker) {
                console.log(
                    `%c[${level}]%c [${module}] ${message}`,
                    consoleStyles[level],
                    'color: inherit',
                    data
                );
            } else {
                console.log(`[${level}] [${module}] ${message}`, data);
            }

            // Store logs in chrome.storage.local
            this.persistLogs();
        }

        /**
         * Log a debug message
         * @param {string} module - Source module/component
         * @param {string} message - Log message
         * @param {object} data - Optional data to include
         */
        debug(module, message, data = null) {
            this.log('DEBUG', module, message, data);
        }

        /**
         * Log an info message
         * @param {string} module - Source module/component
         * @param {string} message - Log message
         * @param {object} data - Optional data to include
         */
        info(module, message, data = null) {
            this.log('INFO', module, message, data);
        }

        /**
         * Log a warning message
         * @param {string} module - Source module/component
         * @param {string} message - Log message
         * @param {object} data - Optional data to include
         */
        warning(module, message, data = null) {
            this.log('WARNING', module, message, data);
        }

        /**
         * Log an error message
         * @param {string} module - Source module/component
         * @param {string} message - Log message
         * @param {object} data - Optional data to include
         */
        error(module, message, data = null) {
            this.log('ERROR', module, message, data);
        }

        /**
         * Start a timer for performance measurement
         * @param {string} label - Timer label
         */
        startTimer(label) {
            this.timers[label] = performance.now();
            this.debug('Performance', `Timer started: ${label}`);
        }

        /**
         * End a timer and log the elapsed time
         * @param {string} label - Timer label
         * @param {string} module - Source module/component
         */
        endTimer(label, module = 'Performance') {
            if (this.timers[label]) {
                const elapsed = performance.now() - this.timers[label];
                this.info(module, `${label} completed in ${elapsed.toFixed(2)}ms`);
                delete this.timers[label];
                return elapsed;
            } else {
                this.warning(module, `Timer not found: ${label}`);
                return null;
            }
        }

        /**
         * Persist logs to chrome.storage.local
         */
        persistLogs() {
            // Debounce storage writes to avoid excessive operations
            if (this.persistTimeout) {
                clearTimeout(this.persistTimeout);
            }

            this.persistTimeout = setTimeout(() => {
                chrome.storage.local.get({ logs: [] }, (data) => {
                    // Combine existing logs with new logs
                    let allLogs = [...data.logs, ...this.logCache];

                    // Keep under max size
                    if (allLogs.length > this.maxLogEntries) {
                        allLogs = allLogs.slice(allLogs.length - this.maxLogEntries);
                    }

                    chrome.storage.local.set({ logs: allLogs }, () => {
                        // Clear the cache after persisting
                        this.logCache = [];
                        this.debug('Logger', `Persisted ${allLogs.length} logs to storage`);
                    });
                });
            }, 1000); // Wait 1 second between writes
        }

        /**
         * Get all logs from storage
         * @param {function} callback - Function to call with the logs
         */
        getLogs(callback) {
            chrome.storage.local.get({ logs: [] }, (data) => {
                callback(data.logs);
            });
        }

        /**
         * Clear all logs from storage
         * @param {function} callback - Function to call when done
         */
        clearLogs(callback = null) {
            chrome.storage.local.set({ logs: [] }, () => {
                this.info('Logger', 'All logs cleared');
                if (callback) callback();
            });
        }

        /**
         * Export logs as JSON
         * @param {function} callback - Function to call with the JSON string
         */
        exportLogs(callback) {
            this.getLogs((logs) => {
                const jsonString = JSON.stringify(logs, null, 2);
                callback(jsonString);
            });
        }
    }

    // Create a singleton instance and attach it to the global scope
    globalScope.autoClickerLogger = new Logger();

    // Log initialization
    globalScope.autoClickerLogger.info('Logger', `Logger initialized in ${isServiceWorker ? 'service worker' : 'browser'} context`);
}