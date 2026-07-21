/* ============================================================
   設定區：只留「GAS Web App 網址」需要寫死在前端，
   其餘 LIFF_ID / SHEET_ID / GH_OWNER / GH_REPO 都存在 GAS 指令碼屬性，
   前端開頁時用 action=config 向 GAS 要。
   ============================================================ */
const CONFIG = {
  API_BASE: "https://script.google.com/macros/s/AKfycbwykjsyZB9JEQsFHDKUJfT5ki4Gh27i5jxVLaLko_zS2MLk7Uv5vSqvz5fxkPgVMPXgOw/exec",
  MAX_SHARE_ITEMS: 5,        // liff.shareTargetPicker 一次最多可帶 5 則訊息
  MAX_CAROUSEL_BUBBLES: 12,  // 單一 flex carousel 最多 12 張卡片
  OA_LINE_URL: "https://lin.ee/jTuF7zN", // LINE 官方帳號加好友連結，候補通知要靠這個才推得到
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
async function fetchActivities(forceRefresh) {
  const params = forceRefresh ? { forceRefresh: "1" } : {};
  const list = await apiGet("activities", params);
  return list.map(normalizeActivity);
}

async function getActivityById(id, forceRefresh) {
  const params = forceRefresh ? { id, forceRefresh: "1" } : { id };
  const a = await apiGet("activity", params);
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
    waitlistOpen: raw.waitlistOpen !== false,
    notes: raw.notes || "",
    itinerary: parseItinerary(raw.itinerary),
    itineraryRaw: raw.itinerary || "",
    youtubeItems: parseLabeledLines(raw.youtubeLinks || raw.youtube_links),
    youtubeLinksRaw: raw.youtubeLinks || raw.youtube_links || "",
    mapItems: parseLabeledLines(raw.mapLinks || raw.map_links),
    mapLinksRaw: raw.mapLinks || raw.map_links || "",
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
let liffInitPromise = null;

async function ensureLiff() {
  if (!window.liff) return false;
  if (liffReady) return true;
  if (!liffInitPromise) {
    liffInitPromise = (async () => {
      if (!RUNTIME.liffId) await loadConfig();
      await liff.init({ liffId: RUNTIME.liffId });
      liffReady = true;
    })();
  }
  try {
    await liffInitPromise;
    return true;
  } catch (e) {
    console.error("LIFF init failed", e);
    liffInitPromise = null; // 讓之後還能重試
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
  try {
    const profile = await liff.getProfile();
    return { userId: profile.userId, displayName: profile.displayName };
  } catch (e) {
    // liff.isLoggedIn() 只檢查「有沒有存 token」，不保證 token 沒過期。
    // token 過期時 getProfile() 會丟錯（例如 "The access token expired"），
    // 這種情況強制登出再重新登入一次，而不是直接判定失敗。
    console.warn("getProfile 失敗（可能是 token 過期），嘗試重新登入", e);
    liff.logout();
    liff.login({ redirectUri: location.href });
    await new Promise(() => {}); // login 會導頁，之後這行不會被執行到
  }
}

/* ============================================================
   Flex Message 產生器（分享用）
   ============================================================ */
function detailUrl(activity, referrer) {
  let url = `${RUNTIME.siteUrl}/detail.html?id=${encodeURIComponent(activity.id)}`;
  if (referrer && referrer.userId) {
    url += `&refId=${encodeURIComponent(referrer.userId)}&refName=${encodeURIComponent(referrer.displayName || "")}`;
  }
  return url;
}

// 注意：flex 訊息一旦送出，文字內容無法再更改，所以這裡只放「活動人數」這種固定資訊，
// 不放「目前已報名 X 人」這種會隨時間變動、送出後就會過時的內容。
// footer 只放「活動詳情」一個按鈕，分享要到 LIFF 頁面（detail.html / share.html）裡進行，
// 不在 flex 訊息本身放分享按鈕。
// referrer（分享者的 {userId, displayName}）會被embed進連結，對方點開時可以回頭記錄「是誰分享的」。
function buildBubble(activity, referrer) {
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
      layout: "vertical",
      contents: [
        { type: "button", style: "primary", color: "#17233D", height: "sm",
          action: { type: "uri", label: "活動詳情", uri: detailUrl(activity, referrer) } },
      ],
    },
  };
}

// 分享前，如果目前已經是 LINE 登入狀態，就順手拿當下的 profile 當作分享者資訊（拿不到就不附加，不強制登入）
async function getCurrentProfileIfAvailable() {
  try {
    if (window.liff && liff.isLoggedIn && liff.isLoggedIn()) {
      return await liff.getProfile();
    }
  } catch (e) { /* 拿不到就算了，不影響分享 */ }
  return null;
}

/* ============================================================
   LIFF 分享
   ============================================================ */
// 分享「整個網站」用的通用 flex（首頁標題點擊觸發），不綁定任何單一活動
async function shareApp(title, subtitle) {
  const ok = await ensureLiff();
  if (!ok || !liff.isApiAvailable("shareTargetPicker")) {
    alert("目前環境不支援 LINE 分享，改為複製連結。");
    copyLink(`https://liff.line.me/${RUNTIME.liffId}`);
    return;
  }
  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: title, weight: "bold", size: "xl", wrap: true },
        { type: "text", text: subtitle, size: "sm", color: "#8a8a8a", wrap: true, margin: "md" },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "button", style: "primary", color: "#17233D",
          action: { type: "uri", label: "查看所有活動", uri: `https://liff.line.me/${RUNTIME.liffId}` } },
      ],
    },
  };
  try {
    await liff.shareTargetPicker([{ type: "flex", altText: title, contents: bubble }]);
  } catch (e) { console.error(e); }
}

async function shareOne(activity) {
  const ok = await ensureLiff();
  if (!ok || !liff.isApiAvailable("shareTargetPicker")) {
    alert("目前環境不支援 LINE 分享，改為複製連結。");
    copyLink(detailUrl(activity));
    return;
  }
  const referrer = await getCurrentProfileIfAvailable();
  try {
    await liff.shareTargetPicker([
      { type: "flex", altText: `【推薦行程】${activity.title}`, contents: buildBubble(activity, referrer) },
    ]);
    if (referrer) recordShare(activity.id, referrer.userId, referrer.displayName);
  } catch (e) { console.error(e); }
}

// 選 2~5 個活動一起分享：包成「一則」flex 訊息、裡面是可以左右滑動的 carousel，
// 而不是送出好幾則各自獨立的訊息。
async function shareMany(activities) {
  const list = activities.slice(0, CONFIG.MAX_SHARE_ITEMS);
  if (list.length < 2) {
    alert("請至少選擇 2 個活動再一起分享");
    return;
  }
  const ok = await ensureLiff();
  if (!ok || !liff.isApiAvailable("shareTargetPicker")) {
    alert("目前環境不支援 LINE 分享。");
    return;
  }
  const referrer = await getCurrentProfileIfAvailable();
  const carousel = { type: "carousel", contents: list.map(a => buildBubble(a, referrer)) };
  const dateList = list.map(a => a.date).filter(Boolean).join("、");
  const altText = dateList ? `【推薦行程】${dateList}` : `【推薦行程】共 ${list.length} 個活動`;
  try {
    await liff.shareTargetPicker([
      { type: "flex", altText, contents: carousel },
    ]);
    if (referrer) list.forEach(a => recordShare(a.id, referrer.userId, referrer.displayName));
  } catch (e) { console.error(e); }
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

// detail.html 用：這個人對這個活動目前的狀態（已參加 / 候補中…），避免同一個人重複點「參加活動」
async function getMyActivityStatus(activityId) {
  const { userId } = await requireLogin();
  return apiGet("myActivityStatus", { activityId, userId });
}

// me.html（個人頁面）用：這個人打開過／候補過／參加過的所有活動
async function getMyActivities() {
  const { userId } = await requireLogin();
  return apiGet("myActivities", { userId });
}

/* ============================================================
   詳情頁：進站記錄 / 直接參加 / 輔助資料
   ============================================================ */
async function recordVisit(activityId, referrer) {
  try {
    const { userId, displayName } = await requireLogin();
    const payload = { activityId, userId, displayName };
    if (referrer && referrer.refUserId) {
      payload.refUserId = referrer.refUserId;
      payload.refDisplayName = referrer.refDisplayName || "";
    }
    return await apiPost("recordVisit", payload);
  } catch (e) {
    console.warn("recordVisit 略過（未登入或環境不支援）", e);
  }
}

async function recordShare(activityId, userId, displayName) {
  try {
    return await apiPost("recordShare", { activityId, userId, displayName });
  } catch (e) {
    console.warn("recordShare 失敗", e);
  }
}

async function joinActivity(activityId) {
  const { userId, displayName } = await requireLogin();
  return apiPost("joinActivity", { activityId, userId, displayName });
}

async function fetchNextActivityId() {
  const res = await apiGet("nextActivityId");
  return res.id;
}

async function fetchCoverImages() {
  return apiGet("coverImages");
}

function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

/* ============================================================
   前端快取：讀取用的資料才快取，寫入動作一律即時打 GAS。
   用 localStorage（不是 sessionStorage）：LINE 內建瀏覽器/部分瀏覽器每次開新頁面
   都可能視為新的瀏覽階段，sessionStorage 會被清空、等於每次都沒吃到快取；
   localStorage 不受這個影響，會一直留著，直到按「更新」蓋過去，或使用者自己清瀏覽器資料。
   資料本身不會自動過期——要新資料就是按「更新」，這是刻意的設計，不是 bug。
   ============================================================ */
function cacheKey(name) {
  return `cache:${name}`;
}

function readCache(name) {
  try {
    const raw = localStorage.getItem(cacheKey(name));
    if (!raw) return null;
    return JSON.parse(raw); // { data, fetchedAt }
  } catch (e) {
    return null;
  }
}

function writeCache(name, data) {
  try {
    localStorage.setItem(cacheKey(name), JSON.stringify({ data, fetchedAt: Date.now() }));
  } catch (e) { /* storage 滿了或被禁用，忽略即可，退化成每次都重新抓 */ }
}

function formatCacheTime(ts) {
  if (!ts) return "尚未讀取";
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-TW", { hour12: false });
}

const REFRESH_COOLDOWN_SEC = 60;

// 幫「更新」按鈕接上：點擊→執行 onRefresh()→按鈕變灰倒數 60 秒→恢復可點
// timeLabelEl 會被更新成「上次更新：HH:MM:SS」
function setupRefreshButton(btnEl, timeLabelEl, fetchedAt, onRefresh) {
  let timer = null;

  function paintTime(ts) {
    if (timeLabelEl) timeLabelEl.textContent = `上次更新：${formatCacheTime(ts)}`;
  }
  paintTime(fetchedAt);

  function startCooldown() {
    let remaining = REFRESH_COOLDOWN_SEC;
    btnEl.disabled = true;
    btnEl.textContent = `更新中…`;
    setTimeout(() => {
      btnEl.textContent = `更新 (${remaining}s)`;
      timer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(timer);
          btnEl.disabled = false;
          btnEl.textContent = "更新";
        } else {
          btnEl.textContent = `更新 (${remaining}s)`;
        }
      }, 1000);
    }, 300); // 讓「更新中…」先短暫顯示一下，使用者才看得出真的有在動作
  }

  btnEl.addEventListener("click", async () => {
    if (btnEl.disabled) return;
    btnEl.disabled = true;
    btnEl.textContent = "更新中…";
    try {
      const newFetchedAt = await onRefresh();
      paintTime(newFetchedAt);
    } finally {
      startCooldown();
    }
  });
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

// 管理頁共用的守門邏輯：確認 LINE 登入 → 確認是核准管理者，就直接放行，
// 沒有任何密碼/PIN 這種東西——每次打開頁面都會重新檢查一次身分。
// renderContent(profile) 會在通過驗證後被呼叫，負責畫出實際的後台內容。
async function guardManagerPage(mountEl, renderContent) {
  mountEl.innerHTML = `<div class="loading">驗證身分中…</div>`;
  let profile;
  try {
    profile = await requireLogin();
  } catch (e) {
    mountEl.innerHTML = `<div class="empty">需要 LINE 登入才能使用這個頁面</div>`;
    return;
  }

  let managerStatus;
  try {
    managerStatus = (await checkIsManager(profile.userId)).status;
  } catch (e) {
    mountEl.innerHTML = `<div class="empty">讀取權限失敗：${e.message}</div>`;
    return;
  }
  if (managerStatus !== "approved") {
    mountEl.innerHTML = `<div class="empty">此帳號沒有管理權限。請先到活動列表頁按「申請管理」，等待核准後再回來。</div>`;
    return;
  }

  renderContent(profile);
}

/* ============================================================
   後台（管理者）用：一律用「已核准管理者自己的 userId」授權，
   不再有共用的擁有者密碼。第一個管理者要由你直接在 Google Sheet 的
   managers 分頁手動新增一列、status 填 approved 來「開國」。
   ============================================================ */
async function adminGetWaitlist(activityId, requestedBy) {
  return apiGet("waitlist", { activityId, requestedBy });
}

async function adminNotify(activityId, targetUserId, requestedBy) {
  return apiPost("notify", { activityId, targetUserId, requestedBy });
}

async function adminCreateActivity(fields, requestedBy) {
  return apiPost("createActivity", { ...fields, requestedBy });
}

async function adminUpdateActivity(fields, requestedBy) {
  return apiPost("updateActivity", { ...fields, requestedBy });
}

async function adminGetWaitlistCount(activityId, requestedBy) {
  return apiGet("waitlistCount", { activityId, requestedBy });
}

async function fetchOrganizerPresets() {
  return apiGet("organizerPresets");
}

async function addOrganizerPreset(name, lineUrl, requestedBy) {
  return apiPost("addOrganizerPreset", { name, lineUrl, requestedBy });
}

async function adminGetManagers(requestedBy) {
  return apiGet("managers", { requestedBy });
}

async function adminGetVisitLog(requestedBy, activityId) {
  const params = { requestedBy };
  if (activityId) params.activityId = activityId;
  return apiGet("visitLog", params);
}

async function adminDecideManager(userId, decision, requestedBy) {
  return apiPost("decideManager", { userId, decision, requestedBy });
}
