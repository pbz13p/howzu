// 从 data/listings.json 生成每套房的独立页 rent/<id>.html，并重写 sitemap.xml。
// 用法：node tools/build-listing-pages.js（test-data.js 每次也会自动跑，保持同步）
const fs = require("fs"), path = require("path");
const LP = require("../js/listing-page.js");
const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/listings.json"), "utf8"));
const list = (data.listings || []).filter(x => LP.safeId(x.id));
fs.mkdirSync(path.join(root, "rent"), { recursive: true });
// 比本区同房型中位数高/低：从 DFFH 数据压缩出 data/rent_vs.json（租房页浏览器也用它）
const RV = require("../js/rent-vs.js"), rcF = path.join(root, "data/rent_check.json");
const RVC = fs.existsSync(rcF) ? RV.compact(JSON.parse(fs.readFileSync(rcF, "utf8"))) : null;
if (RVC) { const vf = path.join(root, "data/rent_vs.json"), js = JSON.stringify(RVC); if (!fs.existsSync(vf) || fs.readFileSync(vf, "utf8") !== js) fs.writeFileSync(vf, js); }
let n = 0;
for (const x0 of list) {
  // 草稿（如 Cendant 待上线）没点“上线”前不公开：页面按“已租出”渲染，不显示新租金和入住日期
  const x = x0.status === "draft" ? Object.assign({}, x0, { status: "let", rentWeekly: null, available: null }) : x0;
  const f = path.join(root, "rent", x.id + ".html"), html = LP.render(x, data.contact, (data.listings || []).filter(y => y.status === "let").length, LP.related(x, list, 3), { vs: (r => r && { html: RV.html(r), css: RV.CSS })(RV.match(x, RVC)) });
  if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== html) { fs.writeFileSync(f, html); n++; }
}
const guides = fs.readdirSync(path.join(root, "guide")).filter(f => f.endsWith(".html"));
// sale/ 下的在售页（不含 noindex 的）也进 sitemap
const saleDir = path.join(root, "sale");
const sale = fs.existsSync(saleDir) ? fs.readdirSync(saleDir).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !/name="robots" content="noindex"/.test(fs.readFileSync(path.join(saleDir, f), "utf8"))).sort().map(f => "https://howzu.com.au/sale/" + f) : [];
let sm = LP.sitemap(list, guides, sale); const sf = path.join(root, "sitemap.xml");
// 今日要闻：/news/ 和每期页面
{ const nd = path.join(root, "news"); if (fs.existsSync(nd)) { const ns = fs.readdirSync(nd).filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).sort().reverse();
  const add = [`  <url><loc>https://howzu.com.au/rent/feed.xml</loc><changefreq>hourly</changefreq></url>`, `  <url><loc>https://howzu.com.au/news/</loc><changefreq>daily</changefreq></url>`].concat(ns.map(f => `  <url><loc>https://howzu.com.au/news/${f}</loc></url>`)).join("\n");
  sm = sm.replace("</urlset>", add + "\n</urlset>"); } }
if (fs.readFileSync(sf, "utf8") !== sm) fs.writeFileSync(sf, sm);
console.log(`房源独立页：${list.length} 套（更新 ${n} 个文件），sitemap 在租 ${list.filter(x => x.status === "live").length} 套 + 文章 ${guides.length} 篇 + 在售 ${sale.length} 套`);

// ---- 把在租房源直接写进静态页面（Google 不跑 JS 也能看到房源链接；首页首屏不用等接口）----
const HR = require("../js/home-rent.js");
const e = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const live = list.filter(x => x.status === "live");
const put = (file, fn) => { const f = path.join(root, file); if (!fs.existsSync(f)) return; const a = fs.readFileSync(f, "utf8"), b = fn(a); if (b !== a) { fs.writeFileSync(f, b); console.log("  写入静态房源：" + file); } };
// 首页“正在招租”
put("index.html", s => { const R = HR.html(list);
  return s.replace(/<section class="card hr( hidden)?" id="homeRent"/, `<section class="card hr${R.n ? "" : " hidden"}" id="homeRent"`)
    .replace(/<span id="hrN">[^<]*<\/span>/, `<span id="hrN">${R.n ? R.n + " 套" : ""}</span>`)
    .replace(/<div class="hr-r" id="hrR">[\s\S]*?<\/div><!--\/hrR-->|<div class="hr-r" id="hrR"><\/div>/, `<div class="hr-r" id="hrR">${R.cards}</div><!--/hrR-->`); });
// 首页“好租干货”：在租房源下面放最新文章（区域页、学区页除外），新的在前；同一天的租房类排前面
{ const gd = path.join(root, "guide"), N = 6;
  const posts = fs.readdirSync(gd).filter(f => f.endsWith(".html") && !/^(area-|zone-)/.test(f) && f !== "property.html").map(f => {
    const h = fs.readFileSync(path.join(gd, f), "utf8"), d = h.match(/(20\d\d) 年 (\d+) 月 (\d+) 日更新/), t = (h.match(/<h1>([^<]*)<\/h1>/) || [])[1], k = (h.match(/class="kick">([^<]*)/) || [])[1] || "";
    const ds = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
    return t && d && { f, t, k: k.replace(/^租房指南 · |^房产干货 · /, ""), rent: /租房/.test(k), date: d[1] + String(d[2]).padStart(2, "0") + String(d[3]).padStart(2, "0"), md: `${+d[2]}/${+d[3]}`, ds: ds.slice(0, 46) + (ds.length > 46 ? "…" : "") };
  }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date) || (b.rent - a.rent)).slice(0, N);
  const items = posts.map(p => `<a class="hn-a" href="guide/${e(p.f)}"><span class="hn-k">${e(p.k)} · ${e(p.md)}</span><b>${e(p.t)}</b><span class="hn-d">${e(p.ds)}</span></a>`).join("");
  put("index.html", s => s.replace(/<div class="hn-l" id="hnL">[\s\S]*?<\/div><!--\/hnL-->/, `<div class="hn-l" id="hnL">${items}</div><!--/hnL-->`)); }
// 租房页底部：全部在租房源的静态链接（放页尾，不影响首屏布局）
put("rentals.html", s => s.replace(/<nav class="ssr" aria-label="全部在租房源">[\s\S]*?<\/nav>/,
  `<nav class="ssr" aria-label="全部在租房源"><b>全部在租房源</b>${live.map(x => `<a href="rent/${e(x.id)}.html">${e(x.title)}${x.rentWeekly ? ` · $${e(x.rentWeekly)}/周` : ""}</a>`).join("")}</nav>`));
// 找房订阅卡片：25 个区域页（区自动填）和留学生专区
for (const f of fs.readdirSync(path.join(root, "guide")).filter(f => /^area-.*\.html$/.test(f) || f === "study-abroad.html")) {
  put("guide/" + f, s => {
    if (s.includes('class="alert-sub"')) return s;
    const sub = (s.match(/<div id="llCard" data-suburb="([^"]*)"/) || [])[1] || "";
    const card = `<div class="alert-sub" data-suburb="${sub}" data-max=""></div>\n`;
    s = s.includes('<div id="llCard"') ? s.replace('<div id="llCard"', card + '<div id="llCard"') : s.replace('<section id="book"', card + '<section id="book"');
    return s.replace('<script src="/js/contact-fab.js', '<script src="/js/alert-sub.js?v=20261122" defer></script><script src="/js/contact-fab.js');
  });
}
// 新房源订阅源（Atom）：只含已上线房源的公开字段
{ const live = list.filter(x => x.status === "live" && Number(x.rentWeekly) > 0), X = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const upd = live.map(x => x.verified || x.listedAt || "2026-11-01").sort().pop() || "2026-11-01";
  const feed = `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n<title>好租 Howzu · 墨尔本在租房源</title>\n<subtitle>好租新上线的墨尔本房源（周租、区、几房、可入住日期）</subtitle>\n<link href="https://howzu.com.au/rent/feed.xml" rel="self"/>\n<link href="https://howzu.com.au/rentals.html"/>\n<id>https://howzu.com.au/rent/feed.xml</id>\n<updated>${upd}T00:00:00+11:00</updated>\n` +
    live.map(x => `<entry><title>${X(x.title)} · $${X(x.rentWeekly)}/周</title><link href="https://howzu.com.au/rent/${X(x.id)}.html"/><id>https://howzu.com.au/rent/${X(x.id)}.html</id><updated>${X(x.verified || x.listedAt || upd)}T00:00:00+11:00</updated><summary>${X([x.suburb, x.beds != null ? x.beds + " 房" : "", x.baths != null ? x.baths + " 卫" : "", "$" + x.rentWeekly + "/周", x.available ? x.available + " 起可入住" : ""].filter(Boolean).join(" · "))}</summary></entry>`).join("\n") + "\n</feed>\n";
  const ff = path.join(root, "rent", "feed.xml"); if (!fs.existsSync(ff) || fs.readFileSync(ff, "utf8") !== feed) { fs.writeFileSync(ff, feed); n++; } }
// 留学生专区：每所学校附近在租房源（ul 的 data-subs 写着包含哪些区）
put("guide/study-abroad.html", s => s.replace(/<ul class="dot" id="sa-([a-z]+)" data-subs="([^"]*)">[\s\S]*?<\/ul>/g, (all, k, subsAttr) => {
  const subs = JSON.parse(subsAttr.replace(/&quot;/g, '"')), L = live.filter(x => subs.includes(x.suburb));
  const inner = L.length ? L.map(x => `<li><a href="/rent/${e(x.id)}.html">${e(x.title)}${x.rentWeekly ? ` · $${e(x.rentWeekly)}/周` : ""}</a></li>`).join("") : `<li>这几个区暂时没有在租房源。<a href="/rentals.html#leadCard">留下需求</a>，有房第一时间通知你。</li>`;
  return `<ul class="dot" id="sa-${k}" data-subs="${subsAttr}">${inner}</ul>`; }));
// 区域页：该区在租房源
for (const g of fs.readdirSync(path.join(root, "guide")).filter(f => /^area-[a-z0-9-]+\.html$/.test(f))) {
  put("guide/" + g, s => { const m = s.match(/x\.suburb===("[^"]+")/); if (!m) return s; const sub = JSON.parse(m[1]);
    const L = live.filter(x => x.suburb === sub);
    const inner = L.length ? L.map(x => `<li><a href="/rent/${e(x.id)}.html">${e(x.title)}${x.rentWeekly ? ` · $${e(x.rentWeekly)}/周` : ""}</a></li>`).join("") : `<li>这个区暂时没有在租房源。<a href="/rentals.html#leadCard">留下需求</a>，有房第一时间通知你。</li>`;
    return s.replace(/<ul class="dot" id="areaL">[\s\S]*?<\/ul>/, `<ul class="dot" id="areaL">${inner}</ul>`); });
}
