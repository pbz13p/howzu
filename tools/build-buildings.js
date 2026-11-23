// 楼盘百科：从公开数据生成 /building/<楼名>.html 和总目录 /building/index.html（静态 HTML，不开 JS 也能看全部内容）。
// 数据：墨尔本市政府 CLUE 2024 普查（楼名、地址、建成年份、层数、套数，CC BY 4.0）、DFFH 租金报告（CC BY 4.0）、OpenStreetMap（ODbL）。
// 第一批只做 30 栋：住宅套数最多、有具体楼名的（去掉学生公寓和“Tower 4”这类没有区分度的名字）。等收录数据出来再扩。
// 同时：区域页（CBD、Southbank）加“本区楼盘”入口、首页导航入口、sitemap、llms.txt。重复运行结果不变。
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const RV = require("../js/rent-vs.js"), BM = require("../js/building-match.js"), LP = require("../js/listing-page.js");
const FIRST = 30, SITE = "https://howzu.com.au", TODAY = "2026-11-24";
const J = f => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const CLUE = J("data/clue_buildings.json"), OSM = J("data/osm_pois.json"), RC = J("data/rent_check.json");
const LJ = J("data/listings.json"), LIST = Array.isArray(LJ) ? LJ : LJ.listings || [];
const C = RV.compact(RC);
const e = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// 只有在公开来源查得到的中文名才写，附来源；查不到就不写
// 人工核对的楼名、中文名、合并的楼栋都在 data/building_names.json（键 = CLUE property_id，每条带公开来源）
const NM = J("data/building_names.json"), ZH = {};
// CBD 环线等车站：OSM 下载里缺了这几个，用公开坐标补（直线距离估算，足够）
const EXTRA_ST = [["Southern Cross", -37.8183, 144.9525], ["Melbourne Central", -37.8100, 144.9628], ["Flagstaff", -37.8119, 144.9561], ["Parliament", -37.8110, 144.9730]];
const UNIS = [["墨尔本大学（Parkville 主校区）", -37.7964, 144.9612], ["RMIT（城市校区）", -37.8083, 144.9631]];
const AREA = { "Melbourne (CBD)": ["墨尔本 CBD", "Melbourne"], "Melbourne (Remainder)": ["墨尔本", "Melbourne"], "Southbank": ["Southbank", "Southbank"], "Docklands": ["Docklands", "Docklands"],
  "Carlton": ["Carlton", "Carlton"], "West Melbourne (Residential)": ["West Melbourne", "West Melbourne"], "North Melbourne": ["North Melbourne", "North Melbourne"],
  "East Melbourne": ["East Melbourne", "East Melbourne"], "Parkville": ["Parkville", "Parkville"], "Kensington": ["Kensington", "Kensington"] };
const AREA_PAGE = { Melbourne: "/guide/area-melbourne-cbd.html", Southbank: "/guide/area-southbank.html", Docklands: "/guide/area-docklands.html", Carlton: "/guide/area-carlton.html", "North Melbourne": "/guide/area-north-melbourne.html", Parkville: "/guide/area-parkville.html" };

const R = 6371000, rad = d => d * Math.PI / 180;
const dist = (a, b, c, d) => { const x = rad(c - a), y = rad(d - b), h = Math.sin(x / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const walk = m => Math.max(1, Math.round(m * 1.3 / 80)); // 直线 ×1.3 当路程，每分钟 80 米
const km = m => m < 1000 ? `${Math.round(m / 10) * 10} 米` : `${(m / 1000).toFixed(1)} 公里`;
const POIS = OSM.pois.concat(EXTRA_ST.filter(([n]) => !OSM.pois.some(p => p.k === "station" && p.n === n)).map(([n, lat, lon]) => ({ k: "station", n, lat, lon })));
function nearest(b, k) { let best = null; for (const p of POIS) if (p.k === k) { const d = dist(b.lat, b.lon, p.lat, p.lon); if (!best || d < best.d) best = { ...p, d }; } return best; }
const tramName = n => String(n || "").replace(/^Stop\s+\w+:\s*/i, "");

const slug = n => String(n).toLowerCase().replace(/['’]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const title = s => String(s).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\bMy80\b/, "MY80");
function street(addr) { // 地址里“号段 + 街名 + 区 + 邮编”，去掉前面重复的楼名
  const m = /(\d+[A-Z]?(?:\s*-\s*\d+[A-Z]?)?\s+[A-Za-z'’ ]+?)\s+([A-Z][A-Z ]+?)\s+VIC\s+(\d{4})\s*$/.exec(addr);
  return m ? { line: m[1].replace(/\s+/g, " ").trim(), suburb: title(m[2]), pc: m[3] } : { line: addr, suburb: "", pc: "" };
}

// 套数只算住宅公寓，学生公寓单独记（Aurora 这类楼两种都有）
const resid = b => Object.entries(b.dwelling_types || {}).filter(([k]) => !/student/i.test(k)).reduce((a, [, v]) => a + (+v || 0), 0) || b.dwellings;
// 套用人工核对的楼名；group 相同的几栋（如 West Side Place 三栋）合成一条，号段保留多个
const GRP = new Map(), BLDS = [];
for (const b0 of CLUE.buildings) {
  const o = NM[b0.property_id] || {}, b = { ...b0, name: o.group || o.name || b0.name, built: o.built || b0.built, dwellings: resid(b0), student: b0.dwellings - resid(b0), notes: o.note ? [o.note] : [], srcs: o.url ? [[o.src, o.url]] : [], named: !!(o.group || o.name) };
  if (o.zh && b.name) ZH[b.name] = { zh: o.zh, src: o.src, url: o.url };
  if (!o.group) { BLDS.push(b); continue; }
  b.towers = [{ label: o.tower, address: b0.address, floors: b0.floors, dwellings: resid(b0) }];
  const g = GRP.get(o.group);
  if (!g) { GRP.set(o.group, b); BLDS.push(b); continue; }
  g.towers.push(b.towers[0]); g.built = [g.built, b.built].filter(Boolean).sort()[0] || null; g.dwellings += b.dwellings; g.student += b.student; g.floors = Math.max(g.floors || 0, b.floors || 0) || null;
  g.lat = (g.lat * (g.towers.length - 1) + b.lat) / g.towers.length; g.lon = (g.lon * (g.towers.length - 1) + b.lon) / g.towers.length;
  g.notes.push(...b.notes); g.srcs.push(...b.srcs.filter(x => !g.srcs.some(y => y[1] === x[1])));
}
// 第一批 30 栋
const ALL = BLDS.filter(b => b.name && b.use === "Residential Apartment" && (b.named || !/^Tower\s*\d|\bHotel\b/i.test(b.name)) && b.lat && b.lon);
ALL.sort((a, b) => b.dwellings - a.dwellings);
const seen = new Set(), PICK = [];
for (const b of ALL) { const s = slug(b.name); if (seen.has(s)) continue; seen.add(s); const ranges = (b.towers || [b]).map(t => BM.parseBuilding(t.address)).filter(Boolean);
  if (b.towers) b.towers.sort((x, y) => String(x.label).localeCompare(String(y.label)));
  PICK.push({ ...b, slug: s, addr: street(b.address), range: ranges[0] || null, ranges }); if (PICK.length >= FIRST) break; }

const live = LIST.filter(x => x.status === "live");
const rentRow = (sub, k) => { const i = C.s[RV.norm(sub)]; if (i == null) return null; const m = C.g[i][1][k]; return m && m[1] >= RV.MIN_N ? { med: m[0], n: m[1], group: C.g[i][0] } : null; };
const qText = q => { const m = /^(\d{4})-(\d{2})$/.exec(q || ""); return m ? `${m[1]} 年 ${+m[2]} 月` : ""; };

const CSS = `*{box-sizing:border-box}body{margin:0;background:#fff;color:#1d2321;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;line-height:1.75;-webkit-font-smoothing:antialiased}
a{color:#0f6b4f}.top{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;max-width:720px;margin:0 auto}.logo{font-weight:700;text-decoration:none;color:#0f6b4f}.top a.all{font-size:14px;color:#6b726f;text-decoration:none}
main{max-width:720px;margin:0 auto;padding:4px 20px 96px}.kick{font-size:13px;color:#0f6b4f;font-weight:600;margin:8px 0 6px}.kick a{text-decoration:none}h1{font-size:25px;line-height:1.3;margin:0 0 8px}.zh{font-size:15px;color:#4a524f;margin:0 0 10px}
.ans{background:#f3f8f5;border-radius:16px;padding:14px 16px;margin:0 0 22px;font-size:16px}h2{font-size:19px;margin:30px 0 8px}p,li{font-size:16px}
table{width:100%;border-collapse:collapse;font-size:15px}td,th{padding:9px 6px;border-bottom:1px solid #eef0ef;text-align:left;vertical-align:top}th{font-weight:600;color:#4a524f;width:38%}
.meta{font-size:13px;color:#8a908d;margin:6px 0 0}ul.dot{padding-left:20px;margin:8px 0}ul.dot li{margin:0 0 6px}.lst a{font-weight:600}
.cta{margin:28px 0 0;padding:18px;border-radius:16px;background:#0f6b4f;color:#fff}.cta h3{margin:0 0 6px;font-size:17px}.cta p{margin:0 0 12px;font-size:14px;opacity:.92}.cta a{display:block;text-align:center;text-decoration:none;font-weight:600;border-radius:12px;padding:11px;background:#fff;color:#0f6b4f;margin-top:8px}
.src{margin:32px 0 0;font-size:13px;color:#6b726f}.src h2{font-size:14px;margin:0 0 6px;color:#1d2321}.src li{font-size:13px}.src a{color:#6b726f;word-break:break-all}`;
const SCRIPTS = `<script src="/js/config.js?v=20261107"></script><script src="/js/track.js?v=20261124" defer></script><script src="/js/alert-sub.js?v=20261124" defer></script><script src="/js/contact-fab.js?v=20261117" defer></script>`;

function page(b, others) {
  const [areaZh, sub] = AREA[b.area] || [b.addr.suburb || b.area, b.addr.suburb];
  const tram = nearest(b, "tram"), st = nearest(b, "station"), sm = nearest(b, "supermarket");
  const unis = UNIS.map(([n, lat, lon]) => [n, dist(b.lat, b.lon, lat, lon)]);
  const r1 = rentRow(sub, "1 bedroom flat"), r2 = rentRow(sub, "2 bedroom flat"), q = qText(C.q);
  const zh = ZH[b.name];
  const yr = b.built ? `${b.built} 年建成` : "建成年份暂无公开记录";
  const inB = live.filter(x => b.ranges.some(r => BM.inBuilding(x.address, r)));
  const url = `${SITE}/building/${b.slug}.html`;
  const ans = `${e(b.name)}${zh ? `（${e(zh.zh)}）` : ""} 位于 ${e(areaZh)} ${e(b.addr.line)}${b.towers ? ` 等 ${b.towers.length} 栋，${e(yr)}，最高一栋 ${b.floors || "—"} 层，共 ${b.dwellings} 套住宅公寓。` : `，${e(yr)}，共 ${b.floors || "—"} 层、${b.dwellings} 套住宅公寓。`}` +
    (tram ? `步行到最近的电车站 ${e(tramName(tram.n))} 约 ${walk(tram.d)} 分钟` : "") + (st ? `，到 ${e(st.n)} 火车站约 ${walk(st.d)} 分钟` : "") + `（按直线距离估算）。` +
    (r1 || r2 ? `本区公寓周租中位数：${r1 ? `一房 $${r1.med}` : ""}${r1 && r2 ? "，" : ""}${r2 ? `两房 $${r2.med}` : ""}（DFFH，截至 ${e(q)}）。` : "");
  const desc = `${b.name} 租房：${yr}，${b.floors} 层 ${b.dwellings} 套，${b.addr.line}, ${b.addr.suburb}。本区一房、两房周租中位数，到电车站、火车站、超市、大学的距离，以及这栋楼的在租房源。`;
  const ld = [{ "@context": "https://schema.org", "@type": "ApartmentComplex", name: b.name, ...(zh ? { alternateName: zh.zh } : {}), url,
    address: { "@type": "PostalAddress", streetAddress: b.addr.line, addressLocality: b.addr.suburb, addressRegion: "VIC", postalCode: b.addr.pc, addressCountry: "AU" },
    geo: { "@type": "GeoCoordinates", latitude: +b.lat.toFixed(6), longitude: +b.lon.toFixed(6) }, numberOfAccommodationUnits: { "@type": "QuantitativeValue", value: b.dwellings } },
  { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "好租 Howzu", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "墨尔本楼盘百科", item: SITE + "/building/" },
    { "@type": "ListItem", position: 3, name: b.name, item: url }] }];
  const rentHtml = r1 || r2 ? `<table>${[["一房公寓", r1], ["两房公寓", r2]].filter(x => x[1]).map(([k, r]) => `<tr><th>${k}</th><td>$${r.med}/周 <span class="meta">（过去一年新租约 ${r.n} 套）</span></td></tr>`).join("")}</table>
<p class="meta">维州政府 DFFH 租金报告，${e((r1 || r2).group)} 区组，截至 ${e(q)} 的一年移动中位数。中位数包含新旧各种楼，这栋楼的实际租金会因楼层、朝向、装修、家具不同而不同，仅供参考。<a href="/rents.html">查各区租金 ›</a></p>`
    : `<p>这个区的公寓租金中位数样本不足，暂不显示。<a href="/rents.html">查各区租金 ›</a></p>`;
  const near = [tram && ["最近电车站", `${tramName(tram.n)} · 约 ${km(tram.d)}，步行约 ${walk(tram.d)} 分钟`], st && ["最近火车站", `${st.n} · 约 ${km(st.d)}，步行约 ${walk(st.d)} 分钟`],
    sm && ["最近超市", `${sm.n || "超市"} · 约 ${km(sm.d)}，步行约 ${walk(sm.d)} 分钟`], ...unis.map(([n, d]) => [n, `约 ${km(d)}${d < 2500 ? `，步行约 ${walk(d)} 分钟` : ""}`])].filter(Boolean);
  const lst = inB.length ? `<ul class="dot lst">${inB.map(x => `<li><a href="/rent/${e(x.id)}.html">${e(x.title)}</a>${x.rentWeekly ? ` · $${e(x.rentWeekly)}/周` : ""}${x.beds ? ` · ${e(x.beds)} 房` : ""}${x.available ? ` · ${e(LP.availText(x.available))}入住` : ""}</li>`).join("")}</ul>`
    : `<p>好租在这栋楼暂时没有在租房源。留个邮箱，这栋楼有新房上线第一时间通知你：</p>`;
  const card = `<div class="alert-sub" data-suburb="${e(sub)}" data-building="${e(b.name)}" data-bld="${e(b.ranges.map(BM.key).join(";"))}" data-max=""></div>
<noscript><p><a href="/rentals.html?la=${encodeURIComponent(sub)}#leadCard">留下需求，有新房通知你 ›</a></p></noscript>`;
  const oth = others.map(o => `<li><a href="/building/${o.slug}.html">${e(o.name)}</a> · ${e(o.addr.line)} · ${o.floors || "—"} 层 ${o.dwellings} 套</li>`).join("");
  const ap = AREA_PAGE[sub];
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(b.name)} 租房｜${e(yr)}、${b.floors} 层 ${b.dwellings} 套、租金和周边 | 好租 Howzu 楼盘百科</title>
<meta name="description" content="${e(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="好租 Howzu"><meta property="og:title" content="${e(b.name)} 租房｜墨尔本楼盘百科"><meta property="og:description" content="${e(desc)}"><meta property="og:url" content="${url}"><meta property="og:locale" content="zh_CN">
<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#0f6b4f">
${ld.map(x => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join("\n")}
<style>${CSS}</style>
</head>
<body>
<header class="top"><a class="logo" href="/">好租 Howzu</a><a class="all" href="/building/">全部楼盘 ›</a></header>
<main>
<div class="kick"><a href="/building/">墨尔本楼盘百科</a> · ${ap ? `<a href="${ap}">${e(areaZh)}</a>` : e(areaZh)}</div>
<h1>${e(b.name)} 租房</h1>
${zh ? `<p class="zh">中文常见叫法：${e(zh.zh)}（来源：<a href="${e(zh.url)}" rel="nofollow">${e(zh.src)}</a>）</p>` : ""}
<p class="ans">${ans}</p>
<h2>楼盘信息</h2>
<table>
<tr><th>地址</th><td>${b.towers ? b.towers.map(t => e(street(t.address).line)).join("<br>") : e(b.addr.line)}, ${e(b.addr.suburb)} VIC ${e(b.addr.pc)}</td></tr>
<tr><th>建成年份</th><td>${b.built ? e(b.built) + " 年" : "暂无公开记录"}</td></tr>
<tr><th>层数</th><td>${b.floors ? b.floors + " 层（地面以上）" : "—"}</td></tr>
<tr><th>住宅套数</th><td>${b.dwellings} 套${b.student ? `（另有学生公寓 ${b.student} 套）` : ""}</td></tr>
${b.towers ? `<tr><th>楼栋</th><td>${b.towers.map(t => `${e(t.label)}：${e(street(t.address).line)}，${t.floors || "—"} 层，${t.dwellings} 套`).join("<br>")}</td></tr>` : ""}</table>
${b.notes.length ? `<p class="meta">${b.notes.map(e).join(" ")}</p>` : ""}
<p class="meta">墨尔本市政府 CLUE ${e(CLUE.dwellings_year)} 普查数据。套数为普查时登记的住宅数，可能和开发商宣传的数字略有出入。</p>
<h2>本区公寓周租中位数</h2>
${rentHtml}
<h2>周边：交通、超市、大学</h2>
<table>${near.map(([k, v]) => `<tr><th>${e(k)}</th><td>${e(v)}</td></tr>`).join("")}</table>
<p class="meta">按 OpenStreetMap 坐标的直线距离估算，步行时间按直线 ×1.3、每分钟 80 米算，实际以地图为准。</p>
<h2>好租在 ${e(b.name)} 的房源</h2>
${lst}
${card}
<p><a href="/rentals.html">看全部在租房源 ›</a></p>
${oth ? `<h2>附近其他楼盘</h2><ul class="dot">${oth}</ul>` : ""}
<section class="cta"><h3>想租 ${e(b.name)} 或附近的房？</h3><p>好租房源全程中文、持牌管理、押金交政府 RTBA 托管、租客零中介费。</p><a href="/rentals.html#leadCard">留下需求，有房通知你</a></section>
<section class="src">
<h2>数据来源（${TODAY.slice(0, 4)} 年 ${+TODAY.slice(5, 7)} 月整理）</h2>
<ul>
<li>楼盘信息：City of Melbourne Open Data · CLUE ${e(CLUE.buildings_year)}（CC BY 4.0）：<a href="https://data.melbourne.vic.gov.au">data.melbourne.vic.gov.au</a></li>
<li>租金：Victorian Government DFFH Rental Report（CC BY 4.0）：<a href="https://www.dffh.vic.gov.au/publications/rental-report">www.dffh.vic.gov.au/publications/rental-report</a></li>
<li>位置和周边：© OpenStreetMap contributors（ODbL）：<a href="https://www.openstreetmap.org/copyright">www.openstreetmap.org/copyright</a></li>
${b.srcs.map(([t, u]) => `<li>${e(t)}：<a href="${e(u)}" rel="nofollow">${e(u.replace(/^https?:\/\//, ""))}</a></li>`).join("")}
</ul>
<p>好租与这栋楼的开发商、业委会和物业管理处没有关系。本页只是公开数据整理，不构成租房或投资建议。</p>
</section>
</main>
${SCRIPTS}
</body>
</html>
`;
}

let n = 0; const write = (rel, s) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== s) { fs.writeFileSync(f, s); n++; } };
for (const b of PICK) {
  const others = PICK.filter(o => o !== b).map(o => [o, dist(b.lat, b.lon, o.lat, o.lon)]).sort((x, y) => x[1] - y[1]).slice(0, 5).map(x => x[0]);
  write(`building/${b.slug}.html`, page(b, others));
}
// 旧页面（不在本批里的）删掉，避免留下薄页面
for (const f of fs.readdirSync(path.join(root, "building"))) if (f.endsWith(".html") && f !== "index.html" && !PICK.some(b => b.slug + ".html" === f)) { fs.unlinkSync(path.join(root, "building", f)); n++; }

// 总目录：静态表格（不开 JS 也能看），开 JS 可按楼名、街名搜索
const byArea = {}; for (const b of PICK) { const a = (AREA[b.area] || [b.area])[0]; (byArea[a] = byArea[a] || []).push(b); }
const rows = Object.keys(byArea).map(a => `<h2>${e(a)}</h2><table class="bt"><tr><th>楼盘</th><th>地址</th><th>建成 · 层 · 套</th></tr>${byArea[a].map(b => `<tr data-q="${e((b.name + " " + b.addr.line + " " + (ZH[b.name] ? ZH[b.name].zh : "")).toLowerCase())}"><td><a href="/building/${b.slug}.html">${e(b.name)}</a>${ZH[b.name] ? `<br><span class="meta">${e(ZH[b.name].zh)}</span>` : ""}</td><td>${e(b.addr.line)}</td><td>${b.built || "—"} · ${b.floors || "—"} 层 · ${b.dwellings} 套</td></tr>`).join("")}</table>`).join("\n");
const idxLd = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "好租 Howzu", item: SITE + "/" }, { "@type": "ListItem", position: 2, name: "墨尔本楼盘百科", item: SITE + "/building/" }] };
write("building/index.html", `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>墨尔本楼盘百科：CBD、Southbank、Docklands 公寓楼建成年份、层数、套数和租金 | 好租 Howzu</title>
<meta name="description" content="墨尔本 ${PICK.length} 栋大型公寓楼的中文资料：建成年份、层数、套数、所在街道、本区一房两房租金中位数、到电车站和大学的距离，以及好租在这些楼的在租房源。按楼名或街名搜索。">
<link rel="canonical" href="${SITE}/building/">
<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#0f6b4f">
<script type="application/ld+json">${JSON.stringify(idxLd)}</script>
<style>${CSS}
.q{width:100%;font:inherit;font-size:16px;padding:11px 12px;border:1px solid #cdd;border-radius:10px;margin:6px 0 4px}.bt td,.bt th{font-size:14px}.bt th{width:auto}</style>
</head>
<body>
<header class="top"><a class="logo" href="/">好租 Howzu</a><a class="all" href="/rentals.html">在租房源 ›</a></header>
<main>
<div class="kick">墨尔本楼盘百科</div>
<h1>墨尔本楼盘百科</h1>
<p class="ans">收录墨尔本 CBD、Southbank、Docklands 等区 ${PICK.length} 栋住宅套数最多的公寓楼：建成年份、层数、套数、地址，本区租金中位数，到电车站、超市、大学的距离，以及好租在楼里的在租房源。数据来自墨尔本市政府、维州政府和 OpenStreetMap 的公开数据。</p>
<input class="q" id="q" type="search" placeholder="搜楼名或街名，如 Australia 108、A'Beckett" aria-label="搜楼名或街名">
<p class="meta" id="qn"></p>
${rows}
<section class="cta"><h3>想租这些楼的房？</h3><p>告诉我们楼名、预算和入住时间，有合适的房第一时间通知你。</p><a href="/rentals.html#leadCard">留下需求</a></section>
<section class="src"><h2>数据来源</h2><ul><li>City of Melbourne Open Data · CLUE ${e(CLUE.buildings_year)}（CC BY 4.0）</li><li>Victorian Government DFFH Rental Report（CC BY 4.0）</li><li>© OpenStreetMap contributors（ODbL）</li></ul><p>好租与这些楼的开发商、业委会和物业管理处没有关系。</p></section>
</main>
<script>(function(){var q=document.getElementById("q"),n=document.getElementById("qn"),R=[].slice.call(document.querySelectorAll("tr[data-q]"));q.oninput=function(){var v=q.value.toLowerCase().replace(/['’]/g,"").trim(),c=0;R.forEach(function(r){var ok=!v||r.dataset.q.replace(/['’]/g,"").indexOf(v)>-1;r.style.display=ok?"":"none";if(ok)c++});document.querySelectorAll("table.bt").forEach(function(t){var any=[].some.call(t.querySelectorAll("tr[data-q]"),function(r){return r.style.display!=="none"});t.style.display=any?"":"none";t.previousElementSibling.style.display=any?"":"none"});n.textContent=v?("找到 "+c+" 栋"+(c?"":"。这栋楼还没收录，可以留下需求告诉我们。")):""}})();</script>
${SCRIPTS}
</body>
</html>
`);

// 入口：区域页（CBD、Southbank）加“本区楼盘”
const put = (rel, fn) => { const f = path.join(root, rel); if (!fs.existsSync(f)) return; const a = fs.readFileSync(f, "utf8"), b = fn(a); if (b !== a) { fs.writeFileSync(f, b); n++; } };
for (const [file, subs] of [["guide/area-melbourne-cbd.html", ["Melbourne"]], ["guide/area-southbank.html", ["Southbank"]], ["guide/area-docklands.html", ["Docklands"]], ["guide/area-carlton.html", ["Carlton"]]]) {
  const L = PICK.filter(b => subs.includes((AREA[b.area] || [])[1]));
  if (!L.length) continue;
  const blk = `<!--bld--><h2>本区大型公寓楼</h2><ul class="dot">${L.map(b => `<li><a href="/building/${b.slug}.html">${e(b.name)}</a> · ${e(b.addr.line)} · ${b.floors || "—"} 层 ${b.dwellings} 套</li>`).join("")}</ul><p><a href="/building/">墨尔本楼盘百科（全部 ${PICK.length} 栋）›</a></p><!--/bld-->\n`;
  put(file, s => s.includes("<!--bld-->") ? s.replace(/<!--bld-->[\s\S]*?<!--\/bld-->\n?/, blk) : s.replace("<h2>在这里租房前，先看这几篇</h2>", blk + "<h2>在这里租房前，先看这几篇</h2>"));
}
// 首页导航
put("index.html", s => s.includes('href="building/"') ? s : s.replace('<a href="guide/study-abroad.html">✈️ 留学生租房</a>', '<a href="guide/study-abroad.html">✈️ 留学生租房</a><a href="building/">🏢 楼盘百科</a>'));
// sitemap：先去掉旧的楼盘条目，再在末尾加上
put("sitemap.xml", s => { s = s.replace(/<url><loc>https:\/\/howzu\.com\.au\/building\/[^<]*<\/loc>[\s\S]*?<\/url>\n?/g, "");
  const add = [SITE + "/building/"].concat(PICK.map(b => `${SITE}/building/${b.slug}.html`)).map(u => `<url><loc>${u}</loc><lastmod>${TODAY}</lastmod></url>\n`).join("");
  return s.replace("</urlset>", add + "</urlset>"); });
// llms.txt
put("llms.txt", s => { const blk = `## 墨尔本楼盘百科（${PICK.length} 栋）\n每页包括：建成年份、层数、套数、地址、本区一房两房周租中位数（DFFH）、到电车站火车站超市大学的距离、好租在这栋楼的在租房源。\n- [楼盘目录](${SITE}/building/)\n${PICK.map(b => `- [${b.name}](${SITE}/building/${b.slug}.html)`).join("\n")}\n<!--/bld-->\n`;
  return /## 墨尔本楼盘百科[\s\S]*?<!--\/bld-->\n/.test(s) ? s.replace(/## 墨尔本楼盘百科[\s\S]*?<!--\/bld-->\n/, blk) : s.trimEnd() + "\n\n" + blk; });
console.log(`楼盘百科：${PICK.length} 栋（更新 ${n} 个文件）`);
if (require.main === module && process.argv.includes("--list")) PICK.forEach(b => console.log(b.dwellings, b.name, "→", b.slug, b.range ? BM.key(b.range) : "无号段"));
module.exports = { PICK };
