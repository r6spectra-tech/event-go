/* ============================================================
   flight-liff 前端邏輯
   依賴 ../assets/main.js（apiGet / apiPost / ensureLiff / requireLogin / loadConfig）
   依賴 ./flight-data.js（FLIGHT_SCHEDULE / AIRLINES / DIRECTION_LABEL）
   ============================================================ */

/* FLIGHT_JS_VERSION: 20260727-11 */
const FLIGHT_JS_VERSION = "20260727-11";

// 透過 https://liff.line.me/{liffId}?activityId=xxx 這種網址帶參數時，LINE 不會把
// ?activityId=xxx 直接透傳給我們的頁面，而是包成一個 liff.state 參數（例如
// ?liff.state=%3FactivityId%3Dxxx），LIFF SDK 不會自動幫忙解開，要自己手動解析。
// 這支函式優先解開 liff.state，解不到才退回直接讀網址參數，兩種進入方式都能正確運作。
function getRealQueryParams() {
  const params = new URLSearchParams(location.search);
  if (params.has("liff.state")) {
    let state = params.get("liff.state");
    if (state.startsWith("?")) state = state.slice(1);
    try {
      return new URLSearchParams(state);
    } catch (e) { /* 解析失敗就退回原本的 params */ }
  }
  return params;
}

// 目前先寫死回傳固定的 activityId（見 flight-data.js 的 FIXED_ACTIVITY_ID），不透過網址參數帶入。
// getRealQueryParams() 還是保留給 claim.html 讀 direction／ownerUserId 用（那兩個沒辦法寫死，
// 每次分享的對象都不一樣），之後如果要恢復成「網址帶 activityId」的通用模式，把這裡改回
// getRealQueryParams().get("activityId") 就好，其餘程式碼不用動。
function getActivityId() {
  return FIXED_ACTIVITY_ID;
}

// 先呼叫既有的 loadConfig()（拿 siteUrl 等其他共用設定），再問一次 GAS 有沒有設定
// flight-liff 專屬的 FLIGHT_LIFF_ID，有的話覆蓋掉 RUNTIME.liffId。
// 這一步一定要在第一次呼叫 ensureLiff() 之前完成，因為 ensureLiff() 只有在
// RUNTIME.liffId 還沒設定時才會自己去問，之後就不會再變動了。
async function loadFlightConfig() {
  await loadConfig();
  try {
    const fc = await apiGet("flightConfig");
    if (fc && fc.liffId) RUNTIME.liffId = fc.liffId;
  } catch (e) {
    // 拿不到就沿用既有的 LIFF_ID，不影響任何功能（例如舊版 Code.gs 還沒加這個 action 的過渡期）
  }
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "f-toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function flightOptionsHtml(direction, airport, selectedValue) {
  let html = `<option value="">請選擇航班</option>`;
  Object.values(AIRLINES).forEach(a => {
    const list = (FLIGHT_SCHEDULE[direction][airport] && FLIGHT_SCHEDULE[direction][airport][a.key]) || [];
    if (list.length === 0) return; // 這個機場這家航空沒有資料就不顯示這組
    html += `<optgroup label="${a.label}">`;
    list.forEach(f => {
      const v = flightOptionValue(a.key, f);
      const sel = v === selectedValue ? "selected" : "";
      html += `<option value="${v}" ${sel}>${f.dep}–${f.arr}（${f.flightNo}）</option>`;
    });
    html += `</optgroup>`;
  });
  const manualSel = selectedValue === "manual" ? "selected" : "";
  html += `<option value="manual" ${manualSel}>其他（自行輸入航班資訊）</option>`;
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
  await loadFlightConfig();
  document.getElementById("f-activity-title").textContent = FIXED_ACTIVITY_TITLE;
  document.getElementById("f-activity-sub").textContent = "";

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
  const btn = document.getElementById("f-login-btn");
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = "登入中…";
  try {
    await requireLogin(); // 正常情況下這行會導頁登入，登入完成後頁面重新載入，帶回原本的 activityId 參數
  } catch (e) {
    // requireLogin() 失敗時不會自動導頁，把原因秀出來，不要讓使用者看到按鈕沒反應
    toast("登入失敗：" + e.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
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
  renderShareBothButton();
  renderClaimedCards();
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
        <div class="f-flight2">${buildFlightLine(r)}</div>
      </div>
    `).join("");
  }

  const actions = card.querySelector(".f-actions");
  actions.innerHTML = hasData
    ? `<button class="btn primary" onclick="openEditForm('${direction}')">編輯</button>
       <button class="btn danger" onclick="deleteDirection('${direction}')">刪除</button>`
    : `<button class="btn teal" onclick="openNewForm('${direction}')">填寫${direction === "go" ? "去程" : "回程"}</button>`;

  const claims = (PAGE.myData.claimsOnMine && PAGE.myData.claimsOnMine[direction]) || [];
  const claimInfoEl = card.querySelector(".f-claim-info");
  if (claimInfoEl) {
    claimInfoEl.innerHTML = claims.length
      ? `<div class="f-claim-label">✅ 已確認歸戶（${claims.length}）</div>` +
        claims.map(c => `<div class="f-claim-line">${escapeHtml(c.claimantDisplayName)}　${c.claimedAt}</div>`).join("")
      : "";
  }

  const shareRow = card.querySelector(".f-share-row");
  shareRow.innerHTML = hasData && list.length > 1
    ? `<button class="btn ghost" onclick="shareClaimInvite('${direction}')">👥 邀請同行人歸戶</button>`
    : "";
}

// 完成登記回報：去程／回程只要有登記，一次合併成一則訊息分享，不用分開點兩次
function renderShareBothButton() {
  const el = document.getElementById("f-share-both");
  if (!el) return;
  const hasGo = (PAGE.myData.go || []).length > 0;
  const hasReturn = (PAGE.myData.return || []).length > 0;
  el.innerHTML = (hasGo || hasReturn)
    ? `<button class="btn ghost" onclick="shareCompletion()">📣 分享到群組，回報已完成登記</button>`
    : "";
}

// 我認領（歸戶）過的別人的批次，顯示成額外的唯讀卡片
function renderClaimedCards() {
  const container = document.getElementById("f-claimed-cards");
  if (!container) return;
  const list = PAGE.myData.claimedByMe || [];
  if (list.length === 0) { container.innerHTML = ""; return; }
  container.innerHTML = list.map(c => {
    const dirLabel = DIRECTION_LABEL[c.direction] || c.direction;
    const rows = c.members.map(m => `
      <div class="f-row-2 ${m.isSelf === true || String(m.isSelf).toUpperCase() === "TRUE" ? "f-self" : ""}">
        <div class="f-name">${escapeHtml(m.name || "")}</div>
        <div class="f-flight2">${buildFlightLine(m)}</div>
      </div>
    `).join("");
    return `
      <div class="f-card">
        <h3>${dirLabel}<span class="f-tag">已歸戶</span></h3>
        <p class="f-sub" style="margin:0 0 8px;">由 ${escapeHtml(c.ownerDisplayName)} 管理，您於 ${c.claimedAt} 確認</p>
        ${rows}
        <div class="f-actions" style="margin-top:12px;">
          <button class="btn ghost" onclick="unclaimFromMyPage('${c.direction}','${c.ownerUserId}')">解除確認</button>
        </div>
      </div>
    `;
  }).join("");
}

async function unclaimFromMyPage(direction, ownerUserId) {
  try {
    await apiPost("flightUnclaim", { activityId: PAGE.activityId, direction, ownerUserId, claimantUserId: PAGE.profile.userId });
    toast("已解除確認");
    await refreshMyData();
  } catch (e) {
    toast("操作失敗：" + e.message);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---- 表單：新增 ---- */
function openNewForm(direction) {
  PAGE.editingDirection = direction;
  PAGE.formMembers = [
    { isSelf: true, name: PAGE.profile.displayName, date: DEFAULT_DATES[direction], airport: DEFAULT_AIRPORT, manual: false, airline: "", flightNo: "", dep: "", arr: "", waitlisted: false, removed: false },
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

  function toMember(r, isSelf, sameAsSelf) {
    // 優先用 Sheet 裡實際存的 airport 欄位；這個欄位是後來才加的，
    // 舊資料可能沒有值，這種情況才退回用航班反查機制去猜
    const storedAirport = r.airport && AIRPORTS[r.airport] ? r.airport : null;
    const airport = storedAirport || findAirportForFlight(direction, r.airline, r.flightNo) || DEFAULT_AIRPORT;
    const matched = findFlightOption(direction, airport, r.airline, r.flightNo);
    return {
      isSelf, name: r.name, date: r.flightDate,
      airport,
      manual: !matched,
      airline: r.airline, flightNo: r.flightNo, dep: r.depTime, arr: r.arrTime,
      waitlisted: r.waitlisted === true || String(r.waitlisted).toUpperCase() === "TRUE",
      sameAsSelf, removed: false,
    };
  }

  PAGE.formMembers = [
    toMember(selfRow, true),
    ...others.map(r => toMember(r, false, r.flightNo === selfRow.flightNo && r.flightDate === selfRow.flightDate)),
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

function airportSelectHtml(direction, m) {
  const label = direction === "go" ? "出發地" : "抵達地";
  return `
    <div class="f-field"><label>${label}</label>
      <select data-role="airport">
        ${Object.values(AIRPORTS).map(a => `<option value="${a.key}" ${a.key === (m.airport || DEFAULT_AIRPORT) ? "selected" : ""}>${a.label}</option>`).join("")}
      </select>
    </div>`;
}

function flightFieldsHtml(direction, m) {
  const currentValue = m.manual
    ? "manual"
    : (m.airline && m.flightNo ? flightOptionValue(m.airline, { flightNo: m.flightNo, dep: m.dep, arr: m.arr }) : "");
  const select = `
    <div class="f-field"><label>航班</label>
      <select data-role="flight">${flightOptionsHtml(direction, m.airport || DEFAULT_AIRPORT, currentValue)}</select>
    </div>`;
  const manualFields = m.manual ? `
    <div class="f-field"><label>航空公司</label><input type="text" data-role="manualAirline" placeholder="例如：德安航空" value="${escapeHtml(m.airline || "")}"></div>
    <div class="f-field"><label>航班編號</label><input type="text" data-role="manualFlightNo" placeholder="例如：GE123" value="${escapeHtml(m.flightNo || "")}"></div>
    <div class="f-field"><label>起飛時間</label><input type="time" data-role="manualDep" value="${m.dep || ""}"></div>
    <div class="f-field"><label>抵達時間</label><input type="time" data-role="manualArr" value="${m.arr || ""}"></div>
  ` : "";
  const waitlistField = `
    <label class="f-waitlist-check f-waitlist-disabled">
      <input type="checkbox" data-role="waitlisted" disabled ${m.waitlisted ? "checked" : ""}>
      🎫 候補中（此功能已停用，無法再勾選）
    </label>
    ${m.waitlisted ? `
      <p class="f-waitlist-warning">
        ⚠️ 不開放候補資訊填寫，本筆資訊不會顯示，請按刪除。<br>
        如有訂到票，請先按刪除，再登記機票資訊。
      </p>` : ""}`;
  return select + manualFields + waitlistField;
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
          ${airportSelectHtml(direction, m)}
          ${flightFieldsHtml(direction, m)}
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
          ${airportSelectHtml(direction, m)}
          ${flightFieldsHtml(direction, m)}
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
    if (role === "airport") {
      // 換機場後原本選的航班不一定還適用，清空重選比較不會誤植錯誤的班機資訊
      m.airport = e.target.value;
      m.manual = false;
      m.airline = ""; m.flightNo = ""; m.dep = ""; m.arr = "";
      renderForm();
    }
    if (role === "flight") {
      if (e.target.value === "manual") {
        m.manual = true;
        m.airline = ""; m.flightNo = ""; m.dep = ""; m.arr = "";
      } else {
        m.manual = false;
        const parsed = parseFlightOptionValue(e.target.value);
        if (parsed) { m.airline = parsed.airline; m.flightNo = parsed.flightNo; m.dep = parsed.dep; m.arr = parsed.arr; }
        else { m.airline = ""; m.flightNo = ""; m.dep = ""; m.arr = ""; }
      }
      renderForm();
    }
    if (role === "manualAirline") m.airline = e.target.value;
    if (role === "manualFlightNo") m.flightNo = e.target.value;
    if (role === "manualDep") m.dep = e.target.value;
    if (role === "manualArr") m.arr = e.target.value;
    if (role === "waitlisted") m.waitlisted = e.target.checked;
    if (role === "same") {
      m.sameAsSelf = e.target.checked;
      renderForm();
    }
  });

  document.getElementById("f-add-member").addEventListener("click", () => {
    PAGE.formMembers.push({
      isSelf: false, name: "", date: DEFAULT_DATES[PAGE.editingDirection], airport: DEFAULT_AIRPORT,
      manual: false, airline: "", flightNo: "", dep: "", arr: "", waitlisted: false, sameAsSelf: true, removed: false,
    });
    renderForm();
  });

  document.getElementById("f-form-cancel").addEventListener("click", closeForm);
  document.getElementById("f-form-save").addEventListener("click", submitForm);
}

async function submitForm() {
  const direction = PAGE.editingDirection;
  const self = PAGE.formMembers[0];
  if (!self.airline || !self.flightNo || !self.date || !self.dep || !self.arr) {
    toast("請完整選擇您自己的航班、日期、出發／抵達時間（自行輸入的話也都要填）");
    return;
  }
  const kept = PAGE.formMembers.filter(m => !m.removed);
  const members = kept.map(m => {
    if (m.isSelf) return { name: self.name, airline: self.airline, flightNo: self.flightNo, flightDate: self.date, depTime: self.dep, arrTime: self.arr, airport: self.airport, waitlisted: !!self.waitlisted };
    const useOwn = m.sameAsSelf === false;
    if (!m.name || !m.name.trim()) throw new Error("同行者稱呼不可空白");
    if (useOwn && (!m.airline || !m.flightNo || !m.date || !m.dep || !m.arr)) throw new Error(`「${m.name}」請完整選擇航班、日期、出發／抵達時間`);
    return {
      name: m.name.trim(),
      airline: useOwn ? m.airline : self.airline,
      flightNo: useOwn ? m.flightNo : self.flightNo,
      flightDate: useOwn ? m.date : self.date,
      depTime: useOwn ? m.dep : self.dep,
      arrTime: useOwn ? m.arr : self.arr,
      airport: useOwn ? m.airport : self.airport,
      waitlisted: !!(useOwn ? m.waitlisted : self.waitlisted),
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

// 完成登記回報：分享一張自己的飛機資訊卡片到群組，附「前往登記」按鈕方便還沒填的人直接點進去。
// 不寫分享者自己的 LINE 名稱，因為是自己分享自己的，看的人自然知道是誰傳的。
function buildFlightLine(r) {
  const airportLabel = AIRPORTS[r.airport] ? AIRPORTS[r.airport].label : "";
  const prefix = airportLabel ? `${airportLabel}｜` : "";
  // 候補功能已停用，這裡預設不再輸出候補標註（見表單裡的紅字提示說明）
  return `${prefix}${AIRLINES[r.airline]?.label || r.airline}｜${r.flightNo}｜${r.flightDate}｜${r.depTime}–${r.arrTime}`;
}

// 活動詳情頁在 event-go 根目錄，不是 flight-liff 底下，用純網址連過去
// （liff.line.me/{liffId} 後面不支援接路徑，只能接查詢參數，接路徑會失效）
// 活動詳情頁連結：實測過純網址雖然能打開，但中間會多跳轉 3~4 個頁面，
// 用 liff.line.me/{根系統的LIFF ID}/detail.html 這個格式體驗比較好，改用這個。
// 注意這裡的 LIFF ID 是 event-go 根系統原本的那組，跟 flight-liff 自己用的 RUNTIME.liffId 是不同的兩組。
const DETAIL_PAGE_LIFF_ID = "2008568136-hwE2jXK5";
function detailPageUrl() {
  return `https://liff.line.me/${DETAIL_PAGE_LIFF_ID}/detail.html?id=${encodeURIComponent(FIXED_ACTIVITY_ID)}`;
}

function completionBubble(entries, timestampText) {
  // 改用 liff.line.me 入口網址（不帶路徑/參數，activityId 已寫死不需要）,而不是純網址，
  // 這樣點進去的人會有真正的 LIFF 原生環境（isInClient()=true），他們自己要用分享功能時才會正常。
  const link = `https://liff.line.me/${RUNTIME.liffId}`;
  const bodyContents = [
    { type: "text", text: "完成登記飛機資訊！", weight: "bold", size: "lg", color: "#2F7A72", wrap: true },
  ];
  entries.forEach((e, i) => {
    bodyContents.push({ type: "text", text: e.label, size: "sm", color: "#666666", margin: i === 0 ? "md" : "lg" });
    bodyContents.push({ type: "text", text: e.flightLine, weight: "bold", size: "md", wrap: true, margin: "xs" });
  });
  return {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "sm", contents: bodyContents },
    footer: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: [
        { type: "box", layout: "horizontal", spacing: "sm", contents: [
          { type: "button", style: "primary", color: "#17233D", height: "sm",
            action: { type: "uri", label: "前往登記", uri: link } },
          { type: "button", style: "secondary", height: "sm",
            action: { type: "uri", label: "活動詳情", uri: detailPageUrl() } },
        ] },
        { type: "text", text: timestampText || "", size: "xs", color: "#999999", align: "start" },
      ],
    },
  };
}

// 完成登記回報：去程／回程只要有登記就一起帶，不用分開分享兩次
async function shareCompletion() {
  const goRow = (PAGE.myData.go || []).find(r => r.isSelf === true || String(r.isSelf).toUpperCase() === "TRUE");
  const returnRow = (PAGE.myData.return || []).find(r => r.isSelf === true || String(r.isSelf).toUpperCase() === "TRUE");
  if (!goRow && !returnRow) return;

  const ok = await ensureLiff();
  if (!ok || !liff.isApiAvailable("shareTargetPicker")) {
    toast("目前環境不支援 LINE 分享");
    return;
  }

  const entries = [];
  let timestampText = "";
  if (goRow) { entries.push({ label: "去程：", flightLine: buildFlightLine(goRow) }); timestampText = goRow.createdAt; }
  if (returnRow) { entries.push({ label: "回程：", flightLine: buildFlightLine(returnRow) }); timestampText = returnRow.createdAt; }

  const bubble = completionBubble(entries, timestampText);
  try {
    await liff.shareTargetPicker([{ type: "flex", altText: "完成登記飛機資訊！", contents: bubble }]);
  } catch (e) { /* 使用者取消分享，不用特別處理 */ }
}

// 邀請同行人歸戶：把連結分享給指定好友（liff.shareTargetPicker 讓填表人自己選要傳給誰），
// 連結只帶 activityId + direction + ownerUserId，不綁定特定一列，對方點開後自己確認是不是他的行程
function claimInviteBubble(direction) {
  const link = `${RUNTIME.siteUrl}/flight-liff/claim.html?activityId=${encodeURIComponent(PAGE.activityId)}&direction=${direction}&ownerUserId=${encodeURIComponent(PAGE.profile.userId)}`;
  const dirLabel = direction === "go" ? "去程" : "回程";
  return {
    type: "bubble",
    body: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: [
        { type: "text", text: "🎫 同行資訊確認", weight: "bold", size: "lg", color: "#2F7A72" },
        { type: "text", text: `${PAGE.profile.displayName} 已幫您登記了${dirLabel}機票，請確認資訊是否正確`, wrap: true, size: "sm", margin: "md" },
      ],
    },
    footer: {
      type: "box", layout: "vertical",
      contents: [
        { type: "button", style: "primary", color: "#17233D",
          action: { type: "uri", label: "確認我的資訊", uri: link } },
      ],
    },
  };
}

async function shareClaimInvite(direction) {
  const ok = await ensureLiff();
  if (!ok || !liff.isApiAvailable("shareTargetPicker")) {
    toast("目前環境不支援 LINE 分享");
    return;
  }
  try {
    await liff.shareTargetPicker([{ type: "flex", altText: "同行資訊確認", contents: claimInviteBubble(direction) }]);
  } catch (e) { /* 使用者取消分享，不用特別處理 */ }
}

/* ============================================================
   claim.html：同行人歸戶認領頁
   認領綁定的是「填表人＋方向」這個整批，不綁特定一列，所以填表人之後怎麼編輯內容都不影響認領關係。
   ============================================================ */
let CLAIM = { activityId: "", direction: "", ownerUserId: "", profile: null, info: null };

async function initClaimPage() {
  const params = getRealQueryParams();
  CLAIM.activityId = params.get("activityId") || "";
  CLAIM.direction = params.get("direction") || "";
  CLAIM.ownerUserId = params.get("ownerUserId") || "";
  document.getElementById("f-back-link").href = "index.html?activityId=" + encodeURIComponent(CLAIM.activityId);

  if (!CLAIM.activityId || !CLAIM.direction || !CLAIM.ownerUserId) {
    document.getElementById("f-claim-loading").hidden = true;
    const body = document.getElementById("f-claim-body");
    body.hidden = false;
    body.innerHTML = `<div class="f-empty">連結參數不完整，請透過分享連結進入。</div>`;
    return;
  }

  await loadFlightConfig();
  document.getElementById("f-claim-login-btn").addEventListener("click", () => requireLogin());

  try {
    const ok = await ensureLiff();
    if (!ok || !liff.isLoggedIn()) {
      document.getElementById("f-claim-login-gate").hidden = false;
      return;
    }
    const profile = await liff.getProfile();
    CLAIM.profile = { userId: profile.userId, displayName: profile.displayName };
    await loadClaimInfo();
  } catch (e) {
    const body = document.getElementById("f-claim-body");
    body.hidden = false;
    body.innerHTML = `<div class="f-empty">載入失敗，請重新整理再試一次</div>`;
  } finally {
    document.getElementById("f-claim-loading").hidden = true;
  }
}

async function loadClaimInfo() {
  const info = await apiGet("flightBatchInfo", {
    activityId: CLAIM.activityId, direction: CLAIM.direction,
    ownerUserId: CLAIM.ownerUserId, viewerUserId: CLAIM.profile.userId,
  });
  CLAIM.info = info;
  renderClaimBody();
}

function renderClaimBody() {
  const el = document.getElementById("f-claim-body");
  el.hidden = false;
  const info = CLAIM.info;
  const dirLabel = DIRECTION_LABEL[CLAIM.direction] || CLAIM.direction;

  const rowsHtml = info.members.map(m => `
    <div class="f-row-2 ${m.isSelf === true || String(m.isSelf).toUpperCase() === "TRUE" ? "f-self" : ""}">
      <div class="f-name">${escapeHtml(m.name || "")}</div>
      <div class="f-flight2">${buildFlightLine(m)}</div>
    </div>
  `).join("");

  const actionHtml = info.alreadyClaimed
    ? `<p class="f-sub">您已於 ${info.claimedAt} 確認過這份行程。</p>
       <button class="btn danger" onclick="doUnclaim()">解除確認</button>`
    : `<button class="btn primary" onclick="doClaim()">✅ 這是我的行程，確認</button>`;

  el.innerHTML = `
    <div class="f-card">
      <h3>${escapeHtml(info.ownerDisplayName)} 幫您登記了${dirLabel}</h3>
      ${rowsHtml}
    </div>
    <div class="f-actions" style="flex-direction:column; gap:10px;">${actionHtml}</div>
    <p class="f-sub" style="margin-top:14px;">這份行程由 ${escapeHtml(info.ownerDisplayName)} 管理，確認後您可以隨時回來查看，但無法自行編輯內容。如果內容有需要修改，請聯絡 ${escapeHtml(info.ownerDisplayName)}。</p>
  `;
}

async function doClaim() {
  try {
    await apiPost("flightClaim", {
      activityId: CLAIM.activityId, direction: CLAIM.direction, ownerUserId: CLAIM.ownerUserId,
      ownerDisplayName: CLAIM.info.ownerDisplayName,
      claimantUserId: CLAIM.profile.userId, claimantDisplayName: CLAIM.profile.displayName,
    });
    toast("已確認");
    await loadClaimInfo();
  } catch (e) {
    toast("操作失敗：" + e.message);
  }
}

async function doUnclaim() {
  try {
    await apiPost("flightUnclaim", {
      activityId: CLAIM.activityId, direction: CLAIM.direction, ownerUserId: CLAIM.ownerUserId,
      claimantUserId: CLAIM.profile.userId,
    });
    toast("已解除確認");
    await loadClaimInfo();
  } catch (e) {
    toast("操作失敗：" + e.message);
  }
}

/* ============================================================
   admin.html：主辦人管理頁
   權限檢查只在使用者「主動進入這個頁面」時才觸發，不會在登記頁背景自動偵測身分，
   避免一般使用者每次開登記頁都多一次不必要的 API 呼叫。
   ============================================================ */
let ADMIN = { activityId: "", profile: null };

async function initAdminPage() {
  ADMIN.activityId = getActivityId();
  await loadFlightConfig();
  document.getElementById("f-activity-title").textContent = FIXED_ACTIVITY_TITLE;

  document.getElementById("f-admin-login-btn").addEventListener("click", () => requireLogin());
  document.getElementById("f-invite-share-btn").addEventListener("click", shareInvite);
  document.getElementById("f-ov-share-btn").addEventListener("click", shareOverview);

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
    document.getElementById("f-export-btn").addEventListener("click", exportCsv);
    await loadGroupSection();
  } catch (e) {
    document.getElementById("f-admin-denied").hidden = false;
    document.getElementById("f-admin-denied").textContent = "載入失敗，請重新整理再試一次";
  } finally {
    document.getElementById("f-admin-loading").hidden = true;
  }
}

function inviteBubble(activityTitle) {
  const link = `https://liff.line.me/${RUNTIME.liffId}`;
  return {
    type: "bubble",
    body: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: [
        { type: "text", text: "✈️ 機票時刻登記", weight: "bold", size: "lg", color: "#2F7A72" },
        { type: "text", text: activityTitle, weight: "bold", size: "md", wrap: true, margin: "sm" },
        { type: "text", text: "請登記您的去程／回程航班時刻。", size: "sm", color: "#666666", wrap: true, margin: "md" },
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

/* ============================================================
   分享總表到群組
   把 flightOverview() 的資料轉成 Flex 內容直接嵌進訊息裡（不是只有連結），
   人數/姓名要不要顯示由管理頁的開關決定；內容太多時自動切成多頁 carousel（最多12頁），
   避免超出 Flex 的長度負擔。
   ============================================================ */
const OV_SECTIONS_PER_BUBBLE = 6;
const OV_MAX_BUBBLES = 12;

function buildOverviewSectionsForFlight(dateGroups, showCount, showNames, showAirport) {
  const sections = [];
  dateGroups.forEach(dg => {
    dg.flights.forEach(g => {
      const airportLabel = (showAirport && AIRPORTS[g.airport]) ? AIRPORTS[g.airport].label + "　" : "";
      let title = `${g.depTime}–${g.arrTime}　${airportLabel}${AIRLINES[g.airline]?.label || g.airline}｜${g.flightNo}`;
      if (showCount) title += `　共${g.names.length}人`;
      const body = showNames ? g.names.join("、") : "";
      sections.push({ date: dg.date, title, body });
    });
  });
  return sections;
}

function buildOverviewSectionsForHour(dateGroups, showCount, showNames, showAirport) {
  const sections = [];
  dateGroups.forEach(dg => {
    dg.hours.forEach(h => {
      const hourEnd = h.hour.split(":")[0] + ":59";
      const total = h.airlines.reduce((s, a) => s + a.total, 0);
      let title = `${h.hour}~${hourEnd}`;
      if (showCount) title += `　共${total}人`;
      // 同一個時段裡的各家航空公司都收進同一段的 body 裡，時段標題（title）只印一次，
      // 不會像之前那樣每家航空公司各自重複印一次時段範圍
      const airlineLines = h.airlines.map(a => {
        let line = `${AIRLINES[a.airline]?.label || a.airline}`;
        if (showCount) line += `　${a.total}人`;
        if (showNames || showAirport) {
          const detail = a.flights.map(f => {
            let d = `${f.depTime}–${f.arrTime}／${f.flightNo}`;
            if (showAirport && AIRPORTS[f.airport]) d += `／${AIRPORTS[f.airport].label}`;
            if (showNames) d += `：${f.names.join("、")}`;
            return d;
          }).join("\n");
          line += "\n" + detail;
        }
        return line;
      });
      sections.push({ date: dg.date, title, body: airlineLines.join("\n") });
    });
  });
  return sections;
}

function overviewSectionsToBubble(sections, headerText) {
  const contents = [
    { type: "text", text: headerText, weight: "bold", size: "lg", color: "#2F7A72", wrap: true },
  ];
  if (sections.length === 0) {
    contents.push({ type: "text", text: "目前還沒有人登記", size: "sm", color: "#999999", margin: "md" });
  }
  let lastDate = null;
  let rowIdx = 0;
  sections.forEach(s => {
    if (s.date !== lastDate) {
      contents.push({ type: "separator", margin: "lg" });
      contents.push({ type: "text", text: s.date, weight: "bold", size: "sm", color: "#17233D", margin: "lg" });
      lastDate = s.date;
      rowIdx = 0; // 每個日期底下重新起算斑馬紋，第一格固定同一底色，比較好對照
    }
    const zebra = rowIdx % 2 === 0 ? "#FFFFFF" : "#F0E9D2";
    const boxContents = [{ type: "text", text: s.title, size: "sm", weight: "bold", wrap: true }];
    if (s.body) boxContents.push({ type: "text", text: s.body, size: "xs", color: "#666666", wrap: true, margin: "xs" });
    contents.push({
      type: "box", layout: "vertical", backgroundColor: zebra, cornerRadius: "6px",
      borderWidth: "1px", borderColor: "#D8CBA0",
      paddingAll: "8px", margin: "sm", contents: boxContents,
    });
    rowIdx++;
  });
  return {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "none", contents },
    footer: {
      type: "box", layout: "horizontal", spacing: "sm",
      contents: [
        { type: "button", style: "primary", color: "#17233D", height: "sm",
          action: { type: "uri", label: "前往登記", uri: `https://liff.line.me/${RUNTIME.liffId}` } },
        { type: "button", style: "secondary", height: "sm",
          action: { type: "uri", label: "活動詳情", uri: detailPageUrl() } },
      ],
    },
  };
}

// 回傳「一組 bubble 陣列」而不是直接包成 carousel，方便呼叫端把去程/回程的頁面串在一起
// 再一起決定要不要包 carousel。titleBase 不含頁碼，頁碼是這支函式自己加的。
function buildOverviewBubbles(sections, titleBase) {
  if (sections.length === 0) {
    return [overviewSectionsToBubble([], titleBase + "（目前還沒有人登記）")];
  }
  const chunks = [];
  for (let i = 0; i < sections.length; i += OV_SECTIONS_PER_BUBBLE) {
    chunks.push(sections.slice(i, i + OV_SECTIONS_PER_BUBBLE));
  }
  if (chunks.length === 1) {
    return [overviewSectionsToBubble(chunks[0], titleBase)];
  }
  return chunks.map((chunk, i) => overviewSectionsToBubble(chunk, `${titleBase}（${i + 1}/${chunks.length}）`));
}

async function shareOverview() {
  const directions = [];
  if (document.getElementById("f-ov-dir-go").checked) directions.push("go");
  if (document.getElementById("f-ov-dir-return").checked) directions.push("return");
  if (directions.length === 0) {
    toast("請至少選一個方向");
    return;
  }
  const tab = document.querySelector('input[name="f-ov-tab"]:checked').value;
  const showCount = document.getElementById("f-ov-count").checked;
  const showNames = document.getElementById("f-ov-names").checked;
  const showAirport = document.getElementById("f-ov-airport").checked;

  const ok = await ensureLiff();
  if (!ok || !liff.isApiAvailable("shareTargetPicker")) {
    toast("目前環境不支援 LINE 分享");
    return;
  }

  const btn = document.getElementById("f-ov-share-btn");
  btn.disabled = true;
  try {
    const data = await apiGet("flightOverview", { activityId: ADMIN.activityId });
    const tabLabel = tab === "flight" ? "依航班" : "依時段";

    // 去程/回程各自產生自己的頁面，再依序接在一起：去程幾頁、接著回程幾頁，
    // 不是把兩個方向的資料混在同一頁裡。
    let allBubbles = [];
    directions.forEach(direction => {
      const dirData = data[direction];
      const dirLabel = direction === "go" ? "去程" : "回程";
      const dateGroups = (tab === "flight" ? dirData.byFlight : dirData.byHour) || [];
      const sections = tab === "flight"
        ? buildOverviewSectionsForFlight(dateGroups, showCount, showNames, showAirport)
        : buildOverviewSectionsForHour(dateGroups, showCount, showNames, showAirport);
      const bubbles = buildOverviewBubbles(sections, `📋 ${dirLabel}總表・${tabLabel}`);
      allBubbles = allBubbles.concat(bubbles);
    });

    let truncated = false;
    if (allBubbles.length > OV_MAX_BUBBLES) {
      allBubbles = allBubbles.slice(0, OV_MAX_BUBBLES);
      truncated = true;
    }

    const contents = allBubbles.length === 1 ? allBubbles[0] : { type: "carousel", contents: allBubbles };
    const dirLabelAll = directions.map(d => d === "go" ? "去程" : "回程").join("＋");
    const altText = `${dirLabelAll}總表（${tabLabel}）`;
    await liff.shareTargetPicker([{ type: "flex", altText, contents }]);
    toast(truncated ? "已送出分享（內容過多，只帶前12頁）" : "已送出分享");
  } catch (e) {
    toast("分享失敗：" + e.message);
  } finally {
    btn.disabled = false;
  }
}

// 群組成員比對：先讓主辦人挑一個「這個活動對應的群組」，再拿群組已知成員清單跟已登記名單比對
async function loadGroupSection() {
  const setupEl = document.getElementById("f-group-setup");
  const resultEl = document.getElementById("f-group-result");
  setupEl.innerHTML = `<div class="f-spinner-wrap"><div class="f-spinner"></div></div>`;
  try {
    const [groups, compare] = await Promise.all([
      apiGet("flightKnownGroups", { requestedBy: ADMIN.profile.userId }),
      apiGet("flightGroupCompare", { requestedBy: ADMIN.profile.userId, activityId: ADMIN.activityId }),
    ]);

    if (groups.length === 0) {
      setupEl.innerHTML = `<p class="f-sub">目前還沒有偵測到任何群組成員紀錄。請確認 LINE Webhook 已設定好（詳見 README），並讓群組裡的人講幾句話，蒐集才會開始累積。</p>`;
    } else {
      setupEl.innerHTML = `
        <p class="f-sub" style="margin-bottom:8px;">選擇這個活動對應的 LINE 群組：</p>
        ${groups.map(g => `
          <label style="display:block; margin-bottom:8px; font-size:0.85rem;">
            <input type="radio" name="f-group-radio" value="${g.groupId}" ${g.groupId === compare.groupId ? "checked" : ""}>
            ${escapeHtml(g.groupId.slice(0, 12))}…（${g.memberCount} 人${g.sampleNames.length ? "，例如：" + g.sampleNames.map(escapeHtml).join("、") : ""}）
          </label>
        `).join("")}
        <button class="btn primary" id="f-group-set-btn" style="margin-top:6px;">設定為此活動的群組</button>
      `;
      document.getElementById("f-group-set-btn").addEventListener("click", async () => {
        const checked = document.querySelector('input[name="f-group-radio"]:checked');
        if (!checked) { toast("請先選一個群組"); return; }
        try {
          await apiPost("flightSetActivityGroup", { requestedBy: ADMIN.profile.userId, activityId: ADMIN.activityId, groupId: checked.value });
          toast("已設定");
          await loadGroupSection();
        } catch (e) {
          toast("設定失敗：" + e.message);
        }
      });
    }

    renderGroupCompareResult(compare);
  } catch (e) {
    setupEl.innerHTML = `<div class="f-empty">載入失敗：${e.message}</div>`;
    resultEl.innerHTML = "";
  }
}

function renderGroupCompareResult(compare) {
  const el = document.getElementById("f-group-result");
  if (!compare.groupId) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <p class="f-sub">群組已知成員 ${compare.groupMemberCount} 人／已登記 ${compare.registeredCount} 人</p>
    ${compare.notRegistered.length === 0
      ? `<p class="f-sub" style="color:var(--teal);">✅ 群組裡已知的成員都已經登記了</p>`
      : `<p class="f-sub" style="margin-bottom:6px;">尚未登記（${compare.notRegistered.length} 人）：</p>
         <div class="f-flight-group">${compare.notRegistered.map(u => `<div style="padding:3px 0;">${escapeHtml(u.displayName)}</div>`).join("")}</div>`
    }
  `;
}

// 名單匯出：純前端組 CSV，加 UTF-8 BOM 讓 Excel 開啟時中文不會亂碼
async function exportCsv() {
  const btn = document.getElementById("f-export-btn");
  btn.disabled = true;
  try {
    const direction = document.querySelector('input[name="f-export-dir"]:checked').value;
    const rows = await apiGet("flightExport", {
      requestedBy: ADMIN.profile.userId, activityId: ADMIN.activityId,
      direction: direction === "all" ? "" : direction,
    });
    if (rows.length === 0) {
      toast("目前沒有資料可以匯出");
      return;
    }
    // 技術欄名 -> CSV 表頭中文字，以及部分欄位要轉成可讀文字（不是存進 Sheet 的原始代碼值）
    const cols = [
      ["direction", "方向", v => (v === "go" ? "去程" : v === "return" ? "回程" : v)],
      ["ownerDisplayName", "填表人", v => v],
      ["name", "姓名", v => v],
      ["isSelf", "本人", v => (v === true || String(v).toUpperCase() === "TRUE" ? "是" : "否")],
      ["airport", "出發/抵達地", v => (AIRPORTS[v] ? AIRPORTS[v].label : v)],
      ["airline", "航空公司", v => (AIRLINES[v] ? AIRLINES[v].label : v)],
      ["flightNo", "航班編號", v => v],
      ["waitlisted", "候補中", v => (v === true || String(v).toUpperCase() === "TRUE" ? "是" : "否")],
      ["flightDate", "日期", v => v],
      ["depTime", "起飛", v => v],
      ["arrTime", "抵達", v => v],
      ["seq", "流水號", v => v],
      ["createdAt", "建立時間", v => v],
      ["updatedAt", "更新時間", v => v],
    ];
    const header = cols.map(c => c[1]).join(",");
    const lines = rows.map(r => cols.map(([key, , fmt]) => csvEscape(fmt(r[key]))).join(","));
    const csv = "\uFEFF" + [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flight-${ADMIN.activityId}-${direction}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast("匯出失敗：" + e.message);
  } finally {
    btn.disabled = false;
  }
}

function csvEscape(v) {
  const s = String(v == null ? "" : v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
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
  await loadFlightConfig();
  document.getElementById("f-activity-title").textContent = FIXED_ACTIVITY_TITLE;

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
  const dirData = OV.data[OV.direction];
  if (!dirData) { el.innerHTML = `<div class="f-empty">尚無資料</div>`; return; }

  if (OV.tab === "flight") {
    const dateGroups = dirData.byFlight || [];
    if (dateGroups.length === 0) { el.innerHTML = `<div class="f-empty">目前還沒有人登記</div>`; return; }
    el.innerHTML = dateGroups.map(dg => `
      <div class="f-date-caption">${dg.date}</div>
      ${dg.flights.map(g => `
        <div class="f-flight-group">
          <div class="f-fg-head">
            <span class="f-fg-time">${g.depTime}–${g.arrTime}</span>
            <span class="f-fg-meta">${AIRPORTS[g.airport] ? AIRPORTS[g.airport].label + "｜" : ""}${AIRLINES[g.airline]?.label || g.airline}｜${g.flightNo}｜共 ${g.names.length} 人</span>
          </div>
          <div class="f-fg-names">${g.names.map(escapeHtml).join("、")}</div>
        </div>
      `).join("")}
    `).join("");
  } else {
    const dateGroups = dirData.byHour || [];
    if (dateGroups.length === 0) { el.innerHTML = `<div class="f-empty">目前還沒有人登記</div>`; return; }
    const arrivalLabel = OV.direction === "go" ? "抵達澎湖" : "抵達目的地";
    el.innerHTML = dateGroups.map(dg => `
      <div class="f-date-caption">${dg.date}</div>
      ${dg.hours.map(h => {
        const total = h.airlines.reduce((s, a) => s + a.total, 0);
        const hourEnd = h.hour.split(":")[0] + ":59";
        const airlineBlocks = h.airlines.map(a => `
          <div class="f-hour-airline">${AIRLINES[a.airline]?.label || a.airline} ${a.total}人</div>
          ${a.flights.map(f => `
            <div class="f-hour-flight"><span class="f-hf-code">${f.depTime}–${f.arrTime}／${f.flightNo}${AIRPORTS[f.airport] ? "／" + AIRPORTS[f.airport].label : ""}</span>${f.names.map(escapeHtml).join("、")}</div>
          `).join("")}
        `).join("");
        return `
          <div class="f-hour-block">
            <div class="f-hour-title">${h.hour}~${hourEnd}（${arrivalLabel}）共 ${total} 人</div>
            ${airlineBlocks}
          </div>`;
      }).join("")}
    `).join("");
  }
}
