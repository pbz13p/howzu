// 运行：node tools/test-nearby.js（由 test-data.js 调用）
const N = require("../js/nearby.js");
let fail = 0; const ok = (c, m) => { if (c) console.log("  ✓ " + m); else { console.log("  ✗ " + m); fail++; } };
console.log("周边 js/nearby.js");
const pt = { lat: -37.8183, lng: 144.9525 }; // Southern Cross 附近
const E = [
  { type: "node", lat: -37.8184, lon: 144.9527, tags: { railway: "station", name: "Southern Cross Railway Station" } },
  { type: "node", lat: -37.8100, lon: 144.9630, tags: { railway: "station", name: "Flagstaff" } },
  { type: "node", lat: -37.8150, lon: 144.9600, tags: { railway: "station", station: "subway", name: "Town Hall (地铁)" } },
  { type: "node", lat: -37.8170, lon: 144.9540, tags: { railway: "tram_stop", name: "Spencer St/Collins St" } },
  { type: "way", center: { lat: -37.8160, lon: 144.9530 }, tags: { shop: "supermarket", brand: "Coles" } },
  { type: "node", lat: -37.8190, lon: 144.9520, tags: { amenity: "cafe", name: "咖啡" } },
];
const R = N.nearest(pt, E);
ok(R.map(r => r.k).join() === "train,tram,shop", "三类各取一个，顺序固定");
ok(R[0].name === "Southern Cross Station" && R[0].m < 50, "最近火车站选对，名称去掉 Railway");
ok(R[2].name === "Coles" && R[2].lat === -37.816, "way 用中心点，没名字用品牌");
ok(N.nearest(pt, []).length === 0 && N.nearest(pt, null).length === 0, "没数据就不显示");
ok(N.walkMin(0) === 1 && N.walkMin(1) === 16, "步行分钟：最少 1 分钟，1 公里约 16 分钟");
ok(N.fmtDist(234) === "230 米" && N.fmtDist(1530) === "1.5 公里", "距离文字");
ok(/around:1500,-37.81830,144.95250/.test(N.query(pt)) && /shop=supermarket/.test(N.query(pt)), "Overpass 查询带坐标");
if (fail) { console.log(`✗ nearby ${fail} 项失败`); process.exit(1); } else console.log("✓ nearby 全部通过");
