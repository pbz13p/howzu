// 中介房源自动导入（ROADMAP 1g）：读中介 CRM 给的 REAXML，把“住宅出租、状态 current、写了固定周租”的房源写进 Supabase listings 表，
// 中介那边下架、租出、撤回的，下次运行改成“已租出”。每 2 小时由 .github/workflows/feeds.yml 跑一次，跑完接 build-pages（静态页 + IndexNow）。
// 名单：data/feeds.json（中介名、拉取网址、授权日期、授权邮件存档位置）。名单为空就什么都不做。
// 只导中介书面授权的；不抓任何网站；照片用中介给的图片网址，不下载；不改表结构：
//   - 这套房是哪家中介的哪条：review_note = "feed:<中介key>:<uniqueID> · mod <modTime>"（后台字段，网站不显示）
//   - 网站上显示“由 XX 提供”：highlights 里的 "中介：XX"；中介电话：contact_phone（公开的商业电话），中介名：contact_name
// 用法：node tools/import-feed.js                     正式跑（要 SUPABASE_SERVICE_ROLE_KEY）
//       node tools/import-feed.js --dry <文件或网址>   只解析、打印会怎么写，不连数据库
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");

// ---------- 最小 REAXML 解析（REAXML 结构简单，不引第三方库） ----------
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unesc = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] != null ? ENT[e] : m).trim();
const attrs = s => { const o = {}; String(s || "").replace(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (m, k, _, a, b) => { o[k] = unesc(a != null ? a : b); }); return o; };
function tag(xml, name) { // 第一个 <name ...>文本</name> 或 <name .../>
  const m = new RegExp(`<${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${name}>)`, "i").exec(xml || "");
  return m ? { a: attrs(m[1]), t: m[2] != null ? unesc(m[2]) : "", raw: m[2] || "" } : null;
}
const all = (xml, name) => { const out = [], re = new RegExp(`<${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${name}>)`, "gi"); let m; while ((m = re.exec(xml || ""))) out.push({ a: attrs(m[1]), t: m[2] != null ? unesc(m[2]) : "", raw: m[2] || "" }); return out; };
const val = (xml, name) => { const x = tag(xml, name); return x ? x.t : ""; };
const yes = v => /^(1|yes|true|y)$/i.test(String(v || "").trim());

// 每个 <rental> 一条（REAXML 里住宅出租就是 rental；residential 是出售，commercial 等都不导）
function parseFeed(xml) {
  return all(String(xml || ""), "rental").map(r => {
    const a = tag(r.raw, "address"), A = a ? a.raw : "", ag = tag(r.raw, "listingAgent"), rent = tag(r.raw, "rent");
    const tels = ag ? all(ag.raw, "telephone").map(t => ({ type: (t.a.type || "").toLowerCase(), n: t.t })) : [];
    const f = tag(r.raw, "features"), F = f ? f.raw : "", al = tag(r.raw, "allowances"), AL = al ? al.raw : "";
    return {
      status: (r.a.status || "").toLowerCase(), modTime: r.a.modTime || "",
      agentID: val(r.raw, "agentID"), uniqueID: val(r.raw, "uniqueID"),
      rent: rent ? { amount: rent.t, period: (rent.a.period || "week").toLowerCase(), display: (rent.a.display || "yes").toLowerCase() } : null,
      priceView: val(r.raw, "priceView"), dateAvailable: val(r.raw, "dateAvailable"), bond: val(r.raw, "bond"),
      address: a ? { display: (a.a.display || "yes").toLowerCase(), sub: val(A, "subNumber"), lot: val(A, "lotNumber"), num: val(A, "streetNumber"), street: val(A, "street"),
        suburb: val(A, "suburb"), state: val(A, "state"), postcode: val(A, "postcode") } : null,
      category: (tag(r.raw, "category") || { a: {} }).a.name || "",
      headline: val(r.raw, "headline"), description: val(r.raw, "description"),
      beds: val(F, "bedrooms"), baths: val(F, "bathrooms"), garages: val(F, "garages"), carports: val(F, "carports"), carSpaces: val(r.raw, "carSpaces") || val(F, "carSpaces"),
      furnished: val(AL, "furnished"), pets: val(AL, "petFriendly"),
      images: all((tag(r.raw, "images") || {}).raw || "", "img").map(i => i.a.url).filter(Boolean),
      agent: ag ? { name: val(ag.raw, "name"), phone: (tels.find(t => t.type === "bh") || tels.find(t => /mob/.test(t.type)) || tels[0] || {}).n || "", email: val(ag.raw, "email") } : null,
    };
  });
}

// ---------- 转成好租的行 ----------
const LIVE = new Set(["current"]), GONE = new Set(["leased", "withdrawn", "offmarket", "off market", "deleted", "sold"]);
const CAT = { house: "独立屋", unit: "单元房", apartment: "公寓", townhouse: "联排别墅", villa: "别墅", studio: "开间公寓", flat: "公寓", terrace: "排屋", duplexsemi: "双拼屋", blockofunits: "公寓" };
const ZH = ["零", "一", "两", "三", "四", "五", "六", "七", "八", "九", "十"];
const num = s => { const n = parseInt(String(s || "").replace(/[^\d]/g, ""), 10); return Number.isFinite(n) ? n : null; };
const clip = (n, lo, hi) => n == null ? null : Math.max(lo, Math.min(hi, n));
const titleCase = s => String(s || "").toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
// 固定周租：只认纯数字的 rent（"$450 per week"、"Contact agent" 这类文字都不算），按月写的换成周
function weeklyRent(it) {
  if (!it.rent || it.rent.display === "no") return null;
  const raw = String(it.rent.amount || "").trim();
  if (!/^\$?\s*\d[\d,]*(\.\d+)?$/.test(raw)) return null;
  const n = Math.round(parseFloat(raw.replace(/[$,\s]/g, "")));
  const w = /month|calendar/.test(it.rent.period) ? Math.round(n * 12 / 52) : /fortnight/.test(it.rent.period) ? Math.round(n / 2) : /year|annual/.test(it.rent.period) ? Math.round(n / 52) : n;
  return w >= 50 && w <= 20000 ? w : null;
}
const isoDate = s => { const m = /(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
const noteOf = (ag, it) => `feed:${ag.key}:${it.uniqueID} · mod ${it.modTime || "?"}`;
const keyOfNote = n => { const m = /^feed:([\w-]+):(.+?) · mod /.exec(n || ""); return m ? `${m[1]}:${m[2]}` : null; };

// 返回 { row } 或 { skip: 原因 }
function toRow(it, ag) {
  if (!it.uniqueID) return { skip: "没有 uniqueID" };
  if (!LIVE.has(it.status)) return { skip: "状态不是 current（" + (it.status || "空") + "）" };
  const rent = weeklyRent(it);
  if (!rent) return { skip: "没有固定周租（维州出租广告必须写固定租金）" };
  const ad = it.address || {};
  if (String(ad.state || "").toLowerCase() !== "vic") return { skip: "不在维州" };
  if (ad.display === "no" || !ad.street || !ad.suburb) return { skip: "地址不公开或不完整" };
  const suburb = titleCase(ad.suburb), beds = clip(num(it.beds), 0, 10), baths = clip(num(it.baths), 0, 10);
  const cars = clip(num(it.carSpaces) != null ? num(it.carSpaces) : (num(it.garages) || 0) + (num(it.carports) || 0), 0, 10);
  const cat = CAT[String(it.category || "").toLowerCase().replace(/[^a-z]/g, "")] || "房源";
  const roomTxt = beds === 0 ? "开间" : beds ? `${ZH[beds] || beds}房${baths ? ZH[baths] + "卫" : ""}` : "";
  const title = `${suburb} · ${roomTxt}${cat}`.slice(0, 80).padEnd(4, " ");
  const street = [ad.num, ad.street].filter(Boolean).join(" ");
  const address = `${street}, ${suburb} VIC ${ad.postcode || ""}`.trim().slice(0, 200);
  const avail = isoDate(it.dateAvailable);
  const furn = it.furnished === "" ? null : yes(it.furnished) ? "带家具" : "不带家具";
  const facts = [beds != null && (beds === 0 ? "开间" : `${beds} 房`), baths && `${baths} 卫`, cars ? `${cars} 个车位` : "无车位", furn, it.pets !== "" && (yes(it.pets) ? "可养宠物" : "不可养宠物"), avail ? `${avail} 起可入住` : null].filter(Boolean).join(" · ");
  const zh = `${facts}。\n由 ${ag.name} 提供（持牌中介），看房和签约由中介负责。\n中文描述：好租稍后补上；下面是中介的英文原文。`;
  const en = [it.headline, it.description].filter(Boolean).join("\n\n");
  const description = (zh + (en ? "\n—— English ——\n" + en : "")).slice(0, 3000);
  const photos = it.images.map(u => String(u).replace(/^http:\/\//i, "https://")).filter(u => /^https:\/\/[^\s"<>]+$/.test(u)).slice(0, 20);
  const highlights = [`中介：${ag.name}`, ag.minStandardsConfirmed ? "中介已确认符合最低租住标准" : null, it.bond && num(it.bond) ? `押金 $${num(it.bond)}` : null].filter(Boolean);
  const phone = String((it.agent && it.agent.phone) || ag.phone || "").slice(0, 30) || null;
  return { row: {
    status: ag.minStandardsConfirmed ? "live" : "pending", // 中介没书面确认最低租住标准（RTA s65B）的，先不公开
    kind: "整套出租", title, address, suburb, beds, baths, cars, rent_weekly: rent, available: avail, furnished: furn,
    highlights, description, photos, contact_name: String(ag.name).slice(0, 40), contact_phone: phone, contact_wechat: null,
    review_note: noteOf(ag, it),
  } };
}

// 一次对账：feed 里的条目 + 数据库里这家中介已有的行 → 要新增、更新、改已租出的
// snapshot=true：feed 是全量（拉网址的通常是），不在 feed 里的也算下架；false：增量（FTP 推送），只看明确的状态
function plan(items, existing, ag) {
  const byKey = new Map(existing.map(r => [keyOfNote(r.review_note), r]).filter(([k]) => k));
  const out = { insert: [], update: [], let: [], skip: [] }, seen = new Set();
  for (const it of items) {
    if (ag.agentID && it.agentID && it.agentID !== ag.agentID) { out.skip.push([it.uniqueID, "agentID 不是这家中介"]); continue; }
    const k = `${ag.key}:${it.uniqueID}`; seen.add(k);
    const cur = byKey.get(k);
    if (GONE.has(it.status)) { if (cur && cur.status !== "let") out.let.push(cur.id); continue; }
    const r = toRow(it, ag);
    if (r.skip) { out.skip.push([it.uniqueID, r.skip]); if (cur && cur.status === "live") out.let.push(cur.id); continue; } // 原来在线、现在不合格（例如去掉了固定租金）也下架
    if (!cur) out.insert.push(r.row);
    else if (cur.review_note !== r.row.review_note || cur.rent_weekly !== r.row.rent_weekly || cur.status === "let") out.update.push([cur.id, r.row]);
  }
  if (ag.snapshot !== false) for (const [k, r] of byKey) if (!seen.has(k) && r.status !== "let" && r.status !== "rejected") out.let.push(r.id);
  out.let = [...new Set(out.let)];
  return out;
}

// ---------- 运行 ----------
async function main() {
  const dry = process.argv.indexOf("--dry");
  if (dry > -1) { // 本地试解析
    const src = process.argv[dry + 1]; const xml = /^https?:/.test(src) ? await (await fetch(src)).text() : fs.readFileSync(src, "utf8");
    const ag = { key: "test", name: "测试中介", minStandardsConfirmed: true };
    for (const it of parseFeed(xml)) { const r = toRow(it, ag); console.log(it.uniqueID, it.status, r.skip ? "跳过：" + r.skip : `→ ${r.row.title} $${r.row.rent_weekly}/周 ${r.row.photos.length} 张图`); }
    return;
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "data/feeds.json"), "utf8"));
  const list = (cfg.agencies || []).filter(a => a.active !== false && a.url && a.key && a.name && a.authorizedOn);
  if (!list.length) { console.log("中介导入：名单为空（data/feeds.json），什么都不做"); return; }
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!KEY) { console.log("中介导入：没有 SUPABASE_SERVICE_ROLE_KEY，跳过"); return; }
  const url = (/SUPABASE_URL:\s*"([^"]+)"/.exec(fs.readFileSync(path.join(root, "js/config.js"), "utf8")) || [])[1];
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };
  for (const ag of list) {
    try {
      const r = await fetch(ag.url, { headers: { "user-agent": "HowzuFeedImporter/1 (+https://howzu.com.au)" } });
      if (!r.ok) { console.log(`${ag.name}：拉取失败 HTTP ${r.status}，这次不动它的房源`); continue; }
      const items = parseFeed(await r.text());
      if (!items.length && ag.snapshot !== false) { console.log(`${ag.name}：feed 里一条出租都没有，为防误下架，这次不动`); continue; }
      const ex = await (await fetch(`${url}/rest/v1/listings?select=id,status,rent_weekly,review_note&review_note=like.${encodeURIComponent(`feed:${ag.key}:*`)}&limit=2000`, { headers: H })).json();
      const p = plan(items, Array.isArray(ex) ? ex : [], ag);
      for (const row of p.insert) { const q = await fetch(`${url}/rest/v1/listings`, { method: "POST", headers: H, body: JSON.stringify(row) }); if (!q.ok) console.log("  新增失败", q.status, (await q.text()).slice(0, 200)); }
      for (const [id, row] of p.update) await fetch(`${url}/rest/v1/listings?id=eq.${id}`, { method: "PATCH", headers: H, body: JSON.stringify(row) });
      for (const id of p.let) await fetch(`${url}/rest/v1/listings?id=eq.${id}`, { method: "PATCH", headers: H, body: JSON.stringify({ status: "let" }) });
      console.log(`${ag.name}：feed ${items.length} 条 → 新增 ${p.insert.length}，更新 ${p.update.length}，改已租出 ${p.let.length}，跳过 ${p.skip.length}`);
      const why = {}; p.skip.forEach(([, w]) => { why[w] = (why[w] || 0) + 1; }); if (p.skip.length) console.log("  跳过原因：" + JSON.stringify(why));
    } catch (e) { console.log(`${ag.name}：出错（${e.message}），这次不动它的房源`); }
  }
}
if (require.main === module) main();
module.exports = { parseFeed, toRow, plan, weeklyRent, keyOfNote };
