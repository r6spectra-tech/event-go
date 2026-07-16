/* ============================================================
   設定區：改這裡就好
   ============================================================ */
const CONFIG = {
  LIFF_ID: "YOUR_LIFF_ID",              // LINE Developers > LIFF > ID
  SHEET_ID: "11VaDkoWogfx_DxZg2XuMQPwLY4o9Zl9nNUQmCUBuBCk",     // 試算表網址中 /d/ 與 /edit 之間那段
  SHEET_NAME: "activities",             // 分頁名稱
  SITE_URL: "https://r6spectra-tech.github.io/event-go", // GitHub Pages 網址（無結尾斜線）
  MAX_SHARE_ITEMS: 5,                   // liff.shareTargetPicker 一次最多可帶 5 則訊息
  MAX_CAROUSEL_BUBBLES: 12,             // 單一 flex carousel 最多 12 張卡片
};

/* ============================================================
   Google Sheet 讀取（用 Google Visualization API，不需要 API Key，
   只要試算表共用設定是「知道連結的人可查看」即可）
   ============================================================ */
async function fetchActivities() {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}`;
  const res = await fetch(url);
  const text = await res.text();
  // 回傳格式是 google.visualization.Query.setResponse({...}); 要先剝殼
  const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const cols = json.table.cols.map(c => (c.label || c.id || "").trim());
  const rows = json.table.rows.map(r => {
    const obj = {};
    cols.forEach((col, i) => {
      const cell = r.c[i];
      obj[col] = cell ? (cell.f ?? cell.v ?? "") : "";
    });
    return normalizeActivity(obj);
  });
  return rows.filter(a => a.id);
}

function normalizeActivity(raw) {
  const capacity = parseInt(raw.capacity, 10) || 0;
  const joined = parseInt(raw.joined, 10) || 0;
  return {
    id: String(raw.id || "").trim(),
    title: raw.title || "未命名活動",
    cover: raw.cover_image || "",
    area: raw.area || "",
    date: raw.date_text || "",
    price: raw.price || "",
    capacity,
    joined,
    isFull: capacity > 0 && joined >= capacity,
    itinerary: String(raw.itinerary || "")
      .split("||")
      .map(s => s.trim())
      .filter(Boolean),
    youtubeId: raw.youtube_id || "",
    igUrl: raw.ig_url || "",
    organizerName: raw.organizer_name || "主辦人",
    organizerLineUrl: raw.organizer_line_url || "",
    groupUrl: raw.group_url || "",
    waitlistUrl: raw.waitlist_url || "",
  };
}

async function getActivityById(id) {
  const list = await fetchActivities();
  return list.find(a => a.id === id);
}

/* ============================================================
   Flex Message 產生器
   ============================================================ */
function detailUrl(activity) {
  return `${CONFIG.SITE_URL}/detail.html?id=${encodeURIComponent(activity.id)}`;
}

function buildBubble(activity) {
  const statusText = activity.isFull ? `候補中・已報名 ${activity.joined}/${activity.capacity}` : `尚可報名・${activity.joined}/${activity.capacity} 人`;
  return {
    type: "bubble",
    hero: activity.cover ? {
      type: "image",
      url: activity.cover,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    } : undefined,
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: activity.title, weight: "bold", size: "lg", wrap: true },
        { type: "text", text: `${activity.area}｜${activity.date}`, size: "sm", color: "#8a8a8a", wrap: true },
        { type: "text", text: activity.price ? `NT$ ${activity.price}` : "", size: "md", color: "#2F7A72", weight: "bold" },
        { type: "separator", margin: "md" },
        { type: "text", text: statusText, size: "xs", color: activity.isFull ? "#D8572A" : "#2F7A72", margin: "md" },
      ].filter(c => c.text !== ""),
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#17233D",
          height: "sm",
          action: { type: "uri", label: "活動詳情", uri: detailUrl(activity) },
        },
      ],
    },
  };
}

/* ============================================================
   LIFF 分享
   ============================================================ */
async function ensureLiff() {
  if (!window.liff) return false;
  try {
    await liff.init({ liffId: CONFIG.LIFF_ID });
    return true;
  } catch (e) {
    console.error("LIFF init failed", e);
    return false;
  }
}

// 分享單一活動
async function shareOne(activity) {
  const ok = await ensureLiff();
  if (!ok || !liff.isApiAvailable("shareTargetPicker")) {
    alert("目前環境不支援 LINE 分享，請改用複製連結。");
    copyLink(detailUrl(activity));
    return;
  }
  try {
    const res = await liff.shareTargetPicker([
      {
        type: "flex",
        altText: `【推薦行程】${activity.title}`,
        contents: buildBubble(activity),
      },
    ]);
    if (res) console.log("分享成功", res.status);
  } catch (e) {
    console.error(e);
  }
}

// 分享多個活動（每個活動各自一則 flex 訊息，最多 MAX_SHARE_ITEMS 則）
async function shareMany(activities) {
  const list = activities.slice(0, CONFIG.MAX_SHARE_ITEMS);
  const ok = await ensureLiff();
  if (!ok || !liff.isApiAvailable("shareTargetPicker")) {
    alert("目前環境不支援 LINE 分享，請改用複製連結。");
    return;
  }
  const messages = list.map(a => ({
    type: "flex",
    altText: `【推薦行程】${a.title}`,
    contents: buildBubble(a),
  }));
  try {
    const res = await liff.shareTargetPicker(messages);
    if (res) console.log("分享成功", res.status);
  } catch (e) {
    console.error(e);
  }
}

function copyLink(url) {
  navigator.clipboard?.writeText(url).then(
    () => alert("已複製連結：\n" + url),
    () => prompt("請手動複製連結：", url)
  );
}
