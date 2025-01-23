chrome.runtime.onInstalled.addListener(() => {
    chrome.commands.onCommand.addListener((command) => {
        if (command === 'show_hello_world') {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && !tab.url.startsWith('chrome://')) {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            const selectedText = window.getSelection().toString();
                            if (selectedText) {
                                alert(selectedText);
                            } else {
                                alert('No text selected');
                            }
                        }
                    });
                }
            });
        }
    });
});