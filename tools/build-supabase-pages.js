// ROADMAP 1c：Supabase 里已上线的房源（房东自助发布、贴帖入库）→ rent/<区>-<街>-<短id>.html 静态页 + sitemap。
// 只读数据库（GET），不改表、不写库。字段只取 rentals.html 本来就公开显示的；联系方式不写进静态页（电话、微信、邮箱一律去掉，
// 描述里夹带的也擦掉），想联系的人点“联系房东”进详情页。
// 下架或已租出：页面改成“已租出”（noindex），从 sitemap 去掉，文件保留（旧链接不 404）。
// 记录表 data/supabase_pages.json：id → 页面名、状态、最后一次公开内容（只有页面上本来就显示的字段），用来生成“已租出”页。
// 缺密钥就跳过，不报错。测试：node tools/test-supabase-pages.js（假数据，不连网）。
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const LP = require("../js/listing-page.js"), RV = require("../js/rent-vs.js");
const SITE = "https://howzu.com.au";
const LEAD_KINDS = ["求租需求", "房东托管咨询", "买房咨询", "回电请求", "代看房", "找房订阅", "退订"];
const MANI = path.join(root, "data/supabase_pages.json");

// ---- 纯函数 ----
const hideUnit = a => String(a || "").replace(/^\s*[\w-]+\s*\/\s*/, "");
// 擦掉联系方式：邮箱、澳洲/中国手机号、8 位以上连续数字、微信号
function scrub(s) {
  return String(s || "")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "（联系方式见详情页）")
    .replace(/(?:微信|wechat|weixin|vx|wx|v信|威信|加v|加微)\s*(?:号)?\s*[:：]?\s*[A-Za-z][\w-]{4,19}/gi, "（联系方式见详情页）")
    .replace(/(?:\+?61|0)\s*4(?:[\s-]*\d){8}/g, "（联系方式见详情页）")
    .replace(/(?:\+?86[\s-]*)?1[3-9]\d(?:[\s-]*\d){8}/g, "（联系方式见详情页）")
    .replace(/(?:\+?61|0)[2378](?:[\s-]*\d){8}/g, "（联系方式见详情页）")
    .replace(/\d(?:[\s-]?\d){7,}/g, m => /^\d{4}-\d{2}-\d{2}$/.test(m) ? m : "（联系方式见详情页）");
}
const slugPart = s => String(s || "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function pageName(row) {
  const a = hideUnit(row.address).split(",")[0].replace(/^\s*\d+[a-z]?(?:\s*-\s*\d+[a-z]?)?\s+/i, "");
  const parts = [slugPart(String(row.suburb || "").replace(/ CBD$/i, "")), slugPart(a)].filter(Boolean).join("-").slice(0, 50).replace(/-$/, "");
  return (parts ? parts + "-" : "listing-") + String(row.id).replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();
}
// Supabase 行 → 房源对象（和 rentals.html userListings 一致，但不带电话、微信）
function toListing(r) {
  const av = r.available === "两周内" && r.created_at ? new Date(Date.parse(r.created_at) + 14 * 864e5).toISOString().slice(0, 10) : r.available;
  const D = String(r.description || "").split(/\n*—— English ——\n/);
  return {
    id: String(r.id), page: pageName(r), status: "live", kind: r.kind, user: true,
    title: scrub(r.title), address: scrub(hideUnit(r.address)), suburb: r.suburb, beds: r.beds, baths: r.baths, cars: r.cars,
    rentWeekly: r.rent_weekly, available: av ? LP.availText(av) : null,
    furnished: r.furnished === "带家具" ? true : r.furnished === "不带家具" ? false : r.furnished === "部分家具" ? "部分家具" : null,
    photos: (r.photos || []).filter(p => /^https:\/\//.test(p)), highlights: (r.highlights || []).filter(h => !/^(渠道|来源|lang|type|楼)[:：]/.test(h)).map(scrub),
    desc: scrub(D[0]), descEn: scrub((D[1] || "").trim()) || null, createdAt: r.created_at,
  };
}
// 已租出版：不显示租金和入住日期
const asLet = x => Object.assign({}, x, { status: "let", rentWeekly: null, available: null });
function renderPage(x, ctx) {
  let html = LP.render(x, {}, ctx.letCount || 0, LP.related(x, ctx.pool || [], 3), { vs: ctx.RVC ? (r => r && { html: RV.html(r), css: RV.CSS })(RV.match(x, ctx.RVC)) : null });
  if (x.status === "live") { // 静态页不放房东电话：底部按钮进详情页联系
    const bar = `<nav class="bar"><div><a class="g" href="../rentals.html" data-act="more" data-id="${x.id}">看其他房源</a><a class="p" href="../rentals.html?id=${encodeURIComponent(x.id)}" data-act="contact" data-id="${x.id}">💬 联系房东</a></div></nav>\n`;
    html = html.replace("</body>", bar + "</body>");
  }
  return html;
}
// sitemap：标记段里只放在租的
function sitemapWith(sm, liveUrls) {
  sm = sm.replace(/<!--supabase-->[\s\S]*?<!--\/supabase-->\n?/, "");
  const blk = `<!--supabase-->\n${liveUrls.map(([u, d]) => `  <url><loc>${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.8</priority></url>`).join("\n")}${liveUrls.length ? "\n" : ""}<!--/supabase-->\n`;
  return sm.replace("</urlset>", blk + "</urlset>");
}
// 一次构建：rows = 已上线的 Supabase 行；mani = 记录表；返回要写的文件
function build(rows, mani, ctx) {
  const ownIds = new Set((ctx.own || []).map(x => String(x.id)));
  const live = rows.filter(r => r && r.status === "live" && !LEAD_KINDS.includes(r.kind) && !ownIds.has(String(r.id))).map(toListing);
  const ids = new Set(live.map(x => x.id)), files = {}, M = Object.assign({}, mani);
  const pool = live.concat((ctx.own || []).filter(y => y.status === "live"));
  for (const x of live) {
    if (M[x.id] && M[x.id].page) x.page = M[x.id].page; // 名字一旦定了不再变（避免旧链接失效）
    files["rent/" + x.page + ".html"] = renderPage(x, Object.assign({}, ctx, { pool }));
    const snap = { title: x.title, address: x.address, suburb: x.suburb, beds: x.beds, baths: x.baths, cars: x.cars, furnished: x.furnished, photos: x.photos, highlights: x.highlights, desc: x.desc, descEn: x.descEn, kind: x.kind };
    M[x.id] = { page: x.page, status: "live", since: (M[x.id] && M[x.id].status === "live" && M[x.id].since) || ctx.today, snap };
  }
  for (const id of Object.keys(M)) if (!ids.has(id) && M[id].status === "live") { // 下架 / 已租出
    const x = asLet(Object.assign({ id, page: M[id].page, user: true }, M[id].snap));
    files["rent/" + M[id].page + ".html"] = renderPage(x, Object.assign({}, ctx, { pool }));
    M[id] = Object.assign({}, M[id], { status: "let", off: ctx.today });
  }
  const liveUrls = live.map(x => [`${SITE}/rent/${x.page}.html`, M[x.id].since]);
  return { files, mani: M, liveUrls, live };
}

// ---- 运行 ----
async function main() {
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!KEY) { console.log("Supabase 静态页：没有 SUPABASE_SERVICE_ROLE_KEY，跳过"); return; }
  const url = (/SUPABASE_URL:\s*"([^"]+)"/.exec(fs.readFileSync(path.join(root, "js/config.js"), "utf8")) || [])[1];
  const sel = "id,kind,status,title,address,suburb,beds,baths,cars,rent_weekly,available,furnished,photos,highlights,description,created_at";
  const r = await fetch(`${url}/rest/v1/listings?select=${sel}&status=eq.live&order=created_at.desc&limit=500`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) { // 读不到就沿用上次的在租列表，保证 sitemap 不丢这些页面
    console.log("Supabase 静态页：读取失败 HTTP " + r.status + "，页面不动，sitemap 沿用上次记录");
    const M = fs.existsSync(MANI) ? JSON.parse(fs.readFileSync(MANI, "utf8")) : {};
    const sf = path.join(root, "sitemap.xml"), sm = fs.readFileSync(sf, "utf8"), sm2 = sitemapWith(sm, Object.values(M).filter(m => m.status === "live").map(m => [`${SITE}/rent/${m.page}.html`, m.since]));
    if (sm2 !== sm) fs.writeFileSync(sf, sm2); return; }
  const rows = await r.json();
  const data = JSON.parse(fs.readFileSync(path.join(root, "data/listings.json"), "utf8"));
  const rcF = path.join(root, "data/rent_check.json"), RVC = fs.existsSync(rcF) ? RV.compact(JSON.parse(fs.readFileSync(rcF, "utf8"))) : null;
  const mani = fs.existsSync(MANI) ? JSON.parse(fs.readFileSync(MANI, "utf8")) : {};
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
  const out = build(rows, mani, { own: data.listings || [], RVC, today, letCount: 0 });
  // 只报数字，不报任何内容
  const byKind = {}; rows.filter(x => !LEAD_KINDS.includes(x.kind)).forEach(x => { byKind[x.kind || "未标"] = (byKind[x.kind || "未标"] || 0) + 1; });
  const byCh = {}; rows.filter(x => !LEAD_KINDS.includes(x.kind)).forEach(x => { const h = (x.highlights || []).find(h => /^(渠道|来源)[:：]/.test(h)); const c = h ? h.replace(/^(渠道|来源)[:：]\s*/, "") : (/贴帖|入库/.test(x.description || "") ? "贴帖入库" : "房东自助发布"); byCh[c] = (byCh[c] || 0) + 1; });
  console.log(`Supabase 已上线：${out.live.length} 套；按类型 ${JSON.stringify(byKind)}；按渠道 ${JSON.stringify(byCh)}`);
  let n = 0;
  for (const [f, html] of Object.entries(out.files)) { const p = path.join(root, f); if (!fs.existsSync(p) || fs.readFileSync(p, "utf8") !== html) { fs.writeFileSync(p, html); n++; } }
  const mj = JSON.stringify(out.mani, null, 1) + "\n"; if (!fs.existsSync(MANI) || fs.readFileSync(MANI, "utf8") !== mj) { fs.writeFileSync(MANI, mj); n++; }
  const sf = path.join(root, "sitemap.xml"), sm = fs.readFileSync(sf, "utf8"), sm2 = sitemapWith(sm, out.liveUrls); if (sm2 !== sm) { fs.writeFileSync(sf, sm2); n++; }
  console.log(`Supabase 静态页：在租 ${out.liveUrls.length} 张进 sitemap，已租出 ${Object.values(out.mani).filter(m => m.status === "let").length} 张，更新 ${n} 个文件`);
}
if (require.main === module) main().catch(e => { console.log("Supabase 静态页出错（不影响其他构建）：" + e.message); });
module.exports = { scrub, pageName, toListing, build, sitemapWith, LEAD_KINDS };
