const BackgroundLogger = {
    LOG_LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARNING: 2,
        ERROR: 3
    },
    currentLogLevel: 1,
    setLogLevel(e) {
        void 0 !== this.LOG_LEVELS[e] ? (this.currentLogLevel = this.LOG_LEVELS[e], this.info("Logger", `Log level set to ${e}`)) : this.error("Logger", `Invalid log level: ${e}`)
    },
    log(e, o, r, t = null) {
        if(this.LOG_LEVELS[e] < this.currentLogLevel) return;
        const g = {
            timestamp: (new Date).toISOString(),
            level: e,
            module: o,
            message: r,
            data: t ? JSON.stringify(t) : null,
            url: "background"
        };
        console.log(`[${e}] [${o}] ${r}`, t || ""), this.persistLog(g)
    },
    debug(e, o, r) {
        this.log("DEBUG", e, o, r)
    },
    info(e, o, r) {
        this.log("INFO", e, o, r)
    },
    warning(e, o, r) {
        this.log("WARNING", e, o, r)
    },
    error(e, o, r) {
        this.log("ERROR", e, o, r)
    },
    persistLog(e) {
        chrome.storage.local.get({
            logs: []
        }, (o => {
            const r = [...o.logs, e],
                t = r.length > 1e3 ? r.slice(r.length - 1e3) : r;
            chrome.storage.local.set({
                logs: t
            })
        }))
    },
    getLogs(e) {
        chrome.storage.local.get({
            logs: []
        }, (o => {
            e(o.logs)
        }))
    },
    clearLogs(e = null) {
        chrome.storage.local.set({
            logs: []
        }, (() => {
            this.info("Logger", "All logs cleared"), e && e()
        }))
    },
    timers: {},
    startTimer(e) {
        this.timers[e] = performance.now(), this.debug("Performance", `Timer started: ${e}`)
    },
    endTimer(e, o = "Performance") {
        if(this.timers[e]) {
            const r = performance.now() - this.timers[e];
            return this.info(o, `${e} completed in ${r.toFixed(2)}ms`), delete this.timers[e], r
        }
        return this.warning(o, `Timer not found: ${e}`), null
    }
};

function triggerAutoClick() {
    document.dispatchEvent(new CustomEvent("autoClickerPageLoaded"))
}
BackgroundLogger.info("Background", "Background service worker initialized"), chrome.tabs.onUpdated.addListener(((e, o, r) => {
    "complete" === o.status && r.url && (BackgroundLogger.debug("Background", `Tab updated: ${e}`, {
        url: r.url,
        changeInfo: o
    }), BackgroundLogger.startTimer(`script-injection-${e}`), chrome.scripting.executeScript({
        target: {
            tabId: e
        },
        function: triggerAutoClick
    }).then((() => {
        BackgroundLogger.endTimer(`script-injection-${e}`, "Background"), BackgroundLogger.info("Background", `Content script injected into tab ${e}`)
    })).catch((o => {
        BackgroundLogger.error("Background", `Failed to inject content script into tab ${e}`, {
            error: o.message
        })
    })))
})), chrome.runtime.onMessage.addListener(((e, o, r) => {
    if("getLogLevel" === e.action) r({
        level: BackgroundLogger.currentLogLevel
    }), BackgroundLogger.debug("Background", "Log level requested", {
        level: BackgroundLogger.currentLogLevel
    });
    else if("setLogLevel" === e.action) BackgroundLogger.setLogLevel(e.level), r({
        success: !0
    });
    else {
        if("getLogs" === e.action) return BackgroundLogger.getLogs((e => {
            r({
                logs: e
            })
        })), !0;
        if("clearLogs" === e.action) return BackgroundLogger.clearLogs((() => {
            r({
                success: !0
            })
        })), !0
    }
}));
