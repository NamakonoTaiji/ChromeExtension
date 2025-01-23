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
                                chrome.runtime.sendMessage({ text: selectedText });
                            } else {
                                chrome.runtime.sendMessage({ error: 'No text selected' });
                            }
                        }
                    });
                }
            });
        }
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.text) {
        chrome.tabs.query({ url: '*://copilot.microsoft.com/chats/*' }, (tabs) => {
            if (tabs && tabs.length > 0) {
                const copilotTab = tabs[0];
                chrome.scripting.executeScript({
                    target: { tabId: copilotTab.id },
                    func: (text) => {
                        const textarea = document.querySelector('textarea'); // 適切なセレクタに変更
                        if (textarea) {
                            textarea.value = text;
                            textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        } else {
                            chrome.runtime.sendMessage({ error: 'Textarea not found' });
                        }
                    },
                    args: [message.text]
                });
            } else {
                chrome.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    func: () => {
                        alert('Copilot tab not found');
                    }
                });
            }
        });
    } else if (message.error) {
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            func: (error) => {
                alert(error);
            },
            args: [message.error]
        });
    }
});