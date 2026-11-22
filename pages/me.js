/* 頁面：me（原 me.html）
   由 index.html 的路由在 ?page=me 時呼叫 mount()。
   mount 裡的 document 是「只看這一頁畫面」的版本：離開這頁後，還在跑的背景工作
   不會改到下一頁同 id 的元素。 */
window.PAGES = window.PAGES || {};
window.PAGES["me"] = {
  title: "我的活動",
  style: "\n  /* --- 現代化美化 CSS 擴充 --- */\n  :root {\n    --bg-main: #f8fafc;\n    --card-bg: #ffffff;\n    --text-main: #0f172a;\n    --text-muted: #64748b;\n    --primary: #2563eb;\n    --border-color: #e2e8f0;\n    --radius: 12px;\n  }\n\n  body {\n    background-color: var(--bg-main);\n    color: var(--text-main);\n    font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif;\n    margin: 0;\n    padding: 0;\n    line-height: 1.5;\n  }\n\n  /* 頂部列：改成深色底 */\n  .topbar {\n    background: #0f172a; /* 深色背景 */\n    color: #ffffff;\n    border-bottom: 1px solid #1e293b;\n    padding: 1.25rem 1.5rem;\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    position: sticky;\n    top: 0;\n    z-index: 100;\n    box-shadow: 0 2px 10px rgba(0,0,0,0.15);\n  }\n\n  .eyebrow {\n    font-size: 0.75rem;\n    font-weight: 600;\n    text-transform: uppercase;\n    letter-spacing: 0.05em;\n    color: #60a5fa; /* 亮藍色文字 */\n  }\n\n  .topbar h1 {\n    margin: 0.2rem 0 0 0;\n    font-size: 1.5rem;\n    font-weight: 700;\n    color: #ffffff;\n  }\n\n  /* 管理員區域 */\n  #managerArea {\n    display: flex;\n    gap: 0.5rem;\n    flex-wrap: wrap;\n    align-items: center;\n  }\n\n  /* 深色主題下的按鈕樣式 */\n  .btn-dark {\n    background: #1e293b;\n    color: #f1f5f9;\n    border: 1px solid #334155;\n    padding: 0.45rem 0.9rem;\n    border-radius: 8px;\n    font-size: 0.85rem;\n    font-weight: 500;\n    cursor: pointer;\n    text-decoration: none;\n    transition: all 0.2s ease;\n    display: inline-flex;\n    align-items: center;\n    gap: 0.3rem;\n  }\n\n  .btn-dark:hover {\n    background: #334155;\n    color: #ffffff;\n    border-color: #475569;\n  }\n\n  /* 主內容容器 */\n  .container {\n    max-width: 800px;\n    margin: 2rem auto;\n    padding: 0 1rem;\n  }\n\n  /* 區塊（Panel）樣式 */\n  .panel {\n    background: var(--card-bg);\n    border-radius: var(--radius);\n    border: 1px solid var(--border-color);\n    padding: 1.25rem;\n    margin-bottom: 1.5rem;\n    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);\n  }\n\n  .panel-title {\n    font-size: 1.1rem;\n    font-weight: 700;\n    margin: 0 0 1rem 0;\n    display: flex;\n    align-items: center;\n    gap: 0.5rem;\n  }\n\n  /* 活動卡片清單網格 */\n  .activity-grid {\n    display: grid;\n    gap: 0.75rem;\n  }\n\n  /* 卡片主體 */\n  .my-activity-card {\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    background: #ffffff;\n    border: 1px solid var(--border-color);\n    border-radius: 10px;\n    padding: 1rem 1.25rem;\n    text-decoration: none;\n    color: inherit;\n    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;\n  }\n\n  .my-activity-card:hover {\n    transform: translateY(-2px);\n    border-color: var(--primary);\n    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);\n  }\n\n  .my-activity-main {\n    display: flex;\n    flex-direction: column;\n    gap: 0.3rem;\n  }\n\n  .my-activity-title {\n    margin: 0;\n    font-size: 1rem;\n    font-weight: 600;\n    color: var(--text-main);\n  }\n\n  .my-activity-date {\n    margin: 0;\n    font-size: 0.85rem;\n    color: var(--text-muted);\n  }\n\n  /* 狀態膠囊標籤 */\n  .status-pill {\n    display: inline-flex;\n    align-items: center;\n    gap: 0.35rem;\n    padding: 0.25rem 0.65rem;\n    border-radius: 9999px;\n    font-size: 0.75rem;\n    font-weight: 600;\n    white-space: nowrap;\n  }\n\n  .status-dot {\n    width: 6px;\n    height: 6px;\n    border-radius: 50%;\n  }\n\n  /* 狀態顏色定義 */\n  .status-green  { background: #dcfce7; color: #15803d; }\n  .status-green .status-dot { background: #16a34a; }\n\n  .status-orange { background: #ffedd5; color: #c2410c; }\n  .status-orange .status-dot { background: #ea580c; }\n\n  .status-blue   { background: #dbeafe; color: #1d4ed8; }\n  .status-blue .status-dot { background: #2563eb; }\n\n  .status-purple { background: #f3e8ff; color: #7e22ce; }\n  .status-purple .status-dot { background: #9333ea; }\n\n  .status-gray   { background: #f1f5f9; color: #64748b; }\n  .status-gray .status-dot { background: #94a3b8; }\n\n  /* 空狀態 & 載入中 */\n  .empty, .loading {\n    text-align: center;\n    padding: 2rem 1rem;\n    color: var(--text-muted);\n    font-size: 0.9rem;\n  }\n\n  /* 過期區塊特殊視覺調整 */\n  .expired-panel {\n    opacity: 0.85;\n    background: #fafafa;\n  }\n  /* 已過期活動分頁 */\n  .pager { display:flex; justify-content:center; align-items:center; gap:0.75rem; margin-top:1rem; }\n  .pager button {\n    background:#ffffff; border:1px solid var(--border-color); border-radius:8px;\n    padding:0.4rem 0.9rem; font-size:0.85rem; cursor:pointer; color:var(--text-main);\n  }\n  .pager button:disabled { opacity:0.4; cursor:default; }\n  .pager span { font-size:0.85rem; color:var(--text-muted); }\n  .cache-note { font-size:0.75rem; color:#94a3b8; text-align:center; margin-bottom:12px; }\n",
  html: "<div class=\"topbar\">\n  <div>\n    <span class=\"eyebrow\">My Activities</span>\n    <h1>我的活動</h1>\n  </div>\n  <div id=\"managerArea\">\n    <button class=\"btn-dark\" onclick=\"toggleManagerMenu()\">🛠️ 管理員功能</button>\n  </div>\n</div>\n\n<div class=\"container\" id=\"content\">\n  <div class=\"spinner-wrap\"><div class=\"spinner\"></div></div>\n</div>",
  mount: function (root, document) {
    const statusInfo = {
      joined:     { label: "已參加",   cls: "status-green" },
      waitlisted: { label: "候補中",   cls: "status-orange" },
      viewed:     { label: "已觀看",   cls: "status-blue" },
      shared:     { label: "已分享",   cls: "status-purple" },
      expired:    { label: "已過期",   cls: "status-gray" }
    };

    function resolveStatus(item){
      if(item.expired) return statusInfo.expired;
      if(item.category === "waitlisted") {
        if(item.waitlistStatus === "cancelled") return { label: "候補已取消", cls: "status-gray" };
        if(item.waitlistStatus === "expired") return { label: "候補已逾期", cls: "status-gray" };
        return statusInfo.waitlisted;
      }
      return statusInfo[item.category] || statusInfo.viewed;
    }

    // 用 GitHub 上的公開快照（id-map.json 找自己的 serial，registration-status.json／
    // waitlist-status.json 掃描哪些活動裡有自己）快速算出「已參加」「候補中」這兩類，
    // 不用等 GAS。這兩份快照只保留「還在進行中」的活動（過期活動會被排程自動清掉），
    // 所以掃描範圍本來就不大；查不到自己的 serial（代表這個人從沒被記錄過）就回傳 null，
    // 交給完整版 GAS 查詢處理。觀看/分享紀錄跟已過期活動不在這兩份快照裡，只有完整版
    // GAS 查詢（getMyActivities）才查得到，這是刻意的取捨：那些是低頻率、非共用的個人化
    // 查詢，搬到 GitHub 不划算（詳見前面討論）。
    async function getMyActivitiesFast(userId){
      const [idMap, activities, regAll, waitAll] = await Promise.all([
        fetchIdMapFile(),
        fetchActivities(),
        fetchRegistrationStatusFile(),
        fetchWaitlistStatusFile(),
      ]);
      const mySerial = idMap[userId];
      if(mySerial == null) return null;

      const activityMap = {};
      activities.forEach(a => { activityMap[a.id] = a; });

      const joinedIds = new Set();
      const waitlistMap = {};

      Object.keys(regAll || {}).forEach(aid => {
        const entry = regAll[aid];
        if(entry && entry.list && entry.list.some(p => String(p.serial) === String(mySerial))) {
          joinedIds.add(aid);
        }
      });
      Object.keys(waitAll || {}).forEach(aid => {
        const entry = waitAll[aid];
        if(!entry || !entry.list) return;
        const mine = entry.list.find(p => String(p.serial) === String(mySerial));
        if(!mine) return;
        if(mine.status === "joined") joinedIds.add(aid);
        else waitlistMap[aid] = mine.status;
      });

      const today = new Date(); today.setHours(0,0,0,0);
      const allIds = new Set([...joinedIds, ...Object.keys(waitlistMap)]);
      const result = [];
      allIds.forEach(aid => {
        const act = activityMap[aid];
        if(!act) return;
        const category = joinedIds.has(aid) ? "joined" : "waitlisted";
        let expired = false;
        if(act.eventDate){ const d = new Date(act.eventDate); if(!isNaN(d)) expired = d < today; }
        result.push({ activityId: aid, title: act.title, date: act.date, cover: act.cover, category, waitlistStatus: waitlistMap[aid] || null, expired });
      });
      return result;
    }

    function itemHtml(item){
      const info = resolveStatus(item);
      return `
      <a class="my-activity-card" href="index.html?page=detail&id=${encodeURIComponent(item.activityId)}">
        <div class="my-activity-main">
          <p class="my-activity-title">${item.title}</p>
          <p class="my-activity-date">📅 ${item.date}</p>
        </div>
        <span class="status-pill ${info.cls}"><span class="status-dot"></span>${info.label}</span>
      </a>`;
    }

    function renderList(list){
      if(!list || !list.length) return `<div class="empty">目前尚無此類別紀錄</div>`;
      return `<div class="activity-grid">${list.map(itemHtml).join("")}</div>`;
    }

    /* ---------- 本機暫存 ----------
       第一次開啟：完整資料載入後存進 localStorage（依 userId 分開存）。
       之後開啟：先畫出本機暫存，再背景向 GAS 取最新資料、更新畫面與暫存。 */
    const ME_CACHE_PREFIX = "me:items:";
    const ME_LAST_USER_KEY = "me:lastUserId";

    function readMeCache(userId){
      try{
        const raw = localStorage.getItem(ME_CACHE_PREFIX + userId);
        if(!raw) return null;
        const c = JSON.parse(raw);
        return Array.isArray(c.items) ? c : null;
      }catch(e){ return null; }
    }
    function writeMeCache(userId, items){
      try{
        localStorage.setItem(ME_CACHE_PREFIX + userId, JSON.stringify({ items, savedAt: Date.now() }));
        localStorage.setItem(ME_LAST_USER_KEY, userId);
      }catch(e){ /* 儲存空間滿了或被停用就略過 */ }
    }
    function fmtTime(ts){
      const d = new Date(ts);
      const p = n => String(n).padStart(2, "0");
      return `${d.getMonth()+1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    /* ---------- 已過期活動：依日期排序（近的在上）、每 5 筆一頁 ---------- */
    const EXPIRED_PAGE_SIZE = 5;
    let expiredList = [];
    let expiredPage = 1;
    let activityDateMap = {}; // activityId -> eventDate，補 GAS 回傳資料沒有日期的情況

    function itemTime(item){
      const raw = item.eventDate || item.event_date || activityDateMap[item.activityId] || "";
      const t = raw ? new Date(raw).getTime() : NaN;
      return isNaN(t) ? -Infinity : t; // 沒日期的排最後
    }

    function renderExpiredPage(){
      const wrap = document.getElementById("expiredWrap");
      if(!wrap) return;
      if(!expiredList.length){ wrap.innerHTML = renderList(expiredList); return; }
      const totalPages = Math.ceil(expiredList.length / EXPIRED_PAGE_SIZE);
      expiredPage = Math.min(Math.max(1, expiredPage), totalPages);
      const startIdx = (expiredPage - 1) * EXPIRED_PAGE_SIZE;
      const pageItems = expiredList.slice(startIdx, startIdx + EXPIRED_PAGE_SIZE);
      wrap.innerHTML = renderList(pageItems) + (totalPages > 1 ? `
        <div class="pager">
          <button id="expiredPrev" ${expiredPage <= 1 ? "disabled" : ""}>‹ 上一頁</button>
          <span>${expiredPage} / ${totalPages}（共 ${expiredList.length} 筆）</span>
          <button id="expiredNext" ${expiredPage >= totalPages ? "disabled" : ""}>下一頁 ›</button>
        </div>` : "");
      const prev = document.getElementById("expiredPrev");
      const next = document.getElementById("expiredNext");
      if(prev) prev.onclick = () => { expiredPage--; renderExpiredPage(); };
      if(next) next.onclick = () => { expiredPage++; renderExpiredPage(); };
    }

    function renderPanels(items, opts){
      opts = opts || {};
      const joined   = items.filter(i => !i.expired && i.category === "joined");
      const waitlist = items.filter(i => !i.expired && i.category === "waitlisted");
      const viewed   = items.filter(i => !i.expired && i.category === "viewed");
      const shared   = items.filter(i => !i.expired && i.category === "shared");
      expiredList    = items.filter(i => i.expired).sort((a, b) => itemTime(b) - itemTime(a));
      const loading = opts.fromFastCheck;
      let noteHtml = "";
      if(opts.fromFastCheck){
        noteHtml = `<p class="cache-note">⚡ 已參加／候補中先用 GitHub 快取顯示，完整記錄（含觀看、分享、已過期活動）背景載入中…</p>`;
      }else if(opts.fromCache){
        noteHtml = `<p class="cache-note">📦 顯示本機暫存資料（${fmtTime(opts.savedAt)}），正在更新最新記錄…</p>`;
      }
      document.getElementById("content").innerHTML = noteHtml + `
        <div class="panel">
          <p class="panel-title">✅ 已參加的活動</p>
          <div>${renderList(joined)}</div>
        </div>
        <div class="panel">
          <p class="panel-title">⏳ 候補中的活動</p>
          <div>${renderList(waitlist)}</div>
        </div>
        <div class="panel">
          <p class="panel-title">👀 觀看紀錄</p>
          <div>${loading ? `<div class="loading">載入中…</div>` : renderList(viewed)}</div>
        </div>
        <div class="panel">
          <p class="panel-title">🔗 分享紀錄</p>
          <div>${loading ? `<div class="loading">載入中…</div>` : renderList(shared)}</div>
        </div>
        <div class="panel expired-panel">
          <p class="panel-title">🗄️ 已過期活動</p>
          <div id="expiredWrap">${loading ? `<div class="loading">載入中…</div>` : ""}</div>
        </div>
      `;
      if(!loading) renderExpiredPage();
    }

    async function loadActivityDates(){
      try{
        const acts = await fetchActivities();
        activityDateMap = {};
        acts.forEach(a => { if(a.eventDate) activityDateMap[a.id] = a.eventDate; });
      }catch(e){ /* 拿不到就只用 GAS 回傳的日期排序 */ }
    }

    async function main(){
      // 1) 登入前先用「上次登入者」的本機暫存秒開畫面
      let shownFromCache = false;
      let cachedUserId = null;
      try{ cachedUserId = localStorage.getItem(ME_LAST_USER_KEY); }catch(e){}
      if(cachedUserId){
        const c = readMeCache(cachedUserId);
        if(c){
          await loadActivityDates();
          renderPanels(c.items, { fromCache: true, savedAt: c.savedAt });
          shownFromCache = true;
        }
      }

      let profile;
      try{
        profile = await requireLogin();
      }catch(e){
        console.error(e);
        if(!shownFromCache){
          document.getElementById("content").innerHTML = `<div class="empty">⚠️ 需要 LINE 登入才能查看個人紀錄（${e.message || e}）</div>`;
        }
        return;
      }

      // 登入的人跟暫存的人不同時，改用這個人自己的暫存（沒有就清掉畫面重新載入）
      if(shownFromCache && profile.userId !== cachedUserId){
        shownFromCache = false;
        const c = readMeCache(profile.userId);
        if(c){
          renderPanels(c.items, { fromCache: true, savedAt: c.savedAt });
          shownFromCache = true;
        }else{
          document.getElementById("content").innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
        }
      }else if(!shownFromCache){
        const c = readMeCache(profile.userId);
        if(c){
          await loadActivityDates();
          renderPanels(c.items, { fromCache: true, savedAt: c.savedAt });
          shownFromCache = true;
        }
      }

      // 2) 沒有本機暫存（第一次開啟）才用 GitHub 快照先畫「已參加」「候補中」
      if(!shownFromCache){
        try{
          const fast = await getMyActivitiesFast(profile.userId);
          if(fast && fast.length){
            renderPanels(fast, { fromFastCheck: true });
          }
        }catch(e){
          console.warn("快速查詢失敗，直接等完整版查詢", e);
        }
      }

      // 3) 背景向 GAS 取完整最新資料，更新畫面並存回本機
      try{
        const [items] = await Promise.all([getMyActivities(), loadActivityDates()]);
        writeMeCache(profile.userId, items);
        renderPanels(items, { fromFastCheck: false });
      }catch(e){
        console.error(e);
        const note = document.querySelector(".cache-note");
        if(note && shownFromCache){
          note.textContent = `⚠️ 無法更新最新記錄，目前顯示的是本機暫存資料（${e.message}）`;
        }else if(!document.querySelector(".activity-grid")){
          document.getElementById("content").innerHTML = `<div class="empty">❌ 載入失敗：${e.message}</div>`;
        }
      }
    }
    // 點擊按鈕後才主動觸發檢測管理員權限
    async function toggleManagerMenu(){
      const area = document.getElementById("managerArea");
      area.innerHTML = `<span style="font-size: 0.85rem; color: #94a3b8;">驗證權限中...</span>`;

      try{
        const ok = await ensureLiff();
        if(!ok || !liff.isLoggedIn()){
          alert("請先登入 LINE");
          resetManagerBtn();
          return;
        }
        const profile = await liff.getProfile();
        const { status } = await checkIsManager(profile.userId);

        if(status === "approved"){
          area.innerHTML = `
            <a class="btn-dark" href="admin/new-activity.html">新增活動</a>
            <a class="btn-dark" href="admin/edit-activity.html">編輯活動</a>
            <a class="btn-dark" href="admin/waitlist.html">候補管理</a>
            <a class="btn-dark" href="admin/visit-log.html">閱讀記錄</a>
            <a class="btn-dark" href="admin/managers.html">管理申請</a>
          `;
        } else {
          alert("您目前非授權管理員！");
          resetManagerBtn();
        }
      }catch(e){
        console.warn("管理者狀態載入失敗", e);
        alert("驗證失敗或網路異常");
        resetManagerBtn();
      }
    }

    function resetManagerBtn(){
      document.getElementById("managerArea").innerHTML = `
        <button class="btn-dark" onclick="toggleManagerMenu()">🛠️ 管理員功能</button>
      `;
    }

    main();
  window.toggleManagerMenu = toggleManagerMenu;
  },
};
