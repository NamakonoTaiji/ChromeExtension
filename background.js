/*
この拡張機能の大まかな流れ:
1. 拡張機能がインストールされたときに、コマンドリスナーを設定。
2. ユーザーが特定のコマンド（'copilot_selectedText_send'）を実行すると、現在のアクティブなタブから選択されたテキストを取得。
3. 取得したテキストをCopilotのチャットページに入力し、送信ボタンをクリック。
4. Copilotのチャットページで新しいメッセージが追加されるのを監視し、追加されたメッセージを取得。
5. 取得したメッセージをポップアップで表示。

具体的な処理:
- chrome.runtime.onInstalled: 拡張機能がインストールされたときのイベントリスナー。
- chrome.commands.onCommand: ユーザーがコマンドを実行したときのイベントリスナー。
- chrome.tabs.query: 現在のアクティブなタブを取得。
- chrome.scripting.executeScript: スクリプトを実行して選択されたテキストを取得し、Copilotのチャットページに入力。
- chrome.runtime.onMessage: 選択したメッセージを受信したときのイベントリスナー。
- MutationObserver: Copilotのチャットページで新しいメッセージが追加されるのを監視。
*/

// 拡張機能がインストールされたときのイベントリスナー
chrome.runtime.onInstalled.addListener(() => {
    // コマンドが実行されたときのイベントリスナー
    chrome.commands.onCommand.addListener((command) => {
        if (command === 'copilot_selectedText_send') {
            // 現在のアクティブなタブを取得
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && !tab.url.startsWith('chrome://')) {
                    // スクリプトを実行して選択されたテキストを取得
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
                    }, (results) => {
                        if (chrome.runtime.lastError) {
                            console.error('Script execution failed:', chrome.runtime.lastError);
                        } else {
                            console.log('Script executed successfully:', results);
                        }
                    });
                }
            });
        }
    });
});

// メッセージを受信したときのイベントリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.text) {
        console.log('Message text:', message.text); // デバッグメッセージを追加
        // Copilotのタブを検索
        chrome.tabs.query({ url: '*://copilot.microsoft.com/*' }, (tabs) => {
            if (tabs && tabs.length > 0) {
                const copilotTab = tabs[0];
                // スクリプトを実行してテキストエリアにメッセージを入力し、送信ボタンをクリック
                chrome.scripting.executeScript({
                    target: { tabId: copilotTab.id },
                    func: (text) => {
                        const textarea = document.querySelector('#userInput'); // id=userInputのテキストエリアを選択
                        if (textarea) {
                            textarea.value = text;
                            textarea.dispatchEvent(new Event('input', { bubbles: true }));
                            // 少し待ってから送信ボタンをクリック
                            setTimeout(() => {
                                const sendButton = document.querySelector('.rounded-submitButton');
                                if (sendButton) {
                                    sendButton.click();
                                } else {
                                    chrome.runtime.sendMessage({ error: 'Send button not found' });
                                }
                            }, 1000); // 1秒待つ
                        } else {
                            chrome.runtime.sendMessage({ error: 'Textarea not found' });
                        }
                    },
                    args: [message.text]
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        console.error('Script execution failed:', chrome.runtime.lastError);
                    } else {
                        console.log('Script executed for text input and send button click:', results); // デバッグメッセージを追加
                    }
                });

                // 回答を取得して表示
                debuggingValue = 0;
                chrome.scripting.executeScript({
                    target: { tabId: copilotTab.id },
                    func: () => {
                        debuggingValue += 1;
                        console.log('Starting MutationObserver'); // デバッグメッセージを追加
                        const observer = new MutationObserver((mutations) => {
                            mutations.forEach((mutation) => {
                                console.log('Mutation detected:', mutation); // デバッグメッセージを追加
                                mutation.addedNodes.forEach((node) => {
                                    if (node.nodeType === Node.ELEMENT_NODE) {
                                        const response = node.innerText; // 適切なセレクタに変更
                                        console.log('Detected response:', response); // デバッグメッセージを追加
                                        chrome.runtime.sendMessage({ response });
                                    }
                                });
                            });
                        });
                        const config = { childList: true, subtree: true };
                        setTimeout(() => {
                            const targetNode = document.querySelector('.space-y-3.break-words'); // 適切なセレクタに変更
                            if (targetNode) {
                                console.log('Target node found:', targetNode); // デバッグメッセージを追加
                                observer.observe(targetNode, config);
                                console.log('Observer started'); // デバッグメッセージを追加
                            } else {
                                console.log('Target node not found'); // デバッグメッセージを追加
                            }
                        }, 2000); // 2秒待つ

                    }
                }, (results) => {
                    console.log('debuggingValue:', debuggingValue);
                    if (chrome.runtime.lastError) {
                        console.error('Script execution failed:', chrome.runtime.lastError);
                    } else {
                        console.log('Script executed for MutationObserver:', results); // デバッグメッセージを追加
                    }
                });
            } else {
                // Copilotのタブが見つからない場合の処理
                chrome.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    func: () => {
                        alert('Copilot tab not found');
                    }
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        console.error('Script execution failed:', chrome.runtime.lastError);
                    } else {
                        console.log('Script executed for alert:', results); // デバッグメッセージを追加
                    }
                });
            }
        });
    } else if (message.error) {
        console.log('Message error:', message.error); // デバッグメッセージを追加
        // エラーメッセージをアラートで表示
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            func: (error) => {
                alert(error);
            },
            args: [message.error]
        }, (results) => {
            if (chrome.runtime.lastError) {
                console.error('Script execution failed:', chrome.runtime.lastError);
            } else {
                console.log('Script executed for error alert:', results); // デバッグメッセージを追加
            }
        });
    } else if (message.response) {
        console.log('Message response:', message.response); // デバッグメッセージを追加
        // 回答をポップアップで表示
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            func: (response) => {
                console.log('Displaying popup with response:', response); // デバッグメッセージを追加
                const existingPopup = document.getElementById('copilot-popup');
                if (existingPopup) {
                    existingPopup.remove();
                }

                const popup = document.createElement('div');
                popup.id = 'copilot-popup';
                popup.style.position = 'fixed';
                popup.style.bottom = '10px';
                popup.style.right = '10px';
                popup.style.width = '300px';
                popup.style.height = '200px';
                popup.style.backgroundColor = 'white';
                popup.style.border = '1px solid black';
                popup.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                popup.style.zIndex = 10000;
                popup.style.padding = '10px';
                popup.style.overflow = 'auto';

                const content = document.createElement('div');
                content.innerText = response;

                popup.appendChild(content);
                document.body.appendChild(popup);

                // 枠外をクリックするとポップアップを削除
                const removePopup = (event) => {
                    if (!popup.contains(event.target)) {
                        popup.remove();
                        document.removeEventListener('click', removePopup);
                    }
                };

                document.addEventListener('click', removePopup);
            },
            args: [message.response]
        }, (results) => {
            if (chrome.runtime.lastError) {
                console.error('Script execution failed:', chrome.runtime.lastError);
            } else {
                console.log('Script executed for response popup:', results); // デバッグメッセージを追加
            }
        });
    }
});