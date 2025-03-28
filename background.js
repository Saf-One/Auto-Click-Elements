 // Simple background logger implementation
 const BackgroundLogger = {
     LOG_LEVELS: {
         DEBUG: 0,
         INFO: 1,
         WARNING: 2,
         ERROR: 3
     },
     currentLogLevel: 1, // INFO by default

     setLogLevel(level) {
         if (this.LOG_LEVELS[level] !== undefined) {
             this.currentLogLevel = this.LOG_LEVELS[level];
             this.info('Logger', `Log level set to ${level}`);
         } else {
             this.error('Logger', `Invalid log level: ${level}`);
         }
     },

     log(level, module, message, data = null) {
         if (this.LOG_LEVELS[level] < this.currentLogLevel) {
             return;
         }

         const logEntry = {
             timestamp: new Date().toISOString(),
             level,
             module,
             message,
             data: data ? JSON.stringify(data) : null,
             url: 'background'
         };

         // Log to console
         console.log(`[${level}] [${module}] ${message}`, data || '');

         // Store in Chrome storage
         this.persistLog(logEntry);
     },

     debug(module, message, data) {
         this.log('DEBUG', module, message, data);
     },

     info(module, message, data) {
         this.log('INFO', module, message, data);
     },

     warning(module, message, data) {
         this.log('WARNING', module, message, data);
     },

     error(module, message, data) {
         this.log('ERROR', module, message, data);
     },

     persistLog(logEntry) {
         chrome.storage.local.get({ logs: [] }, (data) => {
             const logs = [...data.logs, logEntry];
             // Keep maximum 1000 logs
             const maxLogs = 1000;
             const trimmedLogs = logs.length > maxLogs ? logs.slice(logs.length - maxLogs) : logs;
             chrome.storage.local.set({ logs: trimmedLogs });
         });
     },

     getLogs(callback) {
         chrome.storage.local.get({ logs: [] }, (data) => {
             callback(data.logs);
         });
     },

     clearLogs(callback = null) {
         chrome.storage.local.set({ logs: [] }, () => {
             this.info('Logger', 'All logs cleared');
             if (callback) callback();
         });
     },

     // Performance timing
     timers: {},

     startTimer(label) {
         this.timers[label] = performance.now();
         this.debug('Performance', `Timer started: ${label}`);
     },

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
 };

 // Initialize the background service worker
 BackgroundLogger.info('Background', 'Background service worker initialized');

 // Listen for tab updates
 chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
     if (changeInfo.status === 'complete' && tab.url) {
         BackgroundLogger.debug('Background', `Tab updated: ${tabId}`, { url: tab.url, changeInfo });

         // Inject the content script
         BackgroundLogger.startTimer(`script-injection-${tabId}`);
         chrome.scripting.executeScript({
             target: { tabId: tabId },
             function: triggerAutoClick
         }).then(() => {
             BackgroundLogger.endTimer(`script-injection-${tabId}`, 'Background');
             BackgroundLogger.info('Background', `Content script injected into tab ${tabId}`);
         }).catch(error => {
             BackgroundLogger.error('Background', `Failed to inject content script into tab ${tabId}`, { error: error.message });
         });
     }
 });

 function triggerAutoClick() {
     // This will be executed in the context of the page
     // It simply dispatches a custom event that our content script listens for
     document.dispatchEvent(new CustomEvent('autoClickerPageLoaded'));
 }

 // Listen for runtime messages
 chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     if (message.action === "getLogLevel") {
         sendResponse({ level: BackgroundLogger.currentLogLevel });
         BackgroundLogger.debug('Background', 'Log level requested', { level: BackgroundLogger.currentLogLevel });
     } else if (message.action === "setLogLevel") {
         BackgroundLogger.setLogLevel(message.level);
         sendResponse({ success: true });
     } else if (message.action === "getLogs") {
         BackgroundLogger.getLogs(logs => {
             sendResponse({ logs });
         });
         return true; // Required for async response
     } else if (message.action === "clearLogs") {
         BackgroundLogger.clearLogs(() => {
             sendResponse({ success: true });
         });
         return true; // Required for async response
     }
 });