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
          let lastContent = "";
          let stableCounter = 0;
          const MAX_STABLE_COUNT = 5; // 安定判定回数
          const TIMEOUT = 30000; // タイムアウトを30秒に延長
          let hasResponded = false;

          const observer = new MutationObserver(() => {
            // Copilotの回答コンテナを取得
            const responseContainers = document.querySelectorAll(
              'div[data-content="ai-message"]' // data-content属性で特定
            );

            if (responseContainers.length === 0) {
              console.log("Copilotの回答コンテナが見つかりません。");
              return;
            }

            // 最新の回答コンテナを取得
            const latestResponse =
              responseContainers[responseContainers.length - 1];

            // 回答テキストを抽出
            const responseText = Array.from(
              latestResponse.querySelectorAll("p")
            )
              .map((p) => p.textContent)
              .join("\n")
              .replace(/[\s\n]+/g, " ")
              .trim();

            if (!responseText) {
              console.log("回答テキストが空です。");
              return;
            }

            console.log(
              "現在の回答テキスト:",
              responseText.slice(0, 50) + "..."
            );
            console.log(`安定カウント: ${stableCounter}/${MAX_STABLE_COUNT}`);

            // 安定判定ロジック
            if (responseText === lastContent) {
              stableCounter++;
            } else {
              lastContent = responseText;
              stableCounter = 0;
            }

            if (stableCounter >= MAX_STABLE_COUNT && !hasResponded) {
              hasResponded = true;
              observer.disconnect();
              resolve(responseText);
              console.log("回答を正常に取得");
            }
          });

          // 監視対象を設定（会話履歴全体）
          const targetNode =
            document.querySelector('section[role="log"]') || document.body;
          observer.observe(targetNode, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
          });

          // フォールバック用の定期チェック
          const fallbackCheck = setInterval(() => {
            const fallbackResponse = document.querySelector(
              'div[data-content="ai-message"]:last-child'
            );
            if (fallbackResponse?.textContent?.length > 50) {
              // 50文字以上で有効と判定
              clearInterval(fallbackCheck);
              observer.disconnect();
              resolve(fallbackResponse.textContent.trim());
            }
          }, 1000);

          // タイムアウト処理
          setTimeout(() => {
            if (!hasResponded) {
              observer.disconnect();
              clearInterval(fallbackCheck);
              resolve("回答取得がタイムアウトしました");
              console.warn("タイムアウト発生");
            }
          }, TIMEOUT);
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
