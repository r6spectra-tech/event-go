/* ============================================================
   flight-liff 前端邏輯
   依賴 ../assets/main.js（apiGet / apiPost / ensureLiff / requireLogin / loadConfig）
   依賴 ./flight-data.js（FLIGHT_SCHEDULE / AIRLINES / DIRECTION_LABEL）
   ============================================================ */

/* FLIGHT_JS_VERSION: 20260726-2 */
const FLIGHT_JS_VERSION = "20260726-2";

function getActivityId() {
  return new URLSearchParams(location.search).get("activityId") || "";
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "f-toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function flightOptionsHtml(direction, selectedValue) {
  let html = `<option value="">請選擇航班</option>`;
  Object.values(AIRLINES).forEach(a => {
    html += `<optgroup label="${a.label}">`;
    (FLIGHT_SCHEDULE[direction][a.key] || []).forEach(f => {
      const v = flightOptionValue(a.key, f);
      const sel = v === selectedValue ? "selected" : "";
      html += `<option value="${v}" ${sel}>${f.dep}–${f.arr}（${f.flightNo}）</option>`;
    });
    html += `</optgroup>`;
  });
  return html;
}

function todayStr() {
  const d = new Date();
  const tz = new Date(d.getTime() + 8 * 3600 * 1000); // 粗略對齊台北時區顯示用
  return tz.toISOString().slice(0, 10);
}

/* ============================================================
   index.html：我的航班資訊 + 登記表單
   ============================================================ */
let PAGE = { activityId: "", profile: null, myData: { go: [], return: [] }, editingDirection: null, formMembers: [] };

async function initIndexPage() {
  PAGE.activityId = getActivityId();
  if (!PAGE.activityId) {
    document.getElementById("f-app").innerHTML = `<div class="f-empty">網址缺少 activityId 參數，請透過活動分享的連結進入。</div>`;
    return;
  }
  await loadConfig();
  try {
    const activity = await getActivityById(PAGE.activityId);
    document.getElementById("f-activity-title").textContent = activity ? activity.title : PAGE.activityId;
    document.getElementById("f-activity-sub").textContent = activity ? `${activity.area || ""}｜${activity.date || ""}` : "";
  } catch (e) { /* 拿不到活動資訊不影響登記功能 */ }

  document.getElementById("f-login-btn").addEventListener("click", onLoginClick);
  bindFormEvents();

  try {
    const ok = await ensureLiff();
    if (ok && liff.isLoggedIn()) {
      await afterLogin();
    } else {
      showLoginGate();
    }
  } finally {
    document.getElementById("f-init-loading").hidden = true;
  }
}

function showLoginGate() {
  document.getElementById("f-login-gate").hidden = false;
  document.getElementById("f-my").hidden = true;
  document.getElementById("f-form-section").hidden = true;
}

async function onLoginClick() {
  await requireLogin(); // 會導頁登入，登入完成後頁面重新載入，帶回原本的 activityId 參數
}

async function afterLogin() {
  const profile = await liff.getProfile();
  PAGE.profile = { userId: profile.userId, displayName: profile.displayName };
  document.getElementById("f-login-gate").hidden = true;
  document.getElementById("f-my").hidden = false;
  await refreshMyData();
}

async function refreshMyData() {
  document.getElementById("f-my-loading").hidden = false;
  document.getElementById("f-my-cards").hidden = true;
  try {
    const data = await apiGet("flightMy", { activityId: PAGE.activityId, userId: PAGE.profile.userId });
    PAGE.myData = data;
    renderMyCards();
  } finally {
    document.getElementById("f-my-loading").hidden = true;
    document.getElementById("f-my-cards").hidden = false;
  }
}

function renderMyCards() {
  renderMyCard("go");
  renderMyCard("return");
}

function renderMyCard(direction) {
  const list = PAGE.myData[direction] || [];
  const card = document.getElementById(`f-card-${direction}`);
  const hasData = list.length > 0;
  card.querySelector(".f-tag").textContent = hasData ? `已登記 ${list.length} 人` : "尚未登記";
  card.querySelector(".f-tag").classList.toggle("empty", !hasData);

  const rowsEl = card.querySelector(".f-rows");
  if (!hasData) {
    rowsEl.innerHTML = `<div class="f-empty">尚未填寫${DIRECTION_LABEL[direction]}</div>`;
  } else {
    rowsEl.innerHTML = list.map(r => `
      <div class="f-row-2 ${r.isSelf === true || String(r.isSelf).toUpperCase() === "TRUE" ? "f-self" : ""}">
        <div class="f-name">${escapeHtml(r.name || "")}</div>
        <div class="f-flight2">${AIRLINES[r.airline]?.label || r.airline}｜${r.flightNo}｜${r.flightDate}｜${r.depTime}–${r.arrTime}</div>
      </div>
    `).join("");
  }

  const actions = card.querySelector(".f-actions");
  actions.innerHTML = hasData
    ? `<button class="btn primary" onclick="openEditForm('${direction}')">編輯</button>
       <button class="btn danger" onclick="deleteDirection('${direction}')">刪除</button>`
    : `<button class="btn teal" onclick="openNewForm('${direction}')">填寫${direction === "go" ? "去程" : "回程"}</button>`;

  const shareRow = card.querySelector(".f-share-row");
  shareRow.innerHTML = hasData
    ? `<button class="btn ghost" onclick="shareCompletion('${direction}')">📣 分享到群組，回報已完成登記</button>`
    : "";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---- 表單：新增 ---- */
function openNewForm(direction) {
  PAGE.editingDirection = direction;
  PAGE.formMembers = [
    { isSelf: true, name: PAGE.profile.displayName, date: DEFAULT_DATES[direction], airline: "", flightNo: "", dep: "", arr: "", removed: false },
  ];
  renderForm();
  showForm();
}

/* ---- 表單：編輯既有登記 ---- */
function openEditForm(direction) {
  PAGE.editingDirection = direction;
  const list = PAGE.myData[direction];
  const selfRow = list.find(r => r.isSelf === true || r.isSelf === "TRUE" || r.isSelf === "true");
  const others = list.filter(r => r !== selfRow);
  PAGE.formMembers = [
    { isSelf: true, name: selfRow.name, date: selfRow.flightDate, airline: selfRow.airline, flightNo: selfRow.flightNo, dep: selfRow.depTime, arr: selfRow.arrTime, removed: false },
    ...others.map(r => ({
      isSelf: false, name: r.name, date: r.flightDate, airline: r.airline, flightNo: r.flightNo, dep: r.depTime, arr: r.arrTime,
      sameAsSelf: r.flightNo === selfRow.flightNo && r.flightDate === selfRow.flightDate,
      removed: false,
    })),
  ];
  renderForm();
  showForm();
}

function showForm() {
  document.getElementById("f-my").hidden = true;
  document.getElementById("f-form-section").hidden = false;
  document.getElementById("f-form-title").textContent = DIRECTION_LABEL[PAGE.editingDirection];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeForm() {
  document.getElementById("f-my").hidden = false;
  document.getElementById("f-form-section").hidden = true;
}

function renderForm() {
  const container = document.getElementById("f-members");
  container.innerHTML = PAGE.formMembers.map((m, i) => renderMemberHtml(m, i)).join("");
}

function renderMemberHtml(m, idx) {
  const direction = PAGE.editingDirection;
  const removedClass = m.removed ? "removed" : "";
  if (m.isSelf) {
    return `
      <div class="f-member f-member-self ${removedClass}" data-idx="${idx}">
        <div class="f-member-head">
          <span class="f-idx">本人</span>
        </div>
        <div class="f-member-body">
          <div class="f-field"><label>姓名</label><input type="text" value="${escapeHtml(m.name)}" disabled></div>
          <div class="f-field"><label>日期</label><input type="date" data-role="date" value="${m.date || ""}"></div>
          <div class="f-field"><label>航班</label>
            <select data-role="flight">${flightOptionsHtml(direction, flightOptionValue(m.airline, { flightNo: m.flightNo, dep: m.dep, arr: m.arr }))}</select>
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="f-member ${removedClass}" data-idx="${idx}">
      <div class="f-member-head">
        <span class="f-idx">同行第 ${idx + 1} 人</span>
        <button type="button" class="f-remove-btn" data-action="toggle-remove" data-idx="${idx}">${m.removed ? "" : "✕"}</button>
      </div>
      <div class="f-member-body">
        <div class="f-field"><label>稱呼</label><input type="text" data-role="name" placeholder="請輸入稱呼" value="${escapeHtml(m.name || "")}"></div>
        <label class="f-same-flight">
          <input type="checkbox" data-role="same" ${m.sameAsSelf !== false ? "checked" : ""}>
          同第 1 人班機
        </label>
        <div class="f-own-flight" ${m.sameAsSelf !== false ? 'hidden' : ""}>
          <div class="f-field"><label>日期</label><input type="date" data-role="date" value="${m.date || DEFAULT_DATES[direction]}"></div>
          <div class="f-field"><label>航班</label>
            <select data-role="flight">${flightOptionsHtml(direction, flightOptionValue(m.airline, { flightNo: m.flightNo, dep: m.dep, arr: m.arr }))}</select>
          </div>
        </div>
      </div>
    </div>`;
}

function bindFormEvents() {
  const container = document.getElementById("f-members");

  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='toggle-remove']");
    if (btn) {
      const idx = Number(btn.dataset.idx);
      PAGE.formMembers[idx].removed = !PAGE.formMembers[idx].removed;
      renderForm();
    }
  });

  container.addEventListener("change", (e) => {
    const memberEl = e.target.closest(".f-member");
    if (!memberEl) return;
    const idx = Number(memberEl.dataset.idx);
    const m = PAGE.formMembers[idx];
    const role = e.target.dataset.role;

    if (role === "name") m.name = e.target.value;
    if (role === "date") m.date = e.target.value;
    if (role === "flight") {
      const parsed = parseFlightOptionValue(e.target.value);
      if (parsed) { m.airline = parsed.airline; m.flightNo = parsed.flightNo; m.dep = parsed.dep; m.arr = parsed.arr; }
    }
    if (role === "same") {
      m.sameAsSelf = e.target.checked;
      renderForm();
    }
  });

  document.getElementById("f-add-member").addEventListener("click", () => {
    PAGE.formMembers.push({ isSelf: false, name: "", date: DEFAULT_DATES[PAGE.editingDirection], airline: "", flightNo: "", dep: "", arr: "", sameAsSelf: true, removed: false });
    renderForm();
  });

  document.getElementById("f-form-cancel").addEventListener("click", closeForm);
  document.getElementById("f-form-save").addEventListener("click", submitForm);
}

async function submitForm() {
  const direction = PAGE.editingDirection;
  const self = PAGE.formMembers[0];
  if (!self.airline || !self.flightNo || !self.date) {
    toast("請選擇您自己的航班與日期");
    return;
  }
  const kept = PAGE.formMembers.filter(m => !m.removed);
  const members = kept.map(m => {
    if (m.isSelf) return { name: self.name, airline: self.airline, flightNo: self.flightNo, flightDate: self.date, depTime: self.dep, arrTime: self.arr };
    const useOwn = m.sameAsSelf === false;
    if (!m.name || !m.name.trim()) throw new Error("同行者稱呼不可空白");
    if (useOwn && (!m.airline || !m.flightNo || !m.date)) throw new Error(`「${m.name}」請選擇航班與日期`);
    return {
      name: m.name.trim(),
      airline: useOwn ? m.airline : self.airline,
      flightNo: useOwn ? m.flightNo : self.flightNo,
      flightDate: useOwn ? m.date : self.date,
      depTime: useOwn ? m.dep : self.dep,
      arrTime: useOwn ? m.arr : self.arr,
    };
  });

  const btn = document.getElementById("f-form-save");
  btn.disabled = true; btn.textContent = "儲存中…";
  try {
    await apiPost("flightSubmit", {
      activityId: PAGE.activityId, userId: PAGE.profile.userId, displayName: PAGE.profile.displayName,
      direction, members,
    });
    toast("已儲存");
    closeForm();
    await refreshMyData();
  } catch (e) {
    toast("儲存失敗：" + e.message);
  } finally {
    btn.disabled = false; btn.textContent = "儲存";
  }
}

async function deleteDirection(direction) {
  if (!confirm(`確定要刪除整份${DIRECTION_LABEL[direction]}登記資料嗎？此動作無法復原。`)) return;
  try {
    await apiPost("flightDelete", { activityId: PAGE.activityId, userId: PAGE.profile.userId, direction });
    toast("已刪除");
    await refreshMyData();
  } catch (e) {
    toast("刪除失敗：" + e.message);
  }
}

// 完成登記回報：分享一則帶流水號＋建立時間的文字訊息到群組，順便讓群組成員知道彼此的登記進度。
// 用「文字訊息」而不是 flex，是因為 liff.shareTargetPicker 分享文字訊息時，
// 內容會直接以「使用者自己傳送」的樣子出現在群組聊天室裡，不需要額外的 postback/webhook 機制。
async function shareCompletion(direction) {
  const list = PAGE.myData[direction] || [];
  const selfRow = list.find(r => r.isSelf === true || String(r.isSelf).toUpperCase() === "TRUE");
  if (!selfRow) return;
  const ok = await ensureLiff();
  if (!ok || !liff.isApiAvailable("shareTargetPicker")) {
    toast("目前環境不支援 LINE 分享");
    return;
  }
  const dirText = direction === "go" ? "去程" : "回程";
  const text = `第 ${selfRow.seq || "?"} 人 ✅ ${PAGE.profile.displayName} 已完成${dirText}機票登記　${selfRow.createdAt}`;
  try {
    await liff.shareTargetPicker([{ type: "text", text }]);
  } catch (e) { /* 使用者取消分享，不用特別處理 */ }
}

/* ============================================================
   admin.html：主辦人管理頁
   權限檢查只在使用者「主動進入這個頁面」時才觸發，不會在登記頁背景自動偵測身分，
   避免一般使用者每次開登記頁都多一次不必要的 API 呼叫。
   ============================================================ */
let ADMIN = { activityId: "", profile: null };

async function initAdminPage() {
  ADMIN.activityId = getActivityId();
  await loadConfig();
  try {
    const activity = await getActivityById(ADMIN.activityId);
    document.getElementById("f-activity-title").textContent = activity ? activity.title : ADMIN.activityId;
  } catch (e) {}

  document.getElementById("f-admin-login-btn").addEventListener("click", () => requireLogin());
  document.getElementById("f-invite-share-btn").addEventListener("click", shareInvite);

  try {
    const ok = await ensureLiff();
    if (!ok || !liff.isLoggedIn()) {
      document.getElementById("f-admin-login-gate").hidden = false;
      return;
    }
    const profile = await liff.getProfile();
    ADMIN.profile = { userId: profile.userId, displayName: profile.displayName };

    const { status } = await apiGet("isManager", { userId: ADMIN.profile.userId });
    if (status !== "approved") {
      document.getElementById("f-admin-denied").hidden = false;
      return;
    }
    document.getElementById("f-admin-panel").hidden = false;
  } catch (e) {
    document.getElementById("f-admin-denied").hidden = false;
    document.getElementById("f-admin-denied").textContent = "載入失敗，請重新整理再試一次";
  } finally {
    document.getElementById("f-admin-loading").hidden = true;
  }
}

function inviteBubble(activityTitle) {
  const link = `${RUNTIME.siteUrl}/flight-liff/index.html?activityId=${encodeURIComponent(ADMIN.activityId)}`;
  return {
    type: "bubble",
    body: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: [
        { type: "text", text: "✈️ 機票時刻登記", weight: "bold", size: "lg", color: "#2F7A72" },
        { type: "text", text: activityTitle, weight: "bold", size: "md", wrap: true, margin: "sm" },
        { type: "text", text: "請登記您的去程／回程航班，方便安排接送與確認同行班機。", size: "sm", color: "#666666", wrap: true, margin: "md" },
      ],
    },
    footer: {
      type: "box", layout: "vertical",
      contents: [
        { type: "button", style: "primary", color: "#17233D",
          action: { type: "uri", label: "前往登記", uri: link } },
      ],
    },
  };
}

async function shareInvite() {
  if (!liff.isApiAvailable("shareTargetPicker")) {
    toast("目前環境不支援 LINE 分享");
    return;
  }
  const title = document.getElementById("f-activity-title").textContent || ADMIN.activityId;
  try {
    await liff.shareTargetPicker([
      { type: "flex", altText: `【機票時刻登記】${title}`, contents: inviteBubble(title) },
    ]);
    toast("已送出分享");
  } catch (e) { /* 使用者取消分享，不用特別處理 */ }
}
let OV = { activityId: "", data: null, tab: "flight", direction: "go" };

const SPINNER_HTML = `<div class="f-spinner-wrap"><div class="f-spinner"></div></div>`;

async function initOverviewPage() {
  OV.activityId = getActivityId();
  const bodyEl = document.getElementById("f-overview-body");
  // 用目前網址原封不動的查詢字串組連結，不靠相對路徑解析，避免連結組錯
  document.getElementById("f-back-link").href = "index.html" + location.search;
  if (!OV.activityId) {
    bodyEl.innerHTML = `<div class="f-empty">網址缺少 activityId 參數。</div>`;
    return;
  }
  await loadConfig();
  try {
    const activity = await getActivityById(OV.activityId);
    document.getElementById("f-activity-title").textContent = activity ? activity.title : OV.activityId;
  } catch (e) {}

  // 只在初始化時綁定一次事件，之後切換分頁只更新 f-overview-body 的內容，
  // 絕不整個重寫 f-app／按鈕所在的 DOM，避免事件監聽器被換掉的問題
  document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => {
    OV.tab = btn.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b === btn));
    renderOverview();
  }));
  document.querySelectorAll("[data-dir]").forEach(btn => btn.addEventListener("click", () => {
    OV.direction = btn.dataset.dir;
    document.querySelectorAll("[data-dir]").forEach(b => b.classList.toggle("active", b === btn));
    renderOverview();
  }));

  bodyEl.innerHTML = SPINNER_HTML;
  try {
    OV.data = await apiGet("flightOverview", { activityId: OV.activityId });
    renderOverview();
  } catch (e) {
    bodyEl.innerHTML = `<div class="f-empty">載入失敗，請重新整理再試一次</div>`;
  }
}

function renderOverview() {
  const el = document.getElementById("f-overview-body");
  const dateEl = document.getElementById("f-overview-date");
  const dirData = OV.data[OV.direction];
  if (!dirData) { el.innerHTML = `<div class="f-empty">尚無資料</div>`; return; }

  dateEl.textContent = dirData.primaryDate || DEFAULT_DATES[OV.direction] || "";

  if (OV.tab === "flight") {
    const list = dirData.byFlight || [];
    if (list.length === 0) { el.innerHTML = `<div class="f-empty">目前還沒有人登記</div>`; return; }
    el.innerHTML = list.map(g => `
      <div class="f-flight-group">
        <div class="f-fg-head">
          <span class="f-fg-time">${g.depTime}–${g.arrTime}</span>
          <span class="f-fg-meta">${AIRLINES[g.airline]?.label || g.airline}｜${g.flightNo}｜共 ${g.names.length} 人</span>
        </div>
        <div class="f-fg-names">${g.names.map(escapeHtml).join("、")}</div>
      </div>
    `).join("");
  } else {
    const byHour = dirData.byHour || {};
    const hours = Object.keys(byHour).sort();
    if (hours.length === 0) { el.innerHTML = `<div class="f-empty">目前還沒有人登記</div>`; return; }
    const arrivalLabel = OV.direction === "go" ? "抵達澎湖" : "抵達松山";
    el.innerHTML = hours.map(hour => {
      const airlines = byHour[hour];
      const total = Object.values(airlines).reduce((sum, flights) => sum + Object.values(flights).reduce((s, f) => s + f.names.length, 0), 0);
      const airlineBlocks = Object.keys(airlines).map(aKey => {
        const flights = airlines[aKey];
        const aTotal = Object.values(flights).reduce((s, f) => s + f.names.length, 0);
        const flightLines = Object.values(flights).map(f => `
          <div class="f-hour-flight"><span class="f-hf-code">${f.depTime}–${f.arrTime}／${f.flightNo}</span>${f.names.map(escapeHtml).join("、")}</div>
        `).join("");
        return `<div class="f-hour-airline">${AIRLINES[aKey]?.label || aKey} ${aTotal}人</div>${flightLines}`;
      }).join("");
      const hourEnd = hour.split(":")[0] + ":59";
      return `
        <div class="f-hour-block">
          <div class="f-hour-title">${hour}~${hourEnd}（${arrivalLabel}）共 ${total} 人</div>
          ${airlineBlocks}
        </div>`;
    }).join("");
  }
}
