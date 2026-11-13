// 从 data/listings.json 生成每套房的独立页 rent/<id>.html，并重写 sitemap.xml。
// 用法：node tools/build-listing-pages.js（test-data.js 每次也会自动跑，保持同步）
const fs = require("fs"), path = require("path");
const LP = require("../js/listing-page.js");
const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/listings.json"), "utf8"));
const list = (data.listings || []).filter(x => LP.safeId(x.id));
fs.mkdirSync(path.join(root, "rent"), { recursive: true });
let n = 0;
for (const x of list) {
  const f = path.join(root, "rent", x.id + ".html"), html = LP.render(x, data.contact, (data.listings || []).filter(y => y.status === "let").length, LP.related(x, list, 3));
  if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== html) { fs.writeFileSync(f, html); n++; }
}
const guides = fs.readdirSync(path.join(root, "guide")).filter(f => f.endsWith(".html"));
// sale/ 下的在售页（不含 noindex 的）也进 sitemap
const saleDir = path.join(root, "sale");
const sale = fs.existsSync(saleDir) ? fs.readdirSync(saleDir).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !/name="robots" content="noindex"/.test(fs.readFileSync(path.join(saleDir, f), "utf8"))).sort().map(f => "https://howzu.com.au/sale/" + f) : [];
const sm = LP.sitemap(list, guides, sale), sf = path.join(root, "sitemap.xml");
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
// 租房页底部：全部在租房源的静态链接（放页尾，不影响首屏布局）
put("rentals.html", s => s.replace(/<nav class="ssr" aria-label="全部在租房源">[\s\S]*?<\/nav>/,
  `<nav class="ssr" aria-label="全部在租房源"><b>全部在租房源</b>${live.map(x => `<a href="rent/${e(x.id)}.html">${e(x.title)}${x.rentWeekly ? ` · $${e(x.rentWeekly)}/周` : ""}</a>`).join("")}</nav>`));
// 区域页：该区在租房源
for (const g of fs.readdirSync(path.join(root, "guide")).filter(f => /^area-[a-z0-9-]+\.html$/.test(f))) {
  put("guide/" + g, s => { const m = s.match(/x\.suburb===("[^"]+")/); if (!m) return s; const sub = JSON.parse(m[1]);
    const L = live.filter(x => x.suburb === sub);
    const inner = L.length ? L.map(x => `<li><a href="/rent/${e(x.id)}.html">${e(x.title)}${x.rentWeekly ? ` · $${e(x.rentWeekly)}/周` : ""}</a></li>`).join("") : `<li>这个区暂时没有在租房源。<a href="/rentals.html#leadCard">留下需求</a>，有房第一时间通知你。</li>`;
    return s.replace(/<ul class="dot" id="areaL">[\s\S]*?<\/ul>/, `<ul class="dot" id="areaL">${inner}</ul>`); });
}
