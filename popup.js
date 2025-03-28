document.addEventListener('DOMContentLoaded', function() {
            const startSelectionBtn = document.getElementById('startSelection');
            const stopSelectionBtn = document.getElementById('stopSelection');
            const elementsList = document.getElementById('elementsList');
            const toggleManualBtn = document.getElementById('toggleManual');
            const manualSelectorForm = document.getElementById('manualSelectorForm');
            const selectorInput = document.getElementById('selectorInput');
            const elementNameInput = document.getElementById('elementNameInput');
            const saveSelectorBtn = document.getElementById('saveSelector');


            // Initialize logger
            let logger = window.autoClickerLogger;


            // Safe logging function that checks if logger is initialized
            function log(level, message, data = null) {
                if (!logger) return;

                switch (level) {
                    case 'debug':
                        logger.debug('Popup', message, data);
                        break;
                    case 'info':
                        logger.info('Popup', message, data);
                        break;
                    case 'warning':
                        logger.warning('Popup', message, data);
                        break;
                    case 'error':
                        logger.error('Popup', message, data);
                        break;
                }
            }

            log('info', 'Popup interface initialized');

            let currentDomain = '';

            // Get current tab's domain
            log('debug', 'Getting current tab domain');
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                const url = new URL(tabs[0].url);
                currentDomain = url.hostname;
                log('info', `Current domain: ${currentDomain}`, { tabId: tabs[0].id });

                // Load saved elements for this domain
                loadSavedElements(currentDomain);
            });

            toggleManualBtn.addEventListener('click', function() {
                log('info', 'Toggle manual selector form');
                if (manualSelectorForm.style.display === 'none') {
                    manualSelectorForm.style.display = 'block';
                    toggleManualBtn.textContent = 'Hide';
                } else {
                    manualSelectorForm.style.display = 'none';
                    toggleManualBtn.textContent = 'Show';
                }
            });

            // Handle manual selector save
            saveSelectorBtn.addEventListener('click', function() {
                const selector = selectorInput.value.trim();
                const elementName = elementNameInput.value.trim() || 'Manual Element';

                if (!selector) {
                    log('warning', 'Empty selector input');
                    alert('Please enter a CSS selector');
                    return;
                }

                log('info', 'Manual selector saved', { selector, name: elementName });

                // Save the selector to storage
                saveElement(currentDomain, selector, elementName);

                // Clear inputs
                selectorInput.value = '';
                elementNameInput.value = '';

                // Reload the elements list
                loadSavedElements(currentDomain);
            });

            startSelectionBtn.addEventListener('click', function() {
                log('info', 'Start selection button clicked');
                startSelectionBtn.style.display = 'none';
                stopSelectionBtn.style.display = 'block';

                chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                    log('debug', 'Sending startSelection message to tab', { tabId: tabs[0].id });
                    chrome.tabs.sendMessage(tabs[0].id, { action: "startSelection" }, function(response) {
                        if (chrome.runtime.lastError) {
                            log('error', 'Error sending startSelection message', { error: chrome.runtime.lastError.message });
                        } else if (response && response.success) {
                            log('debug', 'Selection mode started successfully');
                        }
                    });
                });
            });

            stopSelectionBtn.addEventListener('click', function() {
                log('info', 'Stop selection button clicked');
                startSelectionBtn.style.display = 'block';
                stopSelectionBtn.style.display = 'none';

                chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                    log('debug', 'Sending stopSelection message to tab', { tabId: tabs[0].id });
                    chrome.tabs.sendMessage(tabs[0].id, { action: "stopSelection" }, function(response) {
                        if (chrome.runtime.lastError) {
                            log('error', 'Error sending stopSelection message', { error: chrome.runtime.lastError.message });
                        } else if (response && response.success) {
                            log('debug', 'Selection mode stopped successfully');
                        }
                    });
                });
            });

            // Listen for messages from content script
            chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
                log('debug', 'Message received', { message, sender: sender.id });

                if (message.action === "elementSelected") {
                    log('info', 'Element selected from content script', { selector: message.selector });
                    startSelectionBtn.style.display = 'block';
                    stopSelectionBtn.style.display = 'none';

                    // Save the selected element
                    saveElement(currentDomain, message.selector, message.elementText);

                    // Reload the elements list
                    loadSavedElements(currentDomain);

                    // Send success response
                    sendResponse({ success: true });
                }

                return true; // Required for async response
            });

            function saveElement(domain, selector, text) {
                log('info', 'Saving element', { domain, selector });

                chrome.storage.local.get({ autoClickElements: {} }, function(data) {
                    if (!data.autoClickElements[domain]) {
                        data.autoClickElements[domain] = [];
                        log('debug', 'Created new domain entry', { domain });
                    }

                    const newElement = {
                        selector: selector,
                        text: text || 'Element',
                        timestamp: Date.now()
                    };

                    data.autoClickElements[domain].push(newElement);
                    log('debug', 'Element added to storage', newElement);

                    chrome.storage.local.set({ autoClickElements: data.autoClickElements }, function() {
                        if (chrome.runtime.lastError) {
                            log('error', 'Error saving element', { error: chrome.runtime.lastError.message });
                        } else {
                            log('info', 'Element saved successfully');
                        }
                    });
                });
            }

            function loadSavedElements(domain) {
                log('info', 'Loading saved elements', { domain });

                chrome.storage.local.get({ autoClickElements: {} }, function(data) {
                    elementsList.innerHTML = '';

                    const domainElements = data.autoClickElements[domain] || [];
                    log('debug', `Found ${domainElements.length} elements for domain`, { domain });

                    if (domainElements.length === 0) {
                        elementsList.innerHTML = '<p>No elements saved for this domain</p>';
                        return;
                    }

                    domainElements.forEach((element, index) => {
                        const elementItem = document.createElement('div');
                        elementItem.className = 'element-item';

                        const elementText = document.createElement('span');
                        elementText.textContent = element.text || `Element ${index + 1}`;

                        const deleteBtn = document.createElement('span');
                        deleteBtn.className = 'delete-btn';
                        deleteBtn.textContent = '✕';
                        deleteBtn.addEventListener('click', function() {
                            log('info', 'Delete button clicked', { index });
                            deleteElement(domain, index);
                        });

                        elementItem.appendChild(elementText);
                        elementItem.appendChild(deleteBtn);
                        elementsList.appendChild(elementItem);
                    });
                });
            }

            function deleteElement(domain, index) {
                log('info', 'Deleting element', { domain, index });

                chrome.storage.local.get({ autoClickElements: {} }, function(data) {
                    if (data.autoClickElements[domain]) {
                        // Get element before removal for logging
                        const removedElement = data.autoClickElements[domain][index];

                        data.autoClickElements[domain].splice(index, 1);
                        log('debug', 'Element removed from array', { element: removedElement });

                        chrome.storage.local.set({ autoClickElements: data.autoClickElements }, function() {
                            if (chrome.runtime.lastError) {
                                log('error', 'Error saving after delete', { error: chrome.runtime.lastError.message });
                            } else {
                                log('info', 'Element deleted successfully');
                                loadSavedElements(domain);
                            }
                        });
                    }
                });
            }

            // Add logging UI elements
            setupLoggingUI();

            function setupLoggingUI() {
                // Create logging tab and panel
                const tabsContainer = document.createElement('div');
                tabsContainer.className = 'tabs-container';
                tabsContainer.innerHTML = `
            <div class="tabs">
                <button class="tab-btn active" data-tab="elements">Elements</button>
                <button class="tab-btn" data-tab="logs">Logs</button>
            </div>
        `;

                // Get the saved elements container
                const savedElementsContainer = document.querySelector('.saved-elements');
                savedElementsContainer.parentNode.insertBefore(tabsContainer, savedElementsContainer);

                // Create logs panel
                const logsPanel = document.createElement('div');
                logsPanel.className = 'logs-panel';
                logsPanel.style.display = 'none';
                logsPanel.innerHTML = `
            <div class="logs-controls">
                <select id="logLevel">
                    <option value="DEBUG">Debug</option>
                    <option value="INFO" selected>Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="ERROR">Error</option>
                </select>
                <button id="clearLogs">Clear Logs</button>
                <button id="exportLogs">Export Logs</button>
            </div>
            <div class="logs-container">
                <div id="logEntries"></div>
            </div>
        `;

                document.body.appendChild(logsPanel);

                // Set up tab switching
                const tabButtons = document.querySelectorAll('.tab-btn');
                tabButtons.forEach(button => {
                    button.addEventListener('click', function() {
                        const tabName = this.getAttribute('data-tab');

                        // Update active tab
                        tabButtons.forEach(btn => btn.classList.remove('active'));
                        this.classList.add('active');

                        // Show/hide appropriate panel
                        if (tabName === 'elements') {
                            savedElementsContainer.style.display = 'block';
                            logsPanel.style.display = 'none';
                        } else if (tabName === 'logs') {
                            savedElementsContainer.style.display = 'none';
                            logsPanel.style.display = 'block';
                            refreshLogs();
                        }
                    });
                });

                // Set up log level selector
                const logLevelSelect = document.getElementById('logLevel');
                logLevelSelect.addEventListener('change', function() {
                    const selectedLevel = this.value;
                    log('info', `Log level changed to ${selectedLevel}`);

                    // Send message to background script to change log level
                    chrome.runtime.sendMessage({
                        action: "setLogLevel",
                        level: selectedLevel
                    });

                    // Refresh logs with new level
                    refreshLogs();
                });

                // Set up clear logs button
                const clearLogsBtn = document.getElementById('clearLogs');
                clearLogsBtn.addEventListener('click', function() {
                    log('info', 'Clearing all logs');

                    chrome.runtime.sendMessage({
                        action: "clearLogs"
                    }, function() {
                        refreshLogs();
                    });
                });

                // Set up export logs button
                const exportLogsBtn = document.getElementById('exportLogs');
                exportLogsBtn.addEventListener('click', function() {
                    log('info', 'Exporting logs');

                    chrome.runtime.sendMessage({
                        action: "getLogs"
                    }, function(response) {
                        if (response && response.logs) {
                            // Create a downloadable JSON file
                            const blob = new Blob([JSON.stringify(response.logs, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);

                            // Create a temporary download link
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `autoclicker-logs-${new Date().toISOString().slice(0,10)}.json`;
                            document.body.appendChild(a);
                            a.click();

                            // Clean up
                            setTimeout(function() {
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(url);
                            }, 0);
                        }
                    });
                });
            }

            function refreshLogs() {
                const logEntries = document.getElementById('logEntries');
                logEntries.innerHTML = '<div class="loading-logs">Loading logs...</div>';

                chrome.runtime.sendMessage({
                    action: "getLogs"
                }, function(response) {
                    if (response && response.logs) {
                        displayLogs(response.logs);
                    } else {
                        logEntries.innerHTML = '<div class="no-logs">No logs available</div>';
                    }
                });
            }

            function displayLogs(logs) {
                const logEntries = document.getElementById('logEntries');
                logEntries.innerHTML = '';

                if (logs.length === 0) {
                    logEntries.innerHTML = '<div class="no-logs">No logs available</div>';
                    return;
                }

                // Get current log level for filtering
                const logLevelSelect = document.getElementById('logLevel');
                const currentLevel = logLevelSelect.value;
                const LOG_LEVELS = {
                    DEBUG: 0,
                    INFO: 1,
                    WARNING: 2,
                    ERROR: 3
                };

                // Filter and display logs
                const filteredLogs = logs.filter(log => {
                    return LOG_LEVELS[log.level] >= LOG_LEVELS[currentLevel];
                });

                if (filteredLogs.length === 0) {
                    logEntries.innerHTML = `<div class="no-logs">No logs at level ${currentLevel} or higher</div>`;
                    return;
                }

                // Display logs (most recent first)
                filteredLogs.reverse().forEach(log => {
                            const logEntry = document.createElement('div');
                            logEntry.className = `log-entry log-${log.level.toLowerCase()}`;

                            // Format timestamp
                            const timestamp = new Date(log.timestamp);
                            const formattedTime = timestamp.toLocaleTimeString();

                            logEntry.innerHTML = `
                <div class="log-header">
                    <span class="log-time">${formattedTime}</span>
                    <span class="log-level">${log.level}</span>
                    <span class="log-module">${log.module}</span>
                </div>
                <div class="log-message">${log.message}</div>
                ${log.data ? `<div class="log-data">${log.data}</div>` : ''}
            `;
            
            logEntries.appendChild(logEntry);
        });
    }
});