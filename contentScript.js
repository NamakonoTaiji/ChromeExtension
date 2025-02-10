// contentScript.js
console.log("contentScript.js が読み込まれました。");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("メッセージを受信しました：", message);
  if (message.action === "receiveText") {
    insertTextIntoCopilot(message.text);
    sendResponse({ status: "success" });
  }
});

function insertTextIntoCopilot(text) {
  const inputArea = document.querySelector("#userInput"); // セレクタを確認
  if (inputArea) {
    console.log("入力エリアが見つかりました。");
    inputArea.value = text;

    // 入力イベントを発火してUIを更新
    const event = new Event("input", { bubbles: true });
    inputArea.dispatchEvent(event);
  } else {
    console.error("入力エリアが見つかりません。");
  }
}
