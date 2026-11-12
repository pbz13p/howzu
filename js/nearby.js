// 周边：把 OpenStreetMap（Overpass）返回的地点整理成"最近的火车站 / 电车站 / 超市"。纯函数，Node 也能测。
(function (root) {
  const CATS = [
    { k: "train", icon: "🚆", label: "火车站", color: "#1c4e80", test: t => t.railway === "station" && t.station !== "subway" && !/tram/i.test(t.station || "") },
    { k: "tram", icon: "🚋", label: "电车站", color: "#0f6b4f", test: t => t.railway === "tram_stop" || t.public_transport === "stop_position" && t.tram === "yes" },
    { k: "shop", icon: "🛒", label: "超市", color: "#b4602a", test: t => t.shop === "supermarket" },
  ];
  function km(a, b) {
    const r = Math.PI / 180, R = 6371;
    const x = (b.lng - a.lng) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r;
    return Math.sqrt(x * x + y * y) * R;
  }
  // 步行分钟：直线 × 1.3 绕路系数，每小时 4.8 公里，至少 1 分钟
  const walkMin = d => Math.max(1, Math.round(d * 1.3 / 4.8 * 60));
  function query(pt) {
    const a = (m) => `(around:${m},${pt.lat.toFixed(5)},${pt.lng.toFixed(5)})`;
    return `[out:json][timeout:12];(node${a(1500)}[railway=station];node${a(700)}[railway=tram_stop];nwr${a(1200)}[shop=supermarket];);out center 80;`;
  }
  // elements：Overpass 结果；返回每类最近的一个 [{k,icon,label,name,lat,lng,m,min}]
  function nearest(pt, elements) {
    const out = [];
    for (const c of CATS) {
      let best = null;
      for (const e of elements || []) {
        const t = e.tags || {}, lat = e.lat ?? (e.center && e.center.lat), lng = e.lon ?? (e.center && e.center.lon);
        if (lat == null || lng == null || !c.test(t)) continue;
        const d = km(pt, { lat, lng });
        if (!best || d < best.d) best = { d, lat, lng, name: t["name:zh"] || t.name || t.brand || c.label };
      }
      if (best) out.push({ k: c.k, icon: c.icon, label: c.label, color: c.color, name: String(best.name).replace(/\s+Railway Station$/i, " Station"), lat: best.lat, lng: best.lng, m: Math.round(best.d * 1000), min: walkMin(best.d) });
    }
    return out;
  }
  const fmtDist = m => m < 1000 ? `${Math.round(m / 10) * 10} 米` : `${(m / 1000).toFixed(1)} 公里`;
  const api = { CATS, km, walkMin, query, nearest, fmtDist };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HowzuNearby = api;
})(typeof window !== "undefined" ? window : this);
