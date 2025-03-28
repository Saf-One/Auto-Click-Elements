document.addEventListener("DOMContentLoaded", (function() {
    const e = document.getElementById("startSelection"),
        t = document.getElementById("stopSelection"),
        n = document.getElementById("elementsList"),
        o = document.getElementById("toggleManual"),
        s = document.getElementById("manualSelectorForm"),
        l = document.getElementById("selectorInput"),
        i = document.getElementById("elementNameInput"),
        a = document.getElementById("saveSelector");
    let c = window.autoClickerLogger;

    function r(e, t, n = null) {
        if(c) switch(e) {
            case "debug":
                c.debug("Popup", t, n);
                break;
            case "info":
                c.info("Popup", t, n);
                break;
            case "warning":
                c.warning("Popup", t, n);
                break;
            case "error":
                c.error("Popup", t, n)
        }
    }
    r("info", "Popup interface initialized");
    let d = "";

    function m(e, t, n) {
        r("info", "Saving element", {
            domain: e,
            selector: t
        }), chrome.storage.local.get({
            autoClickElements: {}
        }, (function(o) {
            o.autoClickElements[e] || (o.autoClickElements[e] = [], r("debug", "Created new domain entry", {
                domain: e
            }));
            const s = {
                selector: t,
                text: n || "Element",
                timestamp: Date.now()
            };
            o.autoClickElements[e].push(s), r("debug", "Element added to storage", s), chrome.storage.local.set({
                autoClickElements: o.autoClickElements
            }, (function() {
                chrome.runtime.lastError ? r("error", "Error saving element", {
                    error: chrome.runtime.lastError.message
                }) : r("info", "Element saved successfully")
            }))
        }))
    }

    function u(e) {
        r("info", "Loading saved elements", {
            domain: e
        }), chrome.storage.local.get({
            autoClickElements: {}
        }, (function(t) {
            n.innerHTML = "";
            const o = t.autoClickElements[e] || [];
            r("debug", `Found ${o.length} elements for domain`, {
                domain: e
            }), 0 !== o.length ? o.forEach(((t, o) => {
                const s = document.createElement("div");
                s.className = "element-item";
                const l = document.createElement("span");
                l.textContent = t.text || `Element ${o+1}`;
                const i = document.createElement("span");
                i.className = "delete-btn", i.textContent = "✕", i.addEventListener("click", (function() {
                    r("info", "Delete button clicked", {
                            index: o
                        }),
                        function(e, t) {
                            r("info", "Deleting element", {
                                domain: e,
                                index: t
                            }), chrome.storage.local.get({
                                autoClickElements: {}
                            }, (function(n) {
                                if(n.autoClickElements[e]) {
                                    const o = n.autoClickElements[e][t];
                                    n.autoClickElements[e].splice(t, 1), r("debug", "Element removed from array", {
                                        element: o
                                    }), chrome.storage.local.set({
                                        autoClickElements: n.autoClickElements
                                    }, (function() {
                                        chrome.runtime.lastError ? r("error", "Error saving after delete", {
                                            error: chrome.runtime.lastError.message
                                        }) : (r("info", "Element deleted successfully"), u(e))
                                    }))
                                }
                            }))
                        }(e, o)
                })), s.appendChild(l), s.appendChild(i), n.appendChild(s)
            })) : n.innerHTML = "<p>No elements saved for this domain</p>"
        }))
    }

    function g() {
        const e = document.getElementById("logEntries");
        e.innerHTML = '<div class="loading-logs">Loading logs...</div>', chrome.runtime.sendMessage({
            action: "getLogs"
        }, (function(t) {
            t && t.logs ? function(e) {
                const t = document.getElementById("logEntries");
                if(t.innerHTML = "", 0 === e.length) return void(t.innerHTML = '<div class="no-logs">No logs available</div>');
                const n = document.getElementById("logLevel").value,
                    o = {
                        DEBUG: 0,
                        INFO: 1,
                        WARNING: 2,
                        ERROR: 3
                    },
                    s = e.filter((e => o[e.level] >= o[n]));
                if(0 === s.length) return void(t.innerHTML = `<div class="no-logs">No logs at level ${n} or higher</div>`);
                s.reverse().forEach((e => {
                    const n = document.createElement("div");
                    n.className = `log-entry log-${e.level.toLowerCase()}`;
                    const o = new Date(e.timestamp).toLocaleTimeString();
                    n.innerHTML = `\n                <div class="log-header">\n                    <span class="log-time">${o}</span>\n                    <span class="log-level">${e.level}</span>\n                    <span class="log-module">${e.module}</span>\n                </div>\n                <div class="log-message">${e.message}</div>\n                ${e.data?`<div class="log-data">${e.data}</div>`:""}\n            `, t.appendChild(n)
                }))
            }(t.logs) : e.innerHTML = '<div class="no-logs">No logs available</div>'
        }))
    }
    r("debug", "Getting current tab domain"), chrome.tabs.query({
            active: !0,
            currentWindow: !0
        }, (function(e) {
            const t = new URL(e[0].url);
            d = t.hostname, r("info", `Current domain: ${d}`, {
                tabId: e[0].id
            }), u(d)
        })), o.addEventListener("click", (function() {
            r("info", "Toggle manual selector form"), "none" === s.style.display ? (s.style.display = "block", o.textContent = "Hide") : (s.style.display = "none", o.textContent = "Show")
        })), a.addEventListener("click", (function() {
            const e = l.value.trim(),
                t = i.value.trim() || "Manual Element";
            if(!e) return r("warning", "Empty selector input"), void alert("Please enter a CSS selector");
            r("info", "Manual selector saved", {
                selector: e,
                name: t
            }), m(d, e, t), l.value = "", i.value = "", u(d)
        })), e.addEventListener("click", (function() {
            r("info", "Start selection button clicked"), e.style.display = "none", t.style.display = "block", chrome.tabs.query({
                active: !0,
                currentWindow: !0
            }, (function(e) {
                r("debug", "Sending startSelection message to tab", {
                    tabId: e[0].id
                }), chrome.tabs.sendMessage(e[0].id, {
                    action: "startSelection"
                }, (function(e) {
                    chrome.runtime.lastError ? r("error", "Error sending startSelection message", {
                        error: chrome.runtime.lastError.message
                    }) : e && e.success && r("debug", "Selection mode started successfully")
                }))
            }))
        })), t.addEventListener("click", (function() {
            r("info", "Stop selection button clicked"), e.style.display = "block", t.style.display = "none", chrome.tabs.query({
                active: !0,
                currentWindow: !0
            }, (function(e) {
                r("debug", "Sending stopSelection message to tab", {
                    tabId: e[0].id
                }), chrome.tabs.sendMessage(e[0].id, {
                    action: "stopSelection"
                }, (function(e) {
                    chrome.runtime.lastError ? r("error", "Error sending stopSelection message", {
                        error: chrome.runtime.lastError.message
                    }) : e && e.success && r("debug", "Selection mode stopped successfully")
                }))
            }))
        })), chrome.runtime.onMessage.addListener((function(n, o, s) {
            return r("debug", "Message received", {
                message: n,
                sender: o.id
            }), "elementSelected" === n.action && (r("info", "Element selected from content script", {
                selector: n.selector
            }), e.style.display = "block", t.style.display = "none", m(d, n.selector, n.elementText), u(d), s({
                success: !0
            })), !0
        })),
        function() {
            const e = document.createElement("div");
            e.className = "tabs-container", e.innerHTML = '\n            <div class="tabs">\n                <button class="tab-btn active" data-tab="elements">Elements</button>\n                <button class="tab-btn" data-tab="logs">Logs</button>\n            </div>\n        ';
            const t = document.querySelector(".saved-elements");
            t.parentNode.insertBefore(e, t);
            const n = document.createElement("div");
            n.className = "logs-panel", n.style.display = "none", n.innerHTML = '\n            <div class="logs-controls">\n                <select id="logLevel">\n                    <option value="DEBUG">Debug</option>\n                    <option value="INFO" selected>Info</option>\n                    <option value="WARNING">Warning</option>\n                    <option value="ERROR">Error</option>\n                </select>\n                <button id="clearLogs">Clear Logs</button>\n                <button id="exportLogs">Export Logs</button>\n            </div>\n            <div class="logs-container">\n                <div id="logEntries"></div>\n            </div>\n        ', document.body.appendChild(n);
            const o = document.querySelectorAll(".tab-btn");
            o.forEach((e => {
                e.addEventListener("click", (function() {
                    const e = this.getAttribute("data-tab");
                    o.forEach((e => e.classList.remove("active"))), this.classList.add("active"), "elements" === e ? (t.style.display = "block", n.style.display = "none") : "logs" === e && (t.style.display = "none", n.style.display = "block", g())
                }))
            }));
            document.getElementById("logLevel").addEventListener("change", (function() {
                const e = this.value;
                r("info", `Log level changed to ${e}`), chrome.runtime.sendMessage({
                    action: "setLogLevel",
                    level: e
                }), g()
            }));
            document.getElementById("clearLogs").addEventListener("click", (function() {
                r("info", "Clearing all logs"), chrome.runtime.sendMessage({
                    action: "clearLogs"
                }, (function() {
                    g()
                }))
            }));
            document.getElementById("exportLogs").addEventListener("click", (function() {
                r("info", "Exporting logs"), chrome.runtime.sendMessage({
                    action: "getLogs"
                }, (function(e) {
                    if(e && e.logs) {
                        const t = new Blob([JSON.stringify(e.logs, null, 2)], {
                                type: "application/json"
                            }),
                            n = URL.createObjectURL(t),
                            o = document.createElement("a");
                        o.href = n, o.download = `autoclicker-logs-${(new Date).toISOString().slice(0,10)}.json`, document.body.appendChild(o), o.click(), setTimeout((function() {
                            document.body.removeChild(o), window.URL.revokeObjectURL(n)
                        }), 0)
                    }
                }))
            }))
        }()
}));
