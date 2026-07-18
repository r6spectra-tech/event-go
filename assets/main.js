/* ============================================================
   設定區：只留「GAS Web App 網址」需要寫死在前端，
   其餘 LIFF_ID / SHEET_ID / GH_OWNER / GH_REPO 都存在 GAS 指令碼屬性，
   前端開頁時用 action=config 向 GAS 要。
   ============================================================ */
const CONFIG = {
  API_BASE: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
  MAX_SHARE_ITEMS: 5,        // liff.shareTargetPicker 一次最多可帶 5 則訊息
  MAX_CAROUSEL_BUBBLES: 12,  // 單一 flex carousel 最多 12 張卡片
};

// 執行期才會拿到的設定值（來自 GAS）
const RUNTIME = { liffId: null, siteUrl: null };

/* ============================================================
   呼叫 GAS Web App
   ============================================================ */
async function apiGet(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${CONFIG.API_BASE}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

// 用 text/plain 送 POST，避開瀏覽器對 GAS 的 CORS preflight（GAS 沒有實作 doOptions）
async function apiPost(action, data = {}) {
  const res = await fetch(CONFIG.API_BASE, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...data }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function loadConfig() {
  const cfg = await apiGet("config");
  RUNTIME.liffId = cfg.liffId;
  RUNTIME.siteUrl = cfg.siteUrl;
  return cfg;
}

/* ============================================================
   活動資料（改由 GAS 提供，GAS 內部才知道 SHEET_ID）
   ============================================================ */
async function fetchActivities() {
  const list = await apiGet("activities");
  return list.map(normalizeActivity);
}

async function getActivityById(id) {
  const a = await apiGet("activity", { id });
  return a ? normalizeActivity(a) : null;
}

function normalizeActivity(raw) {
  const capacity = Number(raw.capacity) || 0;
  const joined = Number(raw.joined) || 0;
  return {
    id: String(raw.id || "").trim(),
    title: raw.title || "未命名活動",
    cover: raw.cover || raw.cover_image || "",
    area: raw.area || "",
    date: raw.date || raw.date_text || "",
    eventDate: raw.eventDate || raw.event_date || "",
    price: raw.price || "",
    capacity,
    joined,
    isFull: capacity > 0 && joined >= capacity,
    itinerary: parseItinerary(raw.itinerary),
    youtubeItems: parseLabeledLines(raw.youtubeLinks || raw.youtube_links),
    mapItems: parseLabeledLines(raw.mapLinks || raw.map_links),
    organizerName: raw.organizerName || raw.organizer_name || "主辦人",
    organizerLineUrl: raw.organizerLineUrl || raw.organizer_line_url || "",
    groupUrl: raw.groupUrl || raw.group_url || "",
  };
}

// 行程：用 || 分隔每一天
function parseItinerary(text) {
  return String(text || "")
    .split("||")
    .map(s => s.trim())
    .filter(Boolean);
}

// YouTube / Google Map 多行欄位，每行格式：說明文字 網址（順序不拘、中間空白不拘）
// 用正規表示式抓網址，其餘文字當作說明，這樣說明文字裡有空白也不會壞掉。
function parseLabeledLines(text) {
  return String(text || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/(https?:\/\/\S+)/);
      const url = m ? m[1] : "";
      const label = url ? line.replace(url, "").trim() : line;
      return { label: label || "查看", url };
    })
    .filter(item => item.url);
}

function extractYoutubeId(url) {
  const m = url.match(/(?:youtu\.be\/|v=|\/embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}

/* ============================================================
   LIFF：開頁一律先登入，取得 LINE userId
   ============================================================ */
let liffReady = false;

async function ensureLiff() {
  if (!window.liff) return false;
  if (!RUNTIME.liffId) await loadConfig();
  try {
    await liff.init({ liffId: RUNTIME.liffId });
    liffReady = true;
    return true;
  } catch (e) {
    console.error("LIFF init failed", e);
    return false;
  }
}

// 強制登入，回傳 { userId, displayName }
async function requireLogin() {
  const ok = await ensureLiff();
  if (!ok) throw new Error("此環境不支援 LIFF");
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href });
    // login 會導頁，之後這行不會被執行到
    await new Promise(() => {});
  }
  const profile = await liff.getProfile();
  return { userId: profile.userId, displayName: profile.displayName };
}

/* ============================================================
   Flex Message 產生器（分享用）
   ============================================================ */
function detailUrl(activity) {
  return `https://liff.line.me/${RUNTIME.liffId}/detail.html?id=${encodeURIComponent(activity.id)}`;
}

function shareUrl(activity) {
  return `https://liff.line.me/${RUNTIME.liffId}/share.html?id=${encodeURIComponent(activity.id)}`;
}

// 注意：flex 訊息一旦送出，文字內容無法再更改，所以這裡只放「活動人數」這種固定資訊，
// 不放「目前已報名 X 人」這種會隨時間變動、送出後就會過時的內容。
function buildBubble(activity) {
  return {
    type: "bubble",
    hero: activity.cover
      ? { type: "image", url: activity.cover, size: "full", aspectRatio: "20:13", aspectMode: "cover" }
      : undefined,
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: activity.title, weight: "bold", size: "lg", wrap: true },
        { type: "text", text: `${activity.area}｜${activity.date}`, size: "sm", color: "#8a8a8a", wrap: true },
        activity.price ? { type: "text", text: `NT$ ${activity.price}`, size: "md", color: "#2F7A72", weight: "bold" } : null,
        activity.capacity ? { type: "text", text: `活動人數：${activity.capacity} 人`, size: "xs", color: "#666666", margin: "md" } : null,
      ].filter(Boolean),
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        { type: "button", style: "secondary", height: "sm",
          action: { type: "uri", label: "活動詳情", uri: detailUrl(activity) } },
        { type: "button", style: "primary", color: "#17233D", height: "sm",
          action: { type: "uri", label: "分享活動", uri: shareUrl(activity) } },
      ],
    },
  };
}

/* ============================================================
   LIFF 分享
   ============================================================ */
async function shareOne(activity) {
  const ok = await ensureLiff();
  if (!ok || !liff.isApiAvailable("shareTargetPicker")) {
    alert("目前環境不支援 LINE 分享，改為複製連結。");
    copyLink(detailUrl(activity));
    return;
  }
  try {
    await liff.shareTargetPicker([
      { type: "flex", altText: `【推薦行程】${activity.title}`, contents: buildBubble(activity) },
    ]);
  } catch (e) { console.error(e); }
}

async function shareMany(activities) {
  const list = activities.slice(0, CONFIG.MAX_SHARE_ITEMS);
  const ok = await ensureLiff();
  if (!ok || !liff.isApiAvailable("shareTargetPicker")) {
    alert("目前環境不支援 LINE 分享。");
    return;
  }
  const messages = list.map(a => ({
    type: "flex", altText: `【推薦行程】${a.title}`, contents: buildBubble(a),
  }));
  try { await liff.shareTargetPicker(messages); } catch (e) { console.error(e); }
}

function copyLink(url) {
  navigator.clipboard?.writeText(url).then(
    () => alert("已複製連結：\n" + url),
    () => prompt("請手動複製連結：", url)
  );
}

/* ============================================================
   候補名單（一般使用者）
   ============================================================ */
async function joinWaitlist(activityId) {
  const { userId, displayName } = await requireLogin();
  return apiPost("joinWaitlist", { activityId, userId, displayName });
}

// confirm.html 用：候補者收到通知後回覆 加入 / 取消
async function confirmWaitlistDecision(activityId, decision) {
  const { userId } = await requireLogin();
  return apiPost("confirm", { activityId, userId, decision });
}

// confirm.html 用：開頁時先檢查這個人對這個活動是否已經回覆過，避免重複詢問
async function getMyWaitlistStatus(activityId) {
  const { userId } = await requireLogin();
  return apiGet("waitlistStatus", { activityId, userId });
}

/* ============================================================
   管理者申請 / 檢查（一般使用者）
   ============================================================ */
async function applyManager() {
  const { userId, displayName } = await requireLogin();
  return apiPost("applyManager", { userId, displayName });
}

async function checkIsManager(userId) {
  return apiGet("isManager", { userId });
}

/* ============================================================
   後台（主辦人）用：帶 admin token
   ============================================================ */
function getAdminToken() {
  let t = sessionStorage.getItem("adminToken");
  if (!t) {
    t = prompt("請輸入主辦人後台密碼（ADMIN_TOKEN）：") || "";
    sessionStorage.setItem("adminToken", t);
  }
  return t;
}

async function adminGetWaitlist(activityId) {
  return apiGet("waitlist", { activityId, token: getAdminToken() });
}

async function adminNotify(activityId, userId) {
  return apiPost("notify", { activityId, userId, token: getAdminToken() });
}

async function adminCreateActivity(fields) {
  return apiPost("createActivity", { ...fields, token: getAdminToken() });
}

async function adminGetManagers() {
  return apiGet("managers", { token: getAdminToken() });
}

async function adminDecideManager(userId, decision) {
  return apiPost("decideManager", { userId, decision, token: getAdminToken() });
}
