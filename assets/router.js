/* ============================================================
   單頁路由：所有一般使用者頁面都在 index.html 裡，用 ?page=xx 切換
     index.html                     → 活動列表（page=list，預設）
     index.html?page=detail&id=xxx  → 活動詳情
     index.html?page=share&id=xxx   → 分享活動
     index.html?page=me             → 我的活動
   換頁不重新載入整頁、也不開新視窗，所以一直留在 LIFF 裡，LIFF 只初始化一次。
   頁面內容在 pages/*.js，每頁是 window.PAGES[名稱] = { title, style, html, mount }。
   ============================================================ */
(function () {
  const DEFAULT_PAGE = "list";
  // 舊網址（detail.html 等）對應到的頁面名稱；頁面裡的舊連結也靠這張表攔截
  const FILE_TO_PAGE = { "": "list", "index.html": "list", "detail.html": "detail", "share.html": "share", "me.html": "me" };

  let currentRoot = null;
  let renderSeq = 0;

  function appBasePath() {
    const p = location.pathname;
    return p.slice(0, p.lastIndexOf("/") + 1);
  }

  // 讀目前網址的參數；經 liff.line.me 開啟時，參數可能包在 liff.state 裡（可能是 "?a=b" 或 "/detail.html?a=b"）
  function currentParams() {
    const params = new URLSearchParams(location.search);
    const state = params.get("liff.state");
    if (state) {
      params.delete("liff.state");
      const qIdx = state.indexOf("?");
      const pathPart = qIdx >= 0 ? state.slice(0, qIdx) : state;
      const inner = new URLSearchParams(qIdx >= 0 ? state.slice(qIdx + 1) : "");
      inner.forEach((v, k) => params.set(k, v));
      const file = pathPart.replace(/^.*\//, "");
      if (!params.get("page") && FILE_TO_PAGE[file] && FILE_TO_PAGE[file] !== "list") params.set("page", FILE_TO_PAGE[file]);
    }
    return params;
  }

  function buildUrl(params) {
    const qs = params.toString();
    return appBasePath() + "index.html" + (qs ? "?" + qs : "");
  }

  // 把同站內指向 index/detail/share/me 的網址轉成 ?page= 參數；不是這幾頁就回傳 null（照一般連結開）
  function toPageParams(href) {
    let url;
    try { url = new URL(href, location.href); } catch (e) { return null; }
    if (url.origin !== location.origin) return null;
    const base = appBasePath();
    if (!url.pathname.startsWith(base)) return null;
    const file = url.pathname.slice(base.length);
    if (file.includes("/")) return null; // admin/ 等子資料夾照一般連結開
    const page = FILE_TO_PAGE[file];
    if (!page) return null;
    const params = new URLSearchParams(url.search);
    if (page !== "list" || !params.get("page")) {
      if (page === "list") params.delete("page"); else params.set("page", page);
    }
    return params;
  }

  // 只看這一頁畫面的 document：getElementById / querySelector 限定在這頁的 root 裡找，
  // 其他屬性（title、createElement、cookie…）照常使用真正的 document
  function scopedDocument(root) {
    const real = window.document;
    const scoped = {
      getElementById: id => root.querySelector("#" + CSS.escape(id)),
      querySelector: sel => root.querySelector(sel),
      querySelectorAll: sel => root.querySelectorAll(sel),
    };
    return new Proxy(real, {
      get(target, prop) {
        if (prop in scoped) return scoped[prop];
        const v = Reflect.get(target, prop, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
      set(target, prop, value) { target[prop] = value; return true; },
    });
  }

  function render() {
    const params = currentParams();
    let name = params.get("page") || DEFAULT_PAGE;
    if (!window.PAGES || !window.PAGES[name]) name = DEFAULT_PAGE;
    const page = window.PAGES[name];
    const seq = ++renderSeq;

    // 舊頁面整個拿掉（還沒跑完的背景工作只會改到這個已經拿掉的畫面，不影響新頁面）
    if (currentRoot) currentRoot.remove();
    const root = window.document.createElement("div");
    root.className = "page page-" + name;
    root.innerHTML = (page.style ? `<style>${page.style}</style>` : "") + page.html;
    window.document.getElementById("app").appendChild(root);
    currentRoot = root;
    window.document.title = page.title;
    window.scrollTo(0, 0);

    try {
      page.mount(root, scopedDocument(root));
    } catch (e) {
      console.error(e);
      if (seq === renderSeq) root.innerHTML = `<div class="empty">頁面載入失敗：${e.message || e}</div>`;
    }
  }

  // 程式裡要換頁時呼叫：goPage("detail", { id: "trip014" })
  window.goPage = function (page, extra) {
    const params = new URLSearchParams();
    if (page && page !== DEFAULT_PAGE) params.set("page", page);
    Object.entries(extra || {}).forEach(([k, v]) => { if (v != null && v !== "") params.set(k, v); });
    history.pushState(null, "", buildUrl(params));
    render();
  };

  // 攔截頁面裡的連結：指向 index/detail/share/me 的，改成在同一頁切換
  window.document.addEventListener("click", e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const params = toPageParams(a.getAttribute("href"));
    if (!params) return;
    e.preventDefault();
    const url = buildUrl(params);
    if (url !== location.pathname + location.search) history.pushState(null, "", url);
    render();
  });

  // LINE 的返回鍵／瀏覽器上一頁
  window.addEventListener("popstate", render);

  window.startRouter = async function () {
    // 經 liff.line.me 進來時，先讓 LIFF 完成初始化（可能會把網址換成真正的路徑），再決定要顯示哪一頁
    if (new URLSearchParams(location.search).has("liff.state")) {
      try { await ensureLiff(); } catch (e) { /* 不在 LINE 裡也照常顯示 */ }
    } else {
      ensureLiff().catch(() => {});
    }
    // 把網址整理成乾淨的 index.html?page=...，之後頁面讀參數、重新整理、登入導回都用這個網址
    const clean = buildUrl(currentParams());
    if (clean !== location.pathname + location.search) history.replaceState(null, "", clean);
    render();
  };
})();
