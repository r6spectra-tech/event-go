/* FLIGHT_DATA_VERSION: 20260728-2 */
const FLIGHT_DATA_VERSION = "20260728-2";

// 目前先寫死指向這次的活動，不透過網址參數帶入，activityId 之後如果要做成通用系統
// （支援多個不同活動各自登記機票）再改回從網址讀取。
const FIXED_ACTIVITY_ID = "trip002";
const FIXED_ACTIVITY_TITLE = "澎湖四日遊(跳島吉貝嶼.桶盤嶼.虎井嶼)";

/* ============================================================
   固定班表資料（寫死，非即時查詢）
   目的地固定澎湖(MZG)，出發地（去程）／抵達地（回程）可選：松山／台中／高雄／台南
   班表異動時直接改這個檔案即可，不需要動其他程式碼。
   每個機場的航班下拉選單最後都固定有「其他（自行輸入）」選項，遇到查表以外的航班
   （例如中秋連假加班機）直接選這個手動填即可，不用等資料補齊。
   ============================================================ */
const AIRLINES = {
  uni: { key: "uni", label: "立榮 UNI AIR" },
  mandarin: { key: "mandarin", label: "華信 Mandarin" },
  bailey: { key: "bailey", label: "百麗航運（船）" },
  penghulun: { key: "penghulun", label: "澎湖輪（船）" },
};

const AIRPORTS = {
  tsa: { key: "tsa", label: "松山 (TSA)" },
  rmq: { key: "rmq", label: "台中 (RMQ)" },
  khh: { key: "khh", label: "高雄 (KHH)" },
  tnn: { key: "tnn", label: "台南 (TNN)" },
  khhport: { key: "khhport", label: "高雄港（船）" },
  budai: { key: "budai", label: "嘉義布袋港（船）" },
};
const DEFAULT_AIRPORT = "tsa";

// go：（松山／台中／高雄／台南） -> 澎湖（去程）／ return：澎湖 -> （松山／台中／高雄／台南）（回程）
const FLIGHT_SCHEDULE = {
  go: {
    tsa: {
      uni: [
        { flightNo: "B7-8601", dep: "07:15", arr: "08:05" },
        { flightNo: "B7-8605", dep: "08:05", arr: "09:05" },
        { flightNo: "B7-8609", dep: "10:35", arr: "11:25" },
        { flightNo: "B7-8615", dep: "11:20", arr: "12:20" },
        { flightNo: "B7-8617", dep: "13:55", arr: "14:45" },
        { flightNo: "B7-9119", dep: "15:30", arr: "16:20" },
        { flightNo: "B7-8621", dep: "16:20", arr: "17:20" },
        { flightNo: "B7-8619", dep: "17:30", arr: "18:30" },
      ],
      mandarin: [
        { flightNo: "AE361", dep: "07:00", arr: "08:00" },
        { flightNo: "AE365", dep: "08:00", arr: "09:00" },
        { flightNo: "AE367", dep: "10:55", arr: "11:55" },
        { flightNo: "AE369", dep: "11:30", arr: "12:30" },
        { flightNo: "AE371", dep: "13:45", arr: "14:45" },
        { flightNo: "AE2371", dep: "14:00", arr: "15:00" },
        { flightNo: "AE373", dep: "15:10", arr: "16:10" },
        { flightNo: "AE375", dep: "16:00", arr: "17:00" },
        { flightNo: "AE2375", dep: "17:20", arr: "18:20" },
        { flightNo: "AE377", dep: "18:40", arr: "19:40" },
        { flightNo: "AE385", dep: "19:50", arr: "20:50" },
      ],
    },
    rmq: {
      uni: [
        { flightNo: "B7-8635", dep: "08:20", arr: "09:05" },
        { flightNo: "B7-8637", dep: "10:25", arr: "11:10" },
        { flightNo: "B7-8639", dep: "14:40", arr: "15:25" },
        { flightNo: "B7-8655", dep: "18:30", arr: "19:15" },
      ],
      mandarin: [
        { flightNo: "AE781", dep: "07:30", arr: "08:15" },
        { flightNo: "AE783", dep: "08:30", arr: "09:15" },
        { flightNo: "AE785", dep: "10:45", arr: "11:30" },
        { flightNo: "AE787", dep: "13:30", arr: "14:15" },
        { flightNo: "AE789", dep: "14:50", arr: "15:35" },
        { flightNo: "AE791", dep: "16:05", arr: "16:50" },
        { flightNo: "AE793", dep: "16:55", arr: "17:40" },
        { flightNo: "AE797", dep: "19:00", arr: "19:45" },
      ],
    },
    khh: {
      uni: [
        { flightNo: "B7-8689", dep: "07:00", arr: "07:45" },
        { flightNo: "B7-8691", dep: "07:25", arr: "08:10" },
        { flightNo: "B7-8695", dep: "09:30", arr: "10:15" },
        { flightNo: "B7-8701", dep: "12:25", arr: "13:10" },
        { flightNo: "B7-8705", dep: "13:30", arr: "14:15" },
        { flightNo: "B7-8707", dep: "15:25", arr: "16:10" },
        { flightNo: "B7-8709", dep: "18:00", arr: "18:45" },
        { flightNo: "B7-8715", dep: "19:15", arr: "20:00" },
        { flightNo: "B7-8717", dep: "20:40", arr: "21:25" },
      ],
      mandarin: [
        { flightNo: "AE331", dep: "07:35", arr: "08:20" },
        { flightNo: "AE333", dep: "08:45", arr: "09:30" },
        { flightNo: "AE335", dep: "10:35", arr: "11:20" },
        { flightNo: "AE339", dep: "13:40", arr: "14:25" },
        { flightNo: "AE343", dep: "16:10", arr: "16:55" },
        { flightNo: "AE345", dep: "17:10", arr: "17:55" },
        { flightNo: "AE357", dep: "18:50", arr: "19:35" },
      ],
    },
    khhport: {
      // 澎湖輪每天出發時間不固定（不是每天重複的班表），沒辦法完整放進固定選單，
      // 這裡先內建最常用的夜航班次，其他日期/時段選「其他（自行輸入）」自己填
      penghulun: [
        { flightNo: "-", dep: "23:30", arr: "06:00" },
      ],
    },
    tnn: {
      uni: [
        { flightNo: "B7-8675", dep: "07:20", arr: "07:50" },
        { flightNo: "B7-8681", dep: "15:00", arr: "15:30" },
        { flightNo: "B7-8683", dep: "18:05", arr: "18:35" },
      ],
      mandarin: [],
    },
    budai: {
      // 百麗航運，布袋 -> 馬公（澎湖），船班沒有「航班編號」，flightNo 統一用 "-" 表示
      bailey: [
        { flightNo: "-", dep: "07:30", arr: "08:45" },
        { flightNo: "-", dep: "08:00", arr: "09:15" },
        { flightNo: "-", dep: "10:30", arr: "11:45" },
        { flightNo: "-", dep: "11:00", arr: "12:15" },
      ],
    },
  },
  return: {
    tsa: {
      uni: [
        { flightNo: "B7-8602", dep: "08:55", arr: "09:45" },
        { flightNo: "B7-8608", dep: "09:50", arr: "10:45" },
        { flightNo: "B7-8610", dep: "12:15", arr: "13:05" },
        { flightNo: "B7-8616", dep: "13:00", arr: "13:55" },
        { flightNo: "B7-8622", dep: "15:35", arr: "16:25" },
        { flightNo: "B7-8618", dep: "18:05", arr: "19:00" },
        { flightNo: "B7-8620", dep: "19:20", arr: "20:15" },
        { flightNo: "B7-9120", dep: "20:50", arr: "21:40" },
      ],
      mandarin: [
        { flightNo: "AE362", dep: "08:40", arr: "09:35" },
        { flightNo: "AE366", dep: "09:40", arr: "10:35" },
        { flightNo: "AE368", dep: "12:50", arr: "13:45" },
        { flightNo: "AE370", dep: "13:30", arr: "14:25" },
        { flightNo: "AE372", dep: "15:20", arr: "16:15" },
        { flightNo: "AE2372", dep: "15:40", arr: "16:35" },
        { flightNo: "AE374", dep: "16:50", arr: "17:45" },
        { flightNo: "AE376", dep: "17:40", arr: "18:35" },
        { flightNo: "AE2376", dep: "19:00", arr: "19:55" },
        { flightNo: "AE378", dep: "20:20", arr: "21:15" },
        { flightNo: "AE386", dep: "21:20", arr: "22:15" },
      ],
    },
    rmq: {
      uni: [
        { flightNo: "B7-8636", dep: "09:45", arr: "10:25" },
        { flightNo: "B7-8638", dep: "11:55", arr: "12:35" },
        { flightNo: "B7-8652", dep: "16:05", arr: "16:45" },
        { flightNo: "B7-8640", dep: "19:55", arr: "20:35" },
      ],
      mandarin: [
        { flightNo: "AE782", dep: "08:50", arr: "09:30" },
        { flightNo: "AE784", dep: "09:50", arr: "10:30" },
        { flightNo: "AE786", dep: "12:15", arr: "12:55" },
        { flightNo: "AE788", dep: "14:50", arr: "15:30" },
        { flightNo: "AE790", dep: "16:20", arr: "17:00" },
        { flightNo: "AE792", dep: "17:35", arr: "18:15" },
        { flightNo: "AE794", dep: "18:20", arr: "19:00" },
        { flightNo: "AE798", dep: "20:25", arr: "21:05" },
      ],
    },
    khh: {
      uni: [
        { flightNo: "B7-8690", dep: "08:20", arr: "09:00" },
        { flightNo: "B7-9162", dep: "08:45", arr: "09:25" },
        { flightNo: "B7-8692", dep: "09:15", arr: "09:55" },
        { flightNo: "B7-8696", dep: "11:00", arr: "11:40" },
        { flightNo: "B7-8698", dep: "13:05", arr: "13:45" },
        { flightNo: "B7-8702", dep: "16:15", arr: "16:55" },
        { flightNo: "B7-9172", dep: "17:10", arr: "17:50" },
        { flightNo: "B7-8712", dep: "17:40", arr: "18:20" },
        { flightNo: "B7-8710", dep: "19:10", arr: "19:50" },
        { flightNo: "B7-8716", dep: "20:00", arr: "20:40" },
        { flightNo: "B7-8718", dep: "20:30", arr: "21:10" },
      ],
      mandarin: [
        { flightNo: "AE332", dep: "09:00", arr: "09:40" },
        { flightNo: "AE334", dep: "10:00", arr: "10:40" },
        { flightNo: "AE336", dep: "12:00", arr: "12:40" },
        { flightNo: "AE338", dep: "13:10", arr: "13:50" },
        { flightNo: "AE340", dep: "15:00", arr: "15:40" },
        { flightNo: "AE342", dep: "16:00", arr: "16:40" },
        { flightNo: "AE344", dep: "17:30", arr: "18:10" },
        { flightNo: "AE346", dep: "18:50", arr: "19:30" },
      ],
    },
    khhport: {
      // 澎湖輪回程一樣每天出發時間不固定，先內建最常用的下午班次，其他選「其他（自行輸入）」
      penghulun: [
        { flightNo: "-", dep: "16:00", arr: "21:00" },
      ],
    },
    tnn: {
      uni: [
        { flightNo: "B7-8676", dep: "08:30", arr: "09:05" },
        { flightNo: "B7-8680", dep: "13:50", arr: "14:25" },
        { flightNo: "B7-8682", dep: "16:50", arr: "17:25" },
      ],
      mandarin: [],
    },
    budai: {
      // 百麗航運，馬公（澎湖）-> 布袋
      bailey: [
        { flightNo: "-", dep: "13:00", arr: "14:15" },
        { flightNo: "-", dep: "16:15", arr: "17:30" },
        { flightNo: "-", dep: "16:45", arr: "18:00" },
      ],
    },
  },
};

const DIRECTION_LABEL = { go: "去程（→ 澎湖）", return: "回程（澎湖 →）" };

// 去程/回程預設日期，表單開啟時自動帶入，使用者仍可自行點日期選擇器改成別的日期
// （例如提前一天抵達、延後一天離開），活動日期異動時直接改這裡即可。
const DEFAULT_DATES = { go: "2026-09-25", return: "2026-09-28" };

// 找出某方向/機場/航空公司/航班編號對應的班表資料（編輯既有登記時，用來回填下拉選單）
function findFlightOption(direction, airport, airline, flightNo) {
  const list = (FLIGHT_SCHEDULE[direction] && FLIGHT_SCHEDULE[direction][airport] && FLIGHT_SCHEDULE[direction][airport][airline]) || [];
  return list.find(f => f.flightNo === flightNo) || null;
}

// 編輯既有登記時，不知道原本選的是哪個機場，掃過每個機場找出符合的那一筆；
// 找不到就代表當初是「其他（自行輸入）」，回傳 null。
function findAirportForFlight(direction, airline, flightNo) {
  for (const airportKey of Object.keys(AIRPORTS)) {
    const list = (FLIGHT_SCHEDULE[direction][airportKey] && FLIGHT_SCHEDULE[direction][airportKey][airline]) || [];
    if (list.some(f => f.flightNo === flightNo)) return airportKey;
  }
  return null;
}

// 產生 <select> 的 value，格式：airline|flightNo|dep|arr
function flightOptionValue(airline, f) {
  return [airline, f.flightNo, f.dep, f.arr].join("|");
}

function parseFlightOptionValue(value) {
  if (!value || value === "manual") return null;
  const [airline, flightNo, dep, arr] = value.split("|");
  return { airline, flightNo, dep, arr };
}
