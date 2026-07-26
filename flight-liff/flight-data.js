/* FLIGHT_DATA_VERSION: 20260726-9 */
const FLIGHT_DATA_VERSION = "20260726-9";

// 目前先寫死指向這次的活動，不透過網址參數帶入，activityId 之後如果要做成通用系統
// （支援多個不同活動各自登記機票）再改回從網址讀取。
const FIXED_ACTIVITY_ID = "trip002";
const FIXED_ACTIVITY_TITLE = "澎湖四日遊(跳島吉貝嶼.桶盤嶼.虎井嶼)";

/* ============================================================
   固定班表資料（寫死，非即時查詢）
   松山(TSA) <-> 澎湖(MZG)，立榮 UNI AIR／華信 Mandarin Airlines
   班表異動時直接改這個檔案即可，不需要動其他程式碼。
   ============================================================ */
const AIRLINES = {
  uni: { key: "uni", label: "立榮 UNI AIR" },
  mandarin: { key: "mandarin", label: "華信 Mandarin" },
};

// go：松山 -> 澎湖（去程）／ return：澎湖 -> 松山（回程）
const FLIGHT_SCHEDULE = {
  go: {
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
  return: {
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
};

const DIRECTION_LABEL = { go: "去程（松山 → 澎湖）", return: "回程（澎湖 → 松山）" };

// 去程/回程預設日期，表單開啟時自動帶入，使用者仍可自行點日期選擇器改成別的日期
// （例如提前一天抵達、延後一天離開），活動日期異動時直接改這裡即可。
const DEFAULT_DATES = { go: "2026-09-25", return: "2026-09-28" };

// 找出某方向/航空公司/航班編號對應的班表資料（編輯既有登記時，用來回填下拉選單）
function findFlightOption(direction, airline, flightNo) {
  const list = (FLIGHT_SCHEDULE[direction] && FLIGHT_SCHEDULE[direction][airline]) || [];
  return list.find(f => f.flightNo === flightNo) || null;
}

// 產生 <select> 的 value，格式：airline|flightNo|dep|arr
function flightOptionValue(airline, f) {
  return [airline, f.flightNo, f.dep, f.arr].join("|");
}

function parseFlightOptionValue(value) {
  if (!value) return null;
  const [airline, flightNo, dep, arr] = value.split("|");
  return { airline, flightNo, dep, arr };
}
