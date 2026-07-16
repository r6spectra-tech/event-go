# 旅行揪團活動列表（GitHub Pages + Google Sheet + LIFF + Flex Message）

純前端專案，資料放在 Google Sheet，用 LIFF 顯示活動列表 / 詳情，並用 `liff.shareTargetPicker()`
把活動包成 Flex Message 分享到 LINE 好友或群組。

## 檔案結構
```
index.html      活動列表（卡片 = 登機證樣式），每張卡有「活動詳情」「分享」
detail.html     活動詳情：行程 + YouTube/IG 影片 + 主辦人 LINE 連結 + 加入群組/候補按鈕
assets/main.js  讀 Google Sheet、組 Flex Message、呼叫 LIFF 分享
assets/style.css
```

## 關於「5 個分頁」的限制（先講清楚，避免設計錯方向）

你提到的「flex 分享 5 個分頁的限制」實際上是 **`liff.shareTargetPicker()` 這支 API 本身的限制**：
一次呼叫最多只能帶 **5 則訊息物件（message objects）**，不是 Flex Carousel 裡的 bubble 數量限制。

而 Flex Message 的 **Carousel 容器本身最多可以放 12 個 bubble**（LINE 官方文件），跟前面那個 5 則訊息是兩件事：

| 限制 | 對象 | 上限 |
|---|---|---|
| `liff.shareTargetPicker([...])` | 一次呼叫可帶的「訊息」數量 | **5 則** |
| Flex Carousel | 一則訊息裡的「bubble 卡片」數量 | 12 張 |

所以這個專案的設計是：
- 單一活動的「分享」按鈕 → 送 1 則 flex bubble。
- 列表頁可以勾選多個活動（最多 5 個）「分享所選」→ 一次送出最多 5 則 flex 訊息（每個活動各自 1 則），對應你說的「一次最多 5 頁」。

如果之後想改成「1 則訊息、多個活動用 Carousel 呈現」，可以把 `assets/main.js` 裡
`shareMany()` 改成組成一個 `type: "carousel"`（最多塞 12 個 bubble），再包成單一則訊息傳給
`shareTargetPicker([{ type:"flex", contents: carousel }])`，兩種都合法，看你想要的 UX。

## 1. 建立 Google Sheet

建立一個試算表，分頁命名為 `activities`（或自行改 `CONFIG.SHEET_NAME`），欄位如下（第一列是欄名）：

| 欄名 | 說明 |
|---|---|
| id | 活動代碼，唯一值，例如 `trip001` |
| title | 活動名稱 |
| cover_image | 封面圖網址（https，建議 16:9 或更寬） |
| area | 地區，例如「花蓮」 |
| date_text | 日期文字，例如「10/18(六) - 10/19(日)」 |
| price | 價格數字，例如 `2980` |
| capacity | 總名額（數字） |
| joined | 目前已報名人數（數字） |
| itinerary | 行程，多天請用 `||` 分隔，例如：`Day1 集合出發，前往太魯閣||Day2 早起賞日出，中午賦歸` |
| youtube_id | YouTube 影片 ID（網址 `watch?v=` 後面那段），沒有就留空 |
| ig_url | 若沒有 YouTube，可填 IG 貼文網址作為替代 |
| organizer_name | 主辦人名稱 |
| organizer_line_url | 主辦人「加好友」連結，例如 `https://line.me/ti/p/xxxxxxx` |
| group_url | 揪團群組加入連結（LINE 群組/OpenChat 邀請連結） |
| waitlist_url | 候補名單連結（例如另一個候補用 OpenChat，或 Google 表單） |

> `capacity`、`joined` 由你（或你的報名表單）手動更新即可；前端會自動判斷
> `joined >= capacity` 時，詳情頁的「加入群組」按鈕會換成「加入候補名單」。

共用設定：右上角「共用」→「知道連結的任何人」→ 檢視者。這樣前端才能用
`gviz/tq` 這個公開端點讀到資料（不需要 API Key，也不需要後端）。

## 2. 建立 LINE Login channel 與 LIFF

1. 到 [LINE Developers Console](https://developers.line.biz/console/) 建立 Provider → 建立 **LINE Login** channel。
2. 在該 channel 的 **LIFF** 分頁新增一個 LIFF app：
   - Endpoint URL：填你的 GitHub Pages 網址，例如 `https://yourname.github.io/your-repo/`
   - Scope：`profile`、`openid`
   - **務必開啟「Share target picker」這個選項**，否則 `shareTargetPicker()` 會呼叫失敗。
3. 複製產生的 LIFF ID（格式像 `1234567890-AbCdEfGh`）。

## 3. 設定 `assets/main.js`

```js
const CONFIG = {
  LIFF_ID: "你的 LIFF ID",
  SHEET_ID: "你的 Google Sheet ID",   // 網址 /d/ 與 /edit 之間那段
  SHEET_NAME: "activities",
  SITE_URL: "https://yourname.github.io/your-repo",
  MAX_SHARE_ITEMS: 5,
  MAX_CAROUSEL_BUBBLES: 12,
};
```

## 4. 部署到 GitHub Pages

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/yourname/your-repo.git
git push -u origin main
```
到 repo 設定 → Pages → Source 選 `main` 分支的根目錄，存檔後等一兩分鐘即可。

## 5. 測試

- 用手機 LINE 開啟 `https://liff.line.me/{你的LIFF ID}`（不是 GitHub Pages 網址本身），
  才會進入 LINE 內建瀏覽器並啟用分享功能。
- 電腦瀏覽器打開一般網址也能看到列表/詳情，但分享按鈕需要先 `liff.login()` 且
  不一定支援 shareTargetPicker（外部瀏覽器行為依 LINE App 版本而定）。

## 之後可以擴充的地方
- 報名表單直接寫回 Google Sheet（例如接 Google Apps Script 當簡易 API），
  讓 `joined` 自動累加，不用手動改表格。
- 詳情頁補上「取消候補」「查詢目前候補順位」等動線。
- 用 LINE Notify 或 Messaging API（需要後端）在候補遞補時自動通知使用者。
