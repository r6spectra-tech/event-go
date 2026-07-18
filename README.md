# 旅行揪團活動系統

GitHub Pages 前端（純靜態）＋ Google Apps Script 後端（讀寫 Google Sheet、LINE 推播）＋ LIFF。

## 架構總覽

```
瀏覽器 / LINE App
   │  (fetch)
   ▼
GAS Web App（Code.gs，部署成 …/exec 網址）
   │  action=config / activities / waitlist（GET）
   │  action=joinWaitlist / notify / confirm / createActivity（POST）
   ▼
Google Sheet（activities 分頁、waitlist 分頁）
```

前端**只需要寫死一個網址**：GAS 部署後的 `/exec` 網址（`assets/main.js` 裡的 `CONFIG.API_BASE`）。
`LIFF_ID`、`SHEET_ID`、`GH_OWNER`、`GH_REPO` 都放在 **GAS 的指令碼屬性**，前端開頁時用
`action=config` 跟 GAS 要，不會出現在前端原始碼裡。

## 檔案結構
```
index.html            活動列表（登機證卡片），可勾選最多 5 個活動一次分享
detail.html           行程 + 多個 YouTube/Google Map 連結 + 主辦人 LINE + 加入群組/候補
confirm.html          候補者收到通知後，回覆「是否加入第 n 號活動」的 LIFF 頁
admin/new-activity.html   主辦人：新增活動表單
admin/waitlist.html       主辦人：候補名單管理、逐一發送 LINE 通知
assets/main.js         共用邏輯：呼叫 GAS、LIFF 登入、Flex 產生器、多行欄位解析
assets/style.css
gas/Code.gs            貼到 Google Apps Script 專案的後端程式碼
```

## 1. 建立 Google Sheet

建立一個試算表，含兩個分頁：

### 分頁 `activities`
| 欄名 | 說明 |
|---|---|
| id | 活動代碼，唯一值 |
| title | 活動名稱 |
| cover_image | 封面圖網址 |
| area | 地區 |
| date_text | 日期文字 |
| price | 價格 |
| capacity | 總名額 |
| joined | 已報名人數（GAS 會在候補者確認加入時自動 +1，其餘時候你可手動調整） |
| itinerary | 行程，多天用 `\|\|` 分隔，例如 `Day1 集合出發||Day2 賦歸` |
| youtube_links | **可多行**，每行格式：`說明文字 YouTube連結`（順序、空白不拘），例如：<br>`行前說明會 https://youtu.be/aaaa`<br>`去年花絮 https://youtu.be/bbbb` |
| map_links | **可多行**，每行格式：`說明文字 Google地圖連結`，例如：<br>`集合地點 https://maps.app.goo.gl/xxxx`<br>`午餐地點 https://maps.app.goo.gl/yyyy` |
| organizer_name | 主辦人名稱 |
| organizer_line_url | 主辦人加好友連結，例如 `https://line.me/ti/p/xxxxxxx` |
| group_url | 揪團群組加入連結 |

> 在 Google Sheet 儲存格內按 `Alt+Enter`（Mac 是 `Option+Return`）即可在同一格輸入多行文字。

### 分頁 `waitlist`
| 欄名 | 說明 |
|---|---|
| activityId | 對應 activities 的 id |
| userId | 候補者的 LINE userId（系統自動寫入） |
| displayName | 候補者的 LINE 顯示名稱 |
| status | `waiting` 排隊中／`notified` 已通知／`joined` 已加入／`cancelled` 已取消 |
| createdAt / notifiedAt / respondedAt | 時間戳記，系統自動寫入 |

這個分頁**不用手動建欄位值**，第一列填好欄名，其餘讓系統自己寫入即可。

兩個分頁都不需要對外開放共用，因為現在資料完全透過 GAS 讀寫，不再用公開的 `gviz` 端點。

## 2. 建立 LINE Messaging API Channel（同時拿到 LIFF 與推播用的 Token）

1. [LINE Developers Console](https://developers.line.biz/console/) 建立 Provider。
2. 建立一個 **Messaging API** channel（會同時自動建立一個官方帳號 OA）。
3. 在該 channel 的 **LIFF** 分頁新增 LIFF app：
   - Endpoint URL：你的 GitHub Pages 根目錄，例如 `https://yourname.github.io/your-repo/`
   - **務必勾選「Share target picker」**
   - 記下 LIFF ID
4. 在該 channel 的 **Messaging API** 分頁，取得 **Channel access token（long-lived）**。
5. 建議把這個 OA 的加好友連結存起來，之後可以提醒候補者先加好友
   （LINE 規則：官方帳號只能推播訊息給已加好友、未封鎖的使用者）。

## 3. 部署 Google Apps Script

1. 到 [script.google.com](https://script.google.com) 新增專案，把 `gas/Code.gs` 的內容整個貼進去。
2. 左側「專案設定」→「指令碼屬性」，新增：

   | 屬性名稱 | 值 |
   |---|---|
   | LIFF_ID | 你的 LIFF ID |
   | SHEET_ID | Google Sheet 網址中 `/d/` 與 `/edit` 之間那段 |
   | GH_OWNER | 你的 GitHub 帳號名稱 |
   | GH_REPO | 你的 repo 名稱 |
   | CHANNEL_ACCESS_TOKEN | 上一步拿到的 Channel access token |
   | ADMIN_TOKEN | 自訂一組主辦人後台密碼（隨機字串） |

3. 右上角「部署」→「新增部署作業」→ 類型選 **網頁應用程式**：
   - 執行身分：我
   - 誰可以存取：任何人
4. 部署後複製產生的網址（結尾是 `/exec`）。

> 之後修改 `Code.gs` 記得「管理部署作業」→ 編輯 → 選新版本，網址才會套用新程式碼。

## 4. 設定前端 `assets/main.js`

只要改這一行：
```js
const CONFIG = {
  API_BASE: "貼上你的 GAS /exec 網址",
  MAX_SHARE_ITEMS: 5,
  MAX_CAROUSEL_BUBBLES: 12,
};
```

## 5. 部署到 GitHub Pages

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/yourname/your-repo.git
git push -u origin main
```
Repo 設定 → Pages → Source 選 `main` 分支根目錄。

## 6. 運作流程

### 一般使用者
1. 打開 `https://liff.line.me/{LIFF_ID}` → 自動登入 LINE，取得 userId。
2. 列表頁看活動、按「分享」單一分享，或勾選最多 5 個活動「分享所選」。
3. 進入活動詳情：看行程、多部影片、多個地圖連結。
4. 名額未滿 → 直接顯示「加入揪團群組」按鈕。
5. 名額已滿 → 按「加入候補名單」，寫入 `waitlist` 分頁（狀態 `waiting`）。

### 主辦人（候補通知流程）
1. 打開 `admin/waitlist.html`，輸入活動代碼 → 載入候補名單（第一次會要求輸入 `ADMIN_TOKEN`）。
2. 有名額釋出時，點候補者旁邊的「傳 LINE 通知」：
   - GAS 把該筆狀態改成 `notified`
   - 透過 LINE Messaging API 推播一則 Flex 訊息給該候補者，內容是「名額釋出通知」+ 一個按鈕
   - 按鈕連到 `confirm.html?activityId=xxx`（LIFF 頁）
3. 候補者點按鈕 → 開啟 `confirm.html` → 顯示「第 n 號活動：是否加入」+ 加入／取消 兩個按鈕：
   - 按**加入**：狀態改成 `joined`，活動的 `joined` 人數 `+1`，並顯示「加入揪團群組」按鈕
   - 按**取消**：狀態改成 `cancelled`，主辦人可以在候補清單中通知下一位

### 新增活動
打開 `admin/new-activity.html` 填表送出（需要輸入 `ADMIN_TOKEN`），會直接寫入 Google Sheet 的
`activities` 分頁一筆新資料，`joined` 預設為 0。

## 關於「一次最多 5 個」的限制

`liff.shareTargetPicker()` 這支 API 一次呼叫最多只能帶 **5 則訊息物件**；Flex Carousel 容器本身
則最多可放 **12 張 bubble 卡片**，兩者是不同限制。本專案：
- 單一活動「分享」→ 送 1 則 flex 訊息
- 列表頁勾選多個活動「分享所選」→ 最多勾 5 個，一次送出最多 5 則訊息（每活動各自一則）

## 之後可以擴充
- 候補名單目前需要主辦人手動點「傳 LINE 通知」，可以加一個「自動通知下一位」的按鈕，
  在有人取消候補或退團時自動觸發。
- `admin/waitlist.html`、`admin/new-activity.html` 目前只靠 `ADMIN_TOKEN` 這組共用密碼做簡易保護，
  正式上線建議改用 LINE Login 白名單（判斷 `userId` 是否屬於主辦人清單）取代單一密碼。
- 可以用 GAS 的時間觸發器（Triggers）定期檢查候補名單，主動提醒尚未回覆的候補者。
