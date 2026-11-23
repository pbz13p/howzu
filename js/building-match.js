// 楼盘匹配：判断一个房源地址是不是在某栋楼里（同一条街 + 门牌号在楼的号段内）。浏览器和 node 共用。
// 楼的号段来自墨尔本市政府 CLUE 地址，如 "68-82 Southbank Boulevard SOUTHBANK VIC 3006" → { from: 68, to: 82, street: "southbank boulevard" }。
// 房源地址如 "2110/138 Spencer St, Melbourne VIC 3000" → { num: 138, street: "spencer street" }。
(function (root) {
  const SUF = { st: "street", street: "street", ave: "avenue", av: "avenue", avenue: "avenue", blvd: "boulevard", bvd: "boulevard", boulevard: "boulevard",
    rd: "road", road: "road", pl: "place", place: "place", ln: "lane", lane: "lane", esp: "esplanade", esplanade: "esplanade", pde: "parade", parade: "parade",
    dr: "drive", drive: "drive", cres: "crescent", crescent: "crescent", quay: "quay", way: "way", walk: "walk", sq: "square", square: "square", hwy: "highway", highway: "highway", cl: "close", close: "close", ct: "court", court: "court" };
  const SUFRE = Object.keys(SUF).join("|");
  const normStreet = (name, suf) => (String(name).toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ").trim() + " " + SUF[String(suf).toLowerCase()]).trim();
  // 楼：CLUE 地址里第一段“号段 + 街名 + 街类型”
  function parseBuilding(addr) {
    const m = new RegExp(`(\\d+)[A-Z]?(?:\\s*-\\s*(\\d+)[A-Z]?)?\\s+([A-Za-z'’ ]+?)\\s+(${SUFRE})\\b`, "i").exec(String(addr || ""));
    if (!m) return null;
    const from = +m[1], to = m[2] ? +m[2] : from;
    return { from: Math.min(from, to), to: Math.max(from, to), street: normStreet(m[3], m[4]) };
  }
  // 房源：去掉 "单元号/" 后的门牌号 + 街名
  function parseListing(addr) {
    const s = String(addr || "").split(",")[0].replace(/^.*\//, "");
    const m = new RegExp(`^\\s*(\\d+)[A-Z]?\\s+([A-Za-z'’ ]+?)\\s+(${SUFRE})\\.?\\s*$`, "i").exec(s);
    return m ? { num: +m[1], street: normStreet(m[2], m[3]) } : null;
  }
  function inBuilding(listingAddr, b) {
    const L = parseListing(listingAddr); if (!L || !b) return false;
    return L.street === b.street && L.num >= b.from && L.num <= b.to;
  }
  // 订阅里存的楼址键："68-82|southbank boulevard"
  const key = b => b ? `${b.from}-${b.to}|${b.street}` : "";
  function fromKey(k) { const m = /^(\d+)-(\d+)\|(.+)$/.exec(String(k || "")); return m ? { from: +m[1], to: +m[2], street: m[3] } : null; }
  const api = { parseBuilding, parseListing, inBuilding, key, fromKey };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BuildingMatch = api;
})(typeof window !== "undefined" ? window : this);
