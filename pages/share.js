/* 頁面：share（原 share.html）
   由 index.html 的路由在 ?page=share 時呼叫 mount()。
   mount 裡的 document 是「只看這一頁畫面」的版本：離開這頁後，還在跑的背景工作
   不會改到下一頁同 id 的元素。 */
window.PAGES = window.PAGES || {};
window.PAGES["share"] = {
  title: "分享活動",
  style: "",
  html: "<div class=\"topbar\">\n  <div>\n    <span class=\"eyebrow\">Share</span>\n    <h1>分享這個活動</h1>\n  </div>\n</div>\n\n<div class=\"confirm-card\" id=\"content\">載入中…</div>",
  mount: function (root, document) {
    const el = document.getElementById("content");

    function render(a){
      el.innerHTML = `
        ${a.cover ? `<img src="${a.cover}" style="width:100%;border-radius:10px;margin-bottom:14px;">` : ""}
        <p class="big">${a.title}</p>
        <p>${a.area}｜${a.date}</p>
        <button class="btn btn-teal btn-block" style="margin-top:16px" id="shareBtn">分享給朋友 / 群組</button>
        <a class="btn btn-ghost btn-block" style="margin-top:10px" href="index.html?page=detail&id=${encodeURIComponent(a.id)}">查看活動詳情</a>
      `;
      document.getElementById("shareBtn").addEventListener("click", ()=> shareOne(a));
    }

    async function main(){
      const id = getRealQueryParams().get("id"); // 經 liff.line.me 開啟時 id 可能包在 liff.state 裡
      if(!id){ el.innerHTML = "<p>缺少活動編號</p>"; return; }
      try{
        await ensureLiff();
        const a = await getActivityById(id);
        if(!a){ el.innerHTML = "<p>找不到這個活動</p>"; return; }
        render(a);
      }catch(e){
        console.error(e);
        el.innerHTML = "<p>讀取失敗，請稍後再試。</p>";
      }
    }

    main();
  },
};
