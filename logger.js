const isServiceWorker = "undefined" != typeof self && !self.window,
    globalScope = isServiceWorker ? self : window;
if(!globalScope.autoClickerLogger) {
    class e {
        constructor() {
            this.LOG_LEVELS = {
                DEBUG: 0,
                INFO: 1,
                WARNING: 2,
                ERROR: 3
            }, this.currentLogLevel = this.LOG_LEVELS.INFO, this.maxLogEntries = 1e3, this.logCache = [], this.timers = {}
        }
        setLogLevel(e) {
            void 0 !== this.LOG_LEVELS[e] ? (this.currentLogLevel = this.LOG_LEVELS[e], this.info("Logger", `Log level set to ${e}`)) : this.error("Logger", `Invalid log level: ${e}`)
        }
        formatTimestamp() {
            return (new Date).toISOString()
        }
        log(e, o, t, s = null) {
            if(this.LOG_LEVELS[e] < this.currentLogLevel) return;
            const i = {
                timestamp: this.formatTimestamp(),
                level: e,
                module: o,
                message: t,
                data: s ? JSON.stringify(s) : null,
                url: isServiceWorker ? "background" : window.location ? window.location.href : "unknown"
            };
            this.logCache.push(i), this.logCache.length > this.maxLogEntries && this.logCache.shift();
            const r = {
                DEBUG: "color: #6c757d",
                INFO: "color: #0275d8",
                WARNING: "color: #f0ad4e",
                ERROR: "color: #d9534f; font-weight: bold"
            };
            isServiceWorker ? console.log(`[${e}] [${o}] ${t}`, s) : console.log(`%c[${e}]%c [${o}] ${t}`, r[e], "color: inherit", s), this.persistLogs()
        }
        debug(e, o, t = null) {
            this.log("DEBUG", e, o, t)
        }
        info(e, o, t = null) {
            this.log("INFO", e, o, t)
        }
        warning(e, o, t = null) {
            this.log("WARNING", e, o, t)
        }
        error(e, o, t = null) {
            this.log("ERROR", e, o, t)
        }
        startTimer(e) {
            this.timers[e] = performance.now(), this.debug("Performance", `Timer started: ${e}`)
        }
        endTimer(e, o = "Performance") {
            if(this.timers[e]) {
                const t = performance.now() - this.timers[e];
                return this.info(o, `${e} completed in ${t.toFixed(2)}ms`), delete this.timers[e], t
            }
            return this.warning(o, `Timer not found: ${e}`), null
        }
        persistLogs() {
            this.persistTimeout && clearTimeout(this.persistTimeout), this.persistTimeout = setTimeout((() => {
                chrome.storage.local.get({
                    logs: []
                }, (e => {
                    let o = [...e.logs, ...this.logCache];
                    o.length > this.maxLogEntries && (o = o.slice(o.length - this.maxLogEntries)), chrome.storage.local.set({
                        logs: o
                    }, (() => {
                        this.logCache = [], this.debug("Logger", `Persisted ${o.length} logs to storage`)
                    }))
                }))
            }), 1e3)
        }
        getLogs(e) {
            chrome.storage.local.get({
                logs: []
            }, (o => {
                e(o.logs)
            }))
        }
        clearLogs(e = null) {
            chrome.storage.local.set({
                logs: []
            }, (() => {
                this.info("Logger", "All logs cleared"), e && e()
            }))
        }
        exportLogs(e) {
            this.getLogs((o => {
                const t = JSON.stringify(o, null, 2);
                e(t)
            }))
        }
    }
    globalScope.autoClickerLogger = new e, globalScope.autoClickerLogger.info("Logger", `Logger initialized in ${isServiceWorker?"service worker":"browser"} context`)
}
