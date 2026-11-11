// 通勤估算：用直线距离粗估到 CBD / 墨大 / RMIT / 莫纳什 Clayton 要多久。
// 纯函数（浏览器 window.HowzuCommute，Node require 都能用）。只是估算，页面上要写明。
(function (root) {
  const PLACES = [
    { k: "cbd", name: "CBD", sub: "Bourke St Mall", lat: -37.8136, lng: 144.9631 },
    { k: "um", name: "墨大", sub: "Parkville", lat: -37.7983, lng: 144.961 },
    { k: "rmit", name: "RMIT", sub: "City 校区", lat: -37.8083, lng: 144.9631 },
    { k: "monash", name: "莫纳什", sub: "Clayton", lat: -37.9105, lng: 145.134 },
  ];
  function km(a, b) {
    const R = 6371, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  // 步行：直线 ×1.3 绕路，4.8 km/h。1.2 km 以内按步行算。
  // 公共交通：等车+走到站约 10 分钟，再每公里约 2.6 分钟（墨尔本电车/火车+换乘的经验值），取 5 分钟整。
  function est(d) {
    if (d < 1.2) return { mode: "walk", min: Math.max(1, Math.round((d * 1.3) / 4.8 * 60)) };
    return { mode: "pt", min: Math.max(15, Math.round((10 + d * 2.6) / 5) * 5) };
  }
  function label(e) { return (e.mode === "walk" ? "步行约 " : "公交约 ") + e.min + " 分钟"; }
  function fmtKm(d) { return d < 10 ? d.toFixed(1) + " km" : Math.round(d) + " km"; }
  function rows(pt) {
    if (!pt || !isFinite(pt.lat) || !isFinite(pt.lng)) return [];
    // 只接受墨尔本大致范围内的坐标，防止地址解析错到别的州
    if (pt.lat > -37.3 || pt.lat < -38.6 || pt.lng < 144.3 || pt.lng > 145.8) return [];
    return PLACES.map(p => { const d = km(pt, p), e = est(d); return { k: p.k, name: p.name, sub: p.sub, km: fmtKm(d), mode: e.mode, min: e.min, text: label(e) }; });
  }
  // 对口公立学校：点落在哪个校区多边形里（GeoJSON Polygon / MultiPolygon，奇偶规则，洞也算对）
  function inRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function inFeature(f, x, y) {
    const g = f.geometry; if (!g) return false;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    return polys.some(p => p.reduce((acc, ring) => (inRing(x, y, ring) ? !acc : acc), false));
  }
  // 返回不重复的学校名（同一学校多个年级的校区只算一次；Year 7 的排前面）
  function zonesAt(fc, pt) {
    if (!fc || !fc.features || !pt) return [];
    const hit = fc.features.filter(f => inFeature(f, pt.lng, pt.lat));
    hit.sort((a, b) => (a.properties.yl === "7" ? 0 : 1) - (b.properties.yl === "7" ? 0 : 1));
    const seen = new Set(), out = [];
    hit.forEach(f => { const n = f.properties.name; if (!seen.has(n)) { seen.add(n); out.push({ no: f.properties.no, name: n }); } });
    return out;
  }
  const api = { PLACES, km, est, label, fmtKm, rows, inFeature, zonesAt };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HowzuCommute = api;
})(typeof window !== "undefined" ? window : this);
