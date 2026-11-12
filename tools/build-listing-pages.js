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
  const f = path.join(root, "rent", x.id + ".html"), html = LP.render(x, data.contact, (data.listings || []).filter(y => y.status === "let").length);
  if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== html) { fs.writeFileSync(f, html); n++; }
}
const guides = fs.readdirSync(path.join(root, "guide")).filter(f => f.endsWith(".html"));
const sm = LP.sitemap(list, guides), sf = path.join(root, "sitemap.xml");
if (fs.readFileSync(sf, "utf8") !== sm) fs.writeFileSync(sf, sm);
console.log(`房源独立页：${list.length} 套（更新 ${n} 个文件），sitemap 在租 ${list.filter(x => x.status === "live").length} 套 + 文章 ${guides.length} 篇`);
