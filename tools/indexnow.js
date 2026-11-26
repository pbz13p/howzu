// IndexNow：把这次构建新增或改过的网址一次推给搜索引擎（Bing、Yandex、Naver、Seznam 等共享；Google 不用 IndexNow，靠 sitemap）。
// 用法（在 GitHub Actions 提交之后）：node tools/indexnow.js <提交前的 sha>
// 只推本次变化：git diff 里改动的公开页面 + sitemap 里新增或改了日期的 <loc>。不全量重推。返回码写进构建日志。
// 密钥文件放在网站根目录（<KEY>.txt，内容就是密钥），是公开的，不是秘密。
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const root = path.join(__dirname, ".."), SITE = "https://howzu.com.au", HOST = "howzu.com.au";
const KEY = (fs.readdirSync(root).find(f => /^[0-9a-f]{32}\.txt$/.test(f)) || "").slice(0, 32);
const PUBLIC = /^(rent|news|building|guide|sale)\/[^/]+\.html$|^(index|rentals|rents|llms)\.(html|txt)$/;

// 文件 → 网址
function fileUrl(f) {
  if (f === "index.html") return SITE + "/";
  if (/\/index\.html$/.test(f)) return `${SITE}/${f.replace(/index\.html$/, "")}`;
  return `${SITE}/${f}`;
}
// 从改动文件列表和 sitemap 的 diff 里挑出要推的网址
function changedUrls(files, sitemapDiff) {
  const out = new Set();
  for (const f of files) if (PUBLIC.test(f) && f !== "llms.txt") out.add(fileUrl(f));
  for (const line of String(sitemapDiff || "").split("\n")) {
    if (!/^\+(?!\+\+)/.test(line)) continue;
    for (const m of line.matchAll(/<loc>(https:\/\/howzu\.com\.au\/[^<]*)<\/loc>/g)) out.add(m[1]);
  }
  return [...out].filter(u => u.startsWith(SITE + "/")).slice(0, 10000);
}
async function main() {
  const base = process.argv[2];
  if (!KEY) { console.log("IndexNow：根目录没有密钥文件，跳过"); return; }
  if (!base || /^0+$/.test(base)) { console.log("IndexNow：没有提交前的 sha，跳过"); return; }
  let files = [], smd = "";
  try { files = execSync(`git diff --name-only ${base} HEAD`, { cwd: root }).toString().split("\n").filter(Boolean); smd = execSync(`git diff -U0 ${base} HEAD -- sitemap.xml`, { cwd: root }).toString(); }
  catch (e) { console.log("IndexNow：git diff 失败，跳过：" + e.message); return; }
  const urls = changedUrls(files, smd);
  if (!urls.length) { console.log("IndexNow：这次没有变化的公开页面，不推"); return; }
  const body = { host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls };
  try {
    const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
    console.log(`IndexNow：推了 ${urls.length} 个网址，返回 HTTP ${r.status}${r.status === 200 || r.status === 202 ? "（成功）" : "（" + (await r.text()).slice(0, 200) + "）"}`);
    urls.slice(0, 20).forEach(u => console.log("  " + u));
  } catch (e) { console.log("IndexNow：请求失败：" + e.message); }
}
if (require.main === module) main();
module.exports = { changedUrls, fileUrl, KEY };
