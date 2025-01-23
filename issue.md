## 問題
background.jsの74行目、chrome.scripting.executeScript()関数のfunc: () => {}が上手く動きません。<br>
具体的にはtarget: { tabId: copilotTab.id }までの処理は問題なくされているものの、func: () => {}を飛ばして(results) => {}へ飛んでいるような挙動をしています。<br>

![Image](https://github.com/user-attachments/assets/22d14a86-d481-49d7-9580-2c5a1f908bed)

chrome.scripting.executeScript()関数の手前にdebuggingValue変数を宣言、0で初期化、func: () => {}の中でdebuggingValue += 1;という処理をし、(results) => {}でdebuggingValueをconsole.logで出力しましたが変数は0のままでした。<br>
また、chrome.scripting.executeScript()が正常に処理できなかった場合はconsole.logでエラーが出るように記述しましたが正常終了した時のログが出力されていて原因がよくわからないです。<br>