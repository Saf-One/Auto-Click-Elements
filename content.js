let isSelecting = !1,
    highlightedElement = null,
    highlightOverlay = null,
    logger = window.autoClickerLogger;

function log(e, t, o = null) {
    if(logger) switch(e) {
        case "debug":
            logger.debug("Content", t, o);
            break;
        case "info":
            logger.info("Content", t, o);
            break;
        case "warning":
            logger.warning("Content", t, o);
            break;
        case "error":
            logger.error("Content", t, o)
    }
}
log("info", "Content script initialized", {
    url: window.location.href
}), chrome.runtime.onMessage.addListener((function(e, t, o) {
    return log("debug", "Message received from popup", {
        message: e
    }), "startSelection" === e.action ? (log("info", "Starting element selection mode"), startElementSelection(), o({
        success: !0
    })) : "stopSelection" === e.action && (log("info", "Stopping element selection mode"), stopElementSelection(), o({
        success: !0
    })), !0
})), window.addEventListener("load", (function() {
    log("info", "Page load event triggered"), setTimeout((() => {
        log("debug", "Running delayed autoClickElements after page load"), autoClickElements("page-load")
    }), 1e3)
})), document.addEventListener("DOMContentLoaded", (function() {
    log("info", "DOMContentLoaded event triggered"), setTimeout((() => {
        log("debug", "Running delayed autoClickElements after DOMContentLoaded"), autoClickElements("dom-content-loaded")
    }), 500)
})), document.addEventListener("autoClickerPageLoaded", (function() {
    log("info", "Received autoClickerPageLoaded event"), setTimeout((() => {
        log("debug", "Running delayed autoClickElements after autoClickerPageLoaded event"), autoClickElements("background-trigger")
    }), 300)
}));
const observer = new MutationObserver((function(e) {
    log("debug", "DOM mutations detected", {
        count: e.length,
        types: e.map((e => e.type)).filter(((e, t, o) => o.indexOf(e) === t))
    }), window.autoClickTimeout && clearTimeout(window.autoClickTimeout), window.autoClickTimeout = setTimeout((() => {
        log("debug", "Running delayed autoClickElements after DOM mutation"), autoClickElements("mutation-observer")
    }), 500)
}));

function startElementSelection() {
    log("info", "Element selection started"), isSelecting = !0, highlightOverlay = document.createElement("div"), highlightOverlay.style.position = "absolute", highlightOverlay.style.border = "2px solid red", highlightOverlay.style.backgroundColor = "rgba(255, 0, 0, 0.2)", highlightOverlay.style.pointerEvents = "none", highlightOverlay.style.zIndex = "9999", document.body.appendChild(highlightOverlay), log("debug", "Highlight overlay created"), document.addEventListener("mousemove", handleMouseMove), document.addEventListener("click", handleElementClick), log("debug", "Selection event listeners attached")
}

function stopElementSelection() {
    log("info", "Element selection stopped"), isSelecting = !1, highlightOverlay && (document.body.removeChild(highlightOverlay), highlightOverlay = null, log("debug", "Highlight overlay removed")), document.removeEventListener("mousemove", handleMouseMove), document.removeEventListener("click", handleElementClick), log("debug", "Selection event listeners removed")
}

function handleMouseMove(e) {
    if(!isSelecting) return;
    const t = document.elementsFromPoint(e.clientX, e.clientY).find((e => e !== highlightOverlay));
    if(t && t !== document.body && t !== document.documentElement) {
        highlightedElement !== t && (highlightedElement = t, log("debug", "Hovering over new element", {
            tag: t.tagName,
            id: t.id,
            classes: t.className
        }));
        const e = t.getBoundingClientRect();
        highlightOverlay.style.top = e.top + window.scrollY + "px", highlightOverlay.style.left = e.left + window.scrollX + "px", highlightOverlay.style.width = e.width + "px", highlightOverlay.style.height = e.height + "px"
    }
}

function handleElementClick(e) {
    if(!isSelecting || !highlightedElement) return;
    e.preventDefault(), e.stopPropagation(), log("info", "Element selected by user", {
        tag: highlightedElement.tagName,
        id: highlightedElement.id,
        classes: highlightedElement.className
    }), log("debug", "Generating selector for selected element");
    const t = performance.now(),
        o = generateSelector(highlightedElement);
    log("info", "Selector generation completed", {
        timeMs: performance.now() - t
    });
    const n = highlightedElement.textContent.trim().substring(0, 30);
    log("info", "Selector generated", {
        selector: o,
        elementText: n
    }), chrome.runtime.sendMessage({
        action: "elementSelected",
        selector: o,
        elementText: n
    }, (e => {
        e && e.success ? log("debug", "Popup acknowledged element selection") : log("warning", "No response from popup for element selection")
    })), stopElementSelection()
}

function generateSelector(e) {
    if(log("debug", "Starting selector generation"), e.id) return log("debug", "Generated ID-based selector", {
        id: e.id
    }), `#${e.id}`;
    if(e.className) {
        const t = e.className.split(" ").filter((e => e.trim().length > 0)).map((e => `.${e}`)).join("");
        if(t) {
            const o = `${e.tagName.toLowerCase()}${t}`;
            return log("debug", "Generated class-based selector", {
                selector: o
            }), o
        }
    }
    let t = [],
        o = e;
    for(; o && o !== document.body;) {
        let e = o.tagName.toLowerCase(),
            n = Array.from(o.parentNode.children);
        if(n.length > 1) {
            e += `:nth-child(${n.indexOf(o)+1})`
        }
        t.unshift(e), o = o.parentNode
    }
    const n = t.join(" > ");
    return log("debug", "Generated position-based selector", {
        selector: n
    }), n
}

function autoClickElements(e) {
    const t = window.location.hostname;
    log("info", `Attempting to auto-click elements for domain: ${t}`, {
        trigger: e
    });
    const o = performance.now();
    chrome.storage.local.get({
        autoClickElements: {}
    }, (function(n) {
        const l = n.autoClickElements[t] || [];
        if(log("info", `Found ${l.length} saved elements for domain`, {
                domain: t
            }), 0 === l.length) return void log("debug", "No elements to click for this domain");
        let i = 0,
            r = 0;
        l.forEach(((e, t) => {
            try {
                log("debug", `Looking for element with selector: ${e.selector}`, {
                    index: t
                });
                const o = document.querySelector(e.selector);
                if(o)
                    if(log("debug", "Target element found, checking visibility", {
                            selector: e.selector
                        }), isElementVisible(o)) {
                        log("info", "Clicking element", {
                            selector: e.selector,
                            text: o.textContent ? o.textContent.trim().substring(0, 30) : "[no text]"
                        });
                        try {
                            o.click(), i++, log("info", "Element clicked successfully", {
                                selector: e.selector
                            })
                        } catch (t) {
                            r++, log("error", "Error during click operation", {
                                selector: e.selector,
                                error: t.message
                            })
                        }
                    } else log("info", "Element found but not visible", {
                        selector: e.selector
                    });
                else log("warning", "Element not found in DOM", {
                    selector: e.selector
                })
            } catch (t) {
                r++, log("error", "Error processing element", {
                    selector: e.selector,
                    error: t.message
                })
            }
        }));
        const g = performance.now();
        log("info", "Auto-click operation completed", {
            trigger: e,
            total: l.length,
            clicked: i,
            errors: r,
            timeMs: g - o
        })
    }))
}

function isElementVisible(e) {
    log("debug", "Checking element visibility");
    try {
        const t = window.getComputedStyle(e),
            o = "none" !== t.display && "hidden" !== t.visibility && e.offsetWidth > 0 && e.offsetHeight > 0;
        return log("debug", "Visibility check result", {
            isVisible: o,
            display: t.display,
            visibility: t.visibility,
            width: e.offsetWidth,
            height: e.offsetHeight
        }), o
    } catch (e) {
        return log("error", "Error checking element visibility", {
            error: e.message
        }), !1
    }
}
log("debug", "Setting up MutationObserver"), observer.observe(document.documentElement, {
    childList: !0,
    subtree: !0
});
