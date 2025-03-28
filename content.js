// Initialize module-level variables
let isSelecting = false;
let highlightedElement = null;
let highlightOverlay = null;
let logger = window.autoClickerLogger; // Get the logger from window if available

// Safe logging function that checks if logger is initialized
function log(level, message, data = null) {
    if (!logger) return;

    switch (level) {
        case 'debug':
            logger.debug('Content', message, data);
            break;
        case 'info':
            logger.info('Content', message, data);
            break;
        case 'warning':
            logger.warning('Content', message, data);
            break;
        case 'error':
            logger.error('Content', message, data);
            break;
    }
}

// Log content script initialization
log('info', 'Content script initialized', { url: window.location.href });

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    log('debug', 'Message received from popup', { message });

    if (message.action === "startSelection") {
        log('info', 'Starting element selection mode');
        startElementSelection();
        sendResponse({ success: true });
    } else if (message.action === "stopSelection") {
        log('info', 'Stopping element selection mode');
        stopElementSelection();
        sendResponse({ success: true });
    }

    return true; // Required for async response
});

// Auto-click saved elements when page loads
window.addEventListener('load', function() {
    log('info', 'Page load event triggered');
    setTimeout(() => {
        log('debug', 'Running delayed autoClickElements after page load');
        autoClickElements('page-load');
    }, 1000); // Wait a second for page to fully render
});

// Also try clicking when DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    log('info', 'DOMContentLoaded event triggered');
    setTimeout(() => {
        log('debug', 'Running delayed autoClickElements after DOMContentLoaded');
        autoClickElements('dom-content-loaded');
    }, 500);
});

// Listen for custom event from background script
document.addEventListener('autoClickerPageLoaded', function() {
    log('info', 'Received autoClickerPageLoaded event');
    setTimeout(() => {
        log('debug', 'Running delayed autoClickElements after autoClickerPageLoaded event');
        autoClickElements('background-trigger');
    }, 300);
});

// And when DOM is modified (for dynamic content)
const observer = new MutationObserver(function(mutations) {
    // Log mutation details at debug level
    log('debug', 'DOM mutations detected', {
        count: mutations.length,
        types: mutations.map(m => m.type).filter((v, i, a) => a.indexOf(v) === i)
    });

    // Debounce to avoid too many checks
    if (window.autoClickTimeout) {
        clearTimeout(window.autoClickTimeout);
    }
    window.autoClickTimeout = setTimeout(() => {
        log('debug', 'Running delayed autoClickElements after DOM mutation');
        autoClickElements('mutation-observer');
    }, 500);
});

log('debug', 'Setting up MutationObserver');
observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});

function startElementSelection() {
    log('info', 'Element selection started');
    isSelecting = true;

    // Create highlight overlay
    highlightOverlay = document.createElement('div');
    highlightOverlay.style.position = 'absolute';
    highlightOverlay.style.border = '2px solid red';
    highlightOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
    highlightOverlay.style.pointerEvents = 'none';
    highlightOverlay.style.zIndex = '9999';
    document.body.appendChild(highlightOverlay);
    log('debug', 'Highlight overlay created');

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleElementClick);
    log('debug', 'Selection event listeners attached');
}

function stopElementSelection() {
    log('info', 'Element selection stopped');
    isSelecting = false;

    // Remove highlight overlay
    if (highlightOverlay) {
        document.body.removeChild(highlightOverlay);
        highlightOverlay = null;
        log('debug', 'Highlight overlay removed');
    }

    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleElementClick);
    log('debug', 'Selection event listeners removed');
}

function handleMouseMove(e) {
    if (!isSelecting) return;

    // Prevent highlighting the overlay itself
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const targetElement = elements.find(el => el !== highlightOverlay);

    if (targetElement && targetElement !== document.body && targetElement !== document.documentElement) {
        if (highlightedElement !== targetElement) {
            highlightedElement = targetElement;
            log('debug', 'Hovering over new element', {
                tag: targetElement.tagName,
                id: targetElement.id,
                classes: targetElement.className
            });
        }

        // Update overlay position
        const rect = targetElement.getBoundingClientRect();
        highlightOverlay.style.top = (rect.top + window.scrollY) + 'px';
        highlightOverlay.style.left = (rect.left + window.scrollX) + 'px';
        highlightOverlay.style.width = rect.width + 'px';
        highlightOverlay.style.height = rect.height + 'px';
    }
}

function handleElementClick(e) {
    if (!isSelecting || !highlightedElement) return;

    e.preventDefault();
    e.stopPropagation();

    log('info', 'Element selected by user', {
        tag: highlightedElement.tagName,
        id: highlightedElement.id,
        classes: highlightedElement.className
    });

    // Generate a unique selector for the element
    log('debug', 'Generating selector for selected element');
    const startTime = performance.now();
    const selector = generateSelector(highlightedElement);
    const endTime = performance.now();
    log('info', 'Selector generation completed', { timeMs: endTime - startTime });

    const elementText = highlightedElement.textContent.trim().substring(0, 30);

    log('info', 'Selector generated', { selector, elementText });

    // Send the selected element back to the popup
    chrome.runtime.sendMessage({
        action: "elementSelected",
        selector: selector,
        elementText: elementText
    }, response => {
        if (response && response.success) {
            log('debug', 'Popup acknowledged element selection');
        } else {
            log('warning', 'No response from popup for element selection');
        }
    });

    stopElementSelection();
}

function generateSelector(element) {
    // Try to create a unique selector for the element
    // This is a simplified version - a real implementation would be more robust
    log('debug', 'Starting selector generation');

    // If element has an id, use that
    if (element.id) {
        log('debug', 'Generated ID-based selector', { id: element.id });
        return `#${element.id}`;
    }

    // Try using a combination of tag and classes
    if (element.className) {
        const classes = element.className.split(' ')
            .filter(c => c.trim().length > 0)
            .map(c => `.${c}`)
            .join('');

        if (classes) {
            const selector = `${element.tagName.toLowerCase()}${classes}`;
            log('debug', 'Generated class-based selector', { selector });
            return selector;
        }
    }

    // If no good identifier, use the element's position in the DOM
    let path = [];
    let currentElement = element;

    while (currentElement && currentElement !== document.body) {
        let selector = currentElement.tagName.toLowerCase();

        // Add index among siblings
        let siblings = Array.from(currentElement.parentNode.children);
        if (siblings.length > 1) {
            const index = siblings.indexOf(currentElement) + 1;
            selector += `:nth-child(${index})`;
        }

        path.unshift(selector);
        currentElement = currentElement.parentNode;
    }

    const fullPath = path.join(' > ');
    log('debug', 'Generated position-based selector', { selector: fullPath });
    return fullPath;
}

function autoClickElements(trigger) {
    const domain = window.location.hostname;
    log('info', `Attempting to auto-click elements for domain: ${domain}`, { trigger });

    const startTime = performance.now();
    chrome.storage.local.get({ autoClickElements: {} }, function(data) {
        const domainElements = data.autoClickElements[domain] || [];

        log('info', `Found ${domainElements.length} saved elements for domain`, { domain });

        if (domainElements.length === 0) {
            log('debug', 'No elements to click for this domain');
            return;
        }

        let clickCount = 0;
        let errorCount = 0;

        domainElements.forEach((element, index) => {
            try {
                log('debug', `Looking for element with selector: ${element.selector}`, { index });

                const targetElement = document.querySelector(element.selector);

                if (targetElement) {
                    log('debug', 'Target element found, checking visibility', { selector: element.selector });
                    if (isElementVisible(targetElement)) {
                        log('info', 'Clicking element', {
                            selector: element.selector,
                            text: targetElement.textContent ? targetElement.textContent.trim().substring(0, 30) : '[no text]'
                        });

                        // Wrap click in try-catch to prevent one click failure from stopping others
                        try {
                            targetElement.click();
                            clickCount++;
                            log('info', 'Element clicked successfully', { selector: element.selector });
                        } catch (clickError) {
                            errorCount++;
                            log('error', 'Error during click operation', {
                                selector: element.selector,
                                error: clickError.message
                            });
                        }
                    } else {
                        log('info', 'Element found but not visible', { selector: element.selector });
                    }
                } else {
                    log('warning', 'Element not found in DOM', { selector: element.selector });
                }
            } catch (error) {
                errorCount++;
                log('error', 'Error processing element', {
                    selector: element.selector,
                    error: error.message
                });
            }
        });

        const endTime = performance.now();
        log('info', 'Auto-click operation completed', {
            trigger,
            total: domainElements.length,
            clicked: clickCount,
            errors: errorCount,
            timeMs: endTime - startTime
        });
    });
}

function isElementVisible(element) {
    log('debug', 'Checking element visibility');

    try {
        const style = window.getComputedStyle(element);
        const isVisible = style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            element.offsetWidth > 0 &&
            element.offsetHeight > 0;

        log('debug', 'Visibility check result', {
            isVisible,
            display: style.display,
            visibility: style.visibility,
            width: element.offsetWidth,
            height: element.offsetHeight
        });

        return isVisible;
    } catch (error) {
        log('error', 'Error checking element visibility', { error: error.message });
        return false;
    }
}