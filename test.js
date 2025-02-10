// background.js

chrome.commands.onCommand.addListener((command) => {
  if (command === "transfer-selected-text") {
    transferSelectedText();
  }
});

async function transferSelectedText() {
  try {
    // 1. アクティブなタブを取得
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // 2. 選択されたテキストを取得
    const [{ result: selectedText }] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => window.getSelection().toString(),
    });

    if (!selectedText) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon48.png"),
        title: "エラー",
        message: "テキストが選択されていません。",
      });
      return;
    }

    // 3. ポップアップを表示
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (selectedText) => {
        function showPopup(selectedText) {
          // 既存のポップアップがあれば削除
          const existingPopup = document.getElementById("myExtensionPopup");
          if (existingPopup) {
            existingPopup.remove();
          }

          // ポップアップ要素を作成
          const popup = document.createElement("div");
          popup.id = "myExtensionPopup";
          popup.innerText = selectedText || "テキストが選択されていません。";

          // スタイルを設定
          Object.assign(popup.style, {
            position: "fixed",
            top: "10px",
            right: "10px",
            backgroundColor: "#333",
            color: "#fff",
            padding: "15px",
            borderRadius: "8px",
            zIndex: "10000",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
            maxWidth: "300px",
            fontSize: "14px",
            lineHeight: "1.5",
            cursor: "pointer",
            opacity: "0",
            transition: "opacity 0.3s ease-in-out",
          });

          // ポップアップをフェードイン
          requestAnimationFrame(() => {
            popup.style.opacity = "1";
          });

          // クリックでポップアップを閉じる
          popup.addEventListener("click", () => {
            popup.style.opacity = "0";
            setTimeout(() => {
              popup.remove();
            }, 300);
          });

          // ページにポップアップを追加
          document.body.appendChild(popup);
        }

        showPopup(selectedText);
      },
      args: [selectedText],
    });

    // 4. Copilotタブを検索
    const copilotTabs = await chrome.tabs.query({
      url: "https://copilot.microsoft.com/*",
    });

    if (copilotTabs.length === 0) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon48.png"),
        title: "エラー",
        message: "Copilotを開いているタブが見つかりません。",
      });
      return;
    }

    // 5. Copilotタブにテキストを転送して送信
    const tab = copilotTabs[0]; // 最初のCopilotタブを取得

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selectedText) => {
        const inputArea = document.querySelector("#userInput");
        if (inputArea) {
          inputArea.value = selectedText;

          // 入力イベントを発火して UI を更新
          const inputEvent = new Event("input", { bubbles: true });
          inputArea.dispatchEvent(inputEvent);

          // 送信ボタンをクリック
          const sendButton = document.querySelector(
            "button[aria-label='メッセージの送信']"
          );

          if (sendButton) {
            sendButton.click();
          } else {
            console.error("送信ボタンが見つかりません。");
          }
        } else {
          console.error("入力エリアが見つかりません。");
        }
      },
      args: [selectedText],
    });

    // 6. Copilotからの回答を待機して取得
    const [{ result: copilotResponse }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return new Promise((resolve) => {
          const observer = new MutationObserver((mutationsList, observer) => {
            // 最新の Copilot の発言を取得するロジック
            const authorHeadings =
              document.querySelectorAll('h2[id$="-author"]');
            const copilotHeadings = Array.from(authorHeadings).filter(
              (heading) => heading.innerText.includes("Copilot の発言")
            );

            if (copilotHeadings.length === 0) {
              return;
            }

            const latestHeading = copilotHeadings[copilotHeadings.length - 1];

            // 発言内容の要素を取得
            let contentElement = latestHeading.nextElementSibling;
            while (
              contentElement &&
              !contentElement.matches('div[id$="-content-0"]')
            ) {
              contentElement = contentElement.nextElementSibling;
            }

            if (!contentElement) {
              return;
            }

            // 発言内容をテキストとして抽出
            const responseText = contentElement.innerText.trim();

            // 発言内容が取得できたら、Observerを停止してPromiseを解決
            if (responseText) {
              observer.disconnect();
              resolve(responseText);
            }
          });

          // MutationObserverを設定して、回答エリアの変化を監視
          const targetNode =
            document.querySelector("#chatMessages") || document.body;
          const config = { childList: true, subtree: true };

          observer.observe(targetNode, config);

          // 念のため、タイムアウトを設定（例：30秒）
          setTimeout(() => {
            observer.disconnect();
            resolve(
              "Copilot の回答を取得できませんでした。タイムアウトしました。"
            );
          }, 30000);
        });
      },
    });

    if (!copilotResponse || copilotResponse.includes("取得できませんでした")) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon48.png"),
        title: "エラー",
        message: copilotResponse || "Copilot の発言を取得できませんでした。",
      });
      return;
    }

    // 7. アクティブなタブでCopilotの発言をポップアップ表示
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (copilotResponse) => {
        function showPopup(message) {
          // 既存のポップアップがあれば削除
          const existingPopup = document.getElementById(
            "myExtensionPopupResponse"
          );
          if (existingPopup) {
            existingPopup.remove();
          }

          // ポップアップ要素を作成
          const popup = document.createElement("div");
          popup.id = "myExtensionPopupResponse";
          popup.innerText = message;

          // スタイルを設定
          Object.assign(popup.style, {
            position: "fixed",
            top: "50px", // 位置を調整
            right: "10px",
            backgroundColor: "#0078D4", // Copilotのテーマカラーに合わせて
            color: "#fff",
            padding: "15px",
            borderRadius: "8px",
            zIndex: "10000",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
            maxWidth: "300px",
            fontSize: "14px",
            lineHeight: "1.5",
            cursor: "pointer",
            opacity: "0",
            transition: "opacity 0.3s ease-in-out",
          });

          // ポップアップをフェードイン
          requestAnimationFrame(() => {
            popup.style.opacity = "1";
          });

          // クリックでポップアップを閉じる
          popup.addEventListener("click", () => {
            popup.style.opacity = "0";
            setTimeout(() => {
              popup.remove();
            }, 300);
          });

          // ページにポップアップを追加
          document.body.appendChild(popup);
        }

        showPopup(copilotResponse);
      },
      args: [copilotResponse],
    });
  } catch (error) {
    console.error("エラーが発生しました：", error);
  }
}
