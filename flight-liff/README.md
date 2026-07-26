# flight-liff 機票時刻登記（event-go 子功能）

這是 `event-go` 專案下的獨立子功能，**共用**既有 Google Sheet 與 `gas/Code.gs`、既有 LIFF ID、既有 Messaging API Channel，`detail.html` 等既有頁面完全不需要修改。

## 這次更新的重點（修正日期/時間顯示錯誤）

`flightDate`／`depTime`／`arrTime` 這幾欄之前顯示成一長串奇怪的 ISO 字串（例如
`1899-12-30T02:35:00.000Z`），原因是 Google Sheet 會把看起來像日期/時間的字串自動轉成
日期序列值，讀回來序列化成 JSON 時是用 UTC 表示，台北時間換算成 UTC 會有位移。既有
`Code.gs` 其實已經為了同樣的問題寫過 `formatEventDate()`（`event_date` 欄位專用），這次補上
套用到機票的日期/時間欄位，並新增 `formatFlightTime()` 處理「只有時間」的欄位，讀取時一律
轉成乾淨的 `yyyy-MM-dd` / `HH:mm` 字串（`Asia/Taipei` 時區）。另外在 `flightSubmit` 寫入前，
先把這三欄的儲存格格式鎖定成「純文字」，避免以後再次被自動轉型。這個修正已經反映在
`gas-additions.gs` 裡，重新複製貼上覆蓋既有版本即可。

## 依賴的既有共用函式

沿用既有 Code.gs 的共用函式：`cfg()` / `getSheet()` / `readTable()` / `rowToObj()` /
`formatTaipei()` / `formatEventDate()` / `json()` / `siteUrl()`，不需要重複定義，只要貼在同一個 Code.gs 檔案裡即可。

## 版本號與快取除錯

每個檔案（`index.html`／`overview.html`／`admin.html`／`flight.js`／`flight-data.js`／`flight.css`）都內嵌了同一組版本號（目前是 `20260726-1`），畫面右下角也有小標籤顯示。GitHub Pages／LINE 內建瀏覽器有時會快取舊版檔案不更新，導致「明明檔案已經換了，畫面卻還是舊的行為」。

新增了 `debug.html`，可以打開來快速排查：
1. **檔案版本比對**：同時顯示「這個分頁目前實際在跑的版本」跟「伺服器上最新部署的版本」，兩者對不上就代表有快取沒更新
2. **環境資訊**：LIFF 是否登入、userId、目前 config 等
3. **GAS 連線測試**：直接打 `config`／`flightMy`／`flightOverview` 三個 action，看是前端問題還是後端問題
4. **強制重新整理**按鈕

用法：`https://r6spectra-tech.github.io/event-go/flight-liff/debug.html?activityId=活動代碼`

> 之後每次更新檔案，記得把所有檔案裡的版本號一起改成新的（同一組字串），這樣才能透過 debug 頁準確判斷是否套用到最新版本。

## 這次交付的範圍（第一階段）

- ✅ 登記表單：去程／回程各自選航空公司＋航班＋日期（預設帶入 `DEFAULT_DATES`，可自行改）；同行代填（每人可選「同第1人班機」或自己另選）
- ✅ 我的航班資訊頁：查看、編輯（整批覆寫，逐位可標記刪除／復原、可新增成員）、刪除整批
- ✅ 總覽頁：Tab 切換「依航班」「依時段」，先依日期分組（日期放在每個區塊左上角），去程／回程分開，依抵達時間分區段給租車業者對接
- ✅ 登記流水號（每個活動各自一組，第一次登記時產生，編輯不變動）
- ✅ 宣傳登記邀請 Flex：主辦人在管理頁分享一則邀請卡片到活動群組
- ✅ 完成登記回報：登記完成後可分享一則含流水號＋時間戳的訊息到群組（用文字訊息、非 flex＋postback，見下方說明）
- ✅ 主辦人管理頁（`admin.html`）：進頁面時才檢查身分（不在登記頁背景自動偵測），沿用既有 `managers` 分頁權限

**尚未包含（下一階段再做）**：同行人歸戶認領、群組成員被動蒐集（webhook）、名單匯出／未登記比對／異常檢查／統計儀表板、idToken 後端驗證。

> 關於「完成登記回報」的實作方式：原本規劃是 postback＋Bot 主動 push（可以自訂排版、同時順便蒐集群組成員 userId），但這需要額外設定 LINE Messaging API 的 Webhook URL、驗證簽章等後端基礎建設，屬於較大的一塊工程。這一版先用**文字訊息＋`liff.shareTargetPicker()`** 的簡化做法達到「群組看得到流水號與時間戳」的效果，不需要任何 webhook，前端就能完成。等要做「群組成員被動蒐集」時，會需要一併補上 webhook 基礎建設，屆時再把這個回報功能一併升級成 postback＋Bot push 的版本。

> 關於主辦人管理功能的偵測時機：`admin.html` 只有在使用者**主動點進這個頁面**時，才會呼叫 `isManager()` 檢查身分；登記頁（`index.html`）本身完全不會做這個檢查，維持一般使用者最快的載入速度。

> 關於 idToken 驗證：既有系統（`joinActivity`／`joinWaitlist` 等）目前是直接信任前端傳來的 `userId`，並沒有做 idToken 後端驗證。這一版 `flightSubmit`／`flightDelete` 為了跟既有系統的安全性模型維持一致，也採用同樣的作法（沒有加驗證）。如果之後要加強，可以在 `flightSubmit`／`flightDelete` 這幾個 action 個別補上 idToken 驗證，屬於可以獨立疊加、不影響其他功能的強化項目。

## 安裝步驟

### 1. Google Sheet 新增分頁 `flight_registrations`

依照 `gas-additions.gs` 檔案最上方的欄位說明，建立分頁，第 1 列填技術欄名、第 2 列填中文說明（可自由填，不影響程式），資料留給系統自動寫入即可。

### 2. 把後端程式碼貼進既有 `gas/Code.gs`

1. 打開 `gas-additions.gs`，全部複製
2. 貼到既有 `Code.gs` 的 `doGet()` / `doPost()` 之前（任何位置都可以，只要在同一個檔案裡）
3. 依照 `gas-additions.gs` 檔案最下面的說明，在既有的 `doGet()` 裡加入：
   ```js
   if (action === "flightMy") return json(flightMy(e.parameter.activityId, e.parameter.userId));
   if (action === "flightOverview") return json(flightOverview(e.parameter.activityId));
   ```
   在既有的 `doPost()` 裡加入：
   ```js
   if (action === "flightSubmit") return json(flightSubmit(body));
   if (action === "flightDelete") return json(flightDelete(body));
   ```
4. 重新部署（管理部署作業 → 編輯 → 選新版本），讓 `/exec` 網址套用新程式碼

### 3. 把 `flight-liff` 資料夾放進 repo

放在 repo 根目錄下，跟 `assets/`、`detail.html` 同一層：
```
event-go/
├── assets/
├── detail.html
├── ...
└── flight-liff/
    ├── index.html
    ├── overview.html
    ├── admin.html
    ├── debug.html
    ├── flight.js
    ├── flight-data.js
    ├── flight.css
    └── gas-additions.gs   ← 這個檔案不用放進 GitHub Pages 也沒關係，只是備份用
```
不需要另外改 `assets/main.js`，`flight-liff` 的頁面是用相對路徑 `../assets/main.js`、`../assets/style.css` 直接引用既有檔案。

### 4. 取得要分享的登記連結／管理連結

```
登記頁：https://r6spectra-tech.github.io/event-go/flight-liff/index.html?activityId=活動代碼
管理頁：https://r6spectra-tech.github.io/event-go/flight-liff/admin.html?activityId=活動代碼
```

管理頁也可以直接從登記頁「我的航班資訊」區塊最下面的「主辦人管理入口 →」連結點進去。

`活動代碼` 直接沿用既有 `activities` 分頁的 `id`。一鍵分享登記邀請 Flex 的功能已經做好，在管理頁點「📣 分享登記邀請到群組」即可，不用再手動組連結貼群組。

## 班表資料

寫在 `flight-data.js`，之後航班異動只要改這個檔案裡的時間/班號即可，不用動其他程式。

## 已知簡化之處（相對於原始需求討論）

- 表單沒有做「+N人下拉選單」這個獨立控制項，改成從第一次填寫開始就是「新增成員」按鈕 + 每列 ✕ 標記刪除的統一介面（跟編輯頁共用同一套互動邏輯），減少維護兩套邏輯的複雜度，操作結果一致
- 目前是任何人都能開啟登記連結、登入後就能登記，沒有限制只有活動報名者才能填（如果需要限制，之後可以在 `flightSubmit` 裡加一段檢查，比對既有 `waitlist`／`joined` 名單）
