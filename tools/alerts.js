// 找房订阅：每小时在 GitHub Actions 上跑。node tools/alerts.js
// 1) 先处理退订请求（kind=退订，校验一次性 token）→ 订阅改 rejected；2) 对比房源快照，找新上线和降价；
// 3) 按订阅条件匹配，同一人一天最多 1 封，多套合并；4) 用 Resend 发信；5) 写回快照（只含房源 id 和周租，不含任何邮箱）。
// 需要 GitHub secrets：SUPABASE_SERVICE_ROLE_KEY、RESEND_API_KEY；ALERT_SECRET、ALERT_FROM 可选（没填就由 service key 派生 / 用默认发件人）。缺了就跳过，不报错。
// 测试：ALERT_TEST=1 ALERT_TEST_EMAIL=xx@x.com → 用一套假房源只发给这个邮箱的订阅，不动快照，不上网站。
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = path.join(__dirname, ".."), RV = require("../js/rent-vs.js");
const SITE = "https://howzu.com.au", STATE = path.join(root, "data/alerts/state.json");
const cfg = (() => { const s = fs.readFileSync(path.join(root, "js/config.js"), "utf8"); return { url: (s.match(/SUPABASE_URL\s*:\s*["']([^"']+)/) || [])[1] }; })();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY, RESEND = process.env.RESEND_API_KEY, SECRET = process.env.ALERT_SECRET || (KEY ? require("crypto").createHash("sha256").update("howzu-alert:" + KEY).digest("hex") : "");
const FROM = process.env.ALERT_FROM || "好租 Howzu <alerts@howzu.com.au>", TEST = process.env.ALERT_TEST === "1", TEST_EMAIL = (process.env.ALERT_TEST_EMAIL || "").toLowerCase();
const today = () => new Date(Date.now() + 11 * 3600e3).toISOString().slice(0, 10); // 墨尔本日期（夏令时近似，够用）

const token = id => crypto.createHmac("sha256", SECRET || "x").update(String(id)).digest("hex").slice(0, 32);
const emailOf = s => ((s.description || "").match(/^email:(\S+)$/m) || [])[1] || "";
const tag = (s, k) => ((s.highlights || []).find(h => h.startsWith(k + ":")) || "").slice(k.length + 1);
// 订阅条件匹配：区（空 = 全墨尔本，不分大小写，“Melbourne”和“Melbourne CBD”算同一区）、几房（≥）、周租上限（≤）
function matches(s, x) {
  const n = v => String(v || "").toLowerCase().replace(/\s+cbd$/, "").trim();
  const subs = String(s.suburb || "").split(/[,，、]/).map(n).filter(Boolean);
  if (subs.length && !subs.includes(n(x.suburb))) return false;
  if (s.beds != null && Number(x.beds) < Number(s.beds)) return false;
  if (s.rent_weekly != null && !(Number(x.rentWeekly) <= Number(s.rent_weekly))) return false;
  return Number(x.rentWeekly) > 0;
}
// 新上线 / 降价（对比上一次快照）；没有快照时只建快照，不发信
function events(live, snap) {
  const ev = [];
  for (const x of live) {
    const was = snap[x.id];
    if (was == null) ev.push({ x, why: "new" });
    else if (Number(x.rentWeekly) < Number(was)) ev.push({ x, why: "drop", from: Number(was) });
  }
  return ev;
}
function emailHtml(sub, items, C) {
  const lang = tag(sub, "lang") === "en" ? "en" : "zh", u = (url) => url + (url.includes("?") ? "&" : "?") + "utm_source=alert&utm_medium=email&utm_campaign=match";
  const unsub = `${SITE}/unsub.html?s=${sub.id}&t=${token(sub.id)}`;
  const rows = items.map(({ x, why, from }) => {
    const r = RV.match(x, C), vs = r ? RV.short(r) : "";
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee"><a href="${u(x.url)}" style="font-size:16px;font-weight:700;color:#0f6b4f;text-decoration:none">${esc(x.title)}</a>
      <div style="font-size:14px;color:#333;margin-top:4px">$${x.rentWeekly}/周${why === "drop" ? `（降价，原 $${from}）` : "（新上线）"} · ${esc(x.suburb || "")} · ${x.beds != null ? x.beds + " 房" : ""}${x.available ? " · " + esc(x.available) + " 起可入住" : ""}</div>
      ${vs ? `<div style="font-size:13px;color:#666">📊 ${esc(vs)}（DFFH 本区中位数）</div>` : ""}</td></tr>`;
  }).join("");
  const where = sub.suburb || "全墨尔本";
  return { subject: `好租新房源：${where}${items.length > 1 ? " 等 " + items.length + " 套" : " · " + items[0].x.title}`.slice(0, 120), unsub,
    html: `<div style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:560px;margin:auto;color:#1d2b26">
    <h2 style="color:#0f6b4f;font-size:19px">🔔 有符合你条件的房源</h2><p style="font-size:14px;color:#555">订阅条件：${esc(where)}${sub.beds != null ? " · " + sub.beds + " 房及以上" : ""}${sub.rent_weekly != null ? " · 周租 $" + sub.rent_weekly + " 以内" : ""}</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="margin:18px 0"><a href="${u(SITE + "/rentals.html")}" style="background:#0f6b4f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700">看全部在租房源</a></p>
    <p style="font-size:12px;color:#888;line-height:1.6">你收到这封邮件，是因为你在好租 howzu.com.au 订阅了“有新房通知我”并勾选同意接收房源邮件。<br>
    发件人：好租 Howzu（howzu.com.au，由 Cendant Property 运营），电话 0431 438 595。<br>
    <a href="${unsub}" style="color:#888">一键退订</a>（点一下就退，不用登录）</p></div>` };
}
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function sb(pathq, opt = {}) {
  const r = await fetch(`${cfg.url}/rest/v1/${pathq}`, Object.assign({}, opt, { headers: Object.assign({ apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, opt.headers || {}) }));
  if (!r.ok) throw new Error(`Supabase ${r.status} ${pathq.split("?")[0]}`);
  return r.status === 204 ? null : r.json();
}
async function send(to, m) {
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: m.subject, html: m.html, headers: { "List-Unsubscribe": `<${m.unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }) });
  if (!r.ok) throw new Error("Resend " + r.status + " " + (await r.text()).slice(0, 200));
}
function liveListings(sbRows) {
  const J = JSON.parse(fs.readFileSync(path.join(root, "data/listings.json"), "utf8")).listings
    .filter(x => x.status === "live" && Number(x.rentWeekly) > 0)
    .map(x => ({ id: x.id, title: x.title, suburb: x.suburb, beds: x.beds, rentWeekly: x.rentWeekly, available: x.available, kind: x.kind, highlights: x.highlights, address: x.address, url: `${SITE}/rent/${x.id}.html` }));
  const S = (sbRows || []).filter(x => Number(x.rent_weekly) > 0).map(x => ({ id: x.id, title: x.title, suburb: x.suburb, beds: x.beds, rentWeekly: x.rent_weekly, available: x.available, kind: x.kind, highlights: x.highlights, address: x.address, url: `${SITE}/rentals.html?id=${x.id}` }));
  return J.concat(S);
}
async function main() {
  if (!KEY || !RESEND || !SECRET || !cfg.url) { console.log("找房订阅：缺少密钥（SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY），这次跳过。"); return; }
  // 1 退订
  const uns = await sb(`listings?kind=eq.${encodeURIComponent("退订")}&select=id,description`);
  let nUn = 0;
  for (const u of uns) {
    const s = ((u.description || "").match(/^sub:(\S+)$/m) || [])[1], t = ((u.description || "").match(/^t:(\S+)$/m) || [])[1];
    if (s && t && crypto.timingSafeEqual(Buffer.from(token(s)), Buffer.from((t + "0".repeat(32)).slice(0, 32)))) {
      await sb(`listings?id=eq.${s}&kind=eq.${encodeURIComponent("找房订阅")}`, { method: "PATCH", body: JSON.stringify({ status: "rejected", review_note: "本人一键退订 " + today() }), headers: { Prefer: "return=minimal" } }); nUn++;
    }
    await sb(`listings?id=eq.${u.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  }
  // 2 订阅和房源
  const subs = await sb(`listings?kind=eq.${encodeURIComponent("找房订阅")}&status=eq.pending&select=id,created_at,suburb,beds,rent_weekly,highlights,description`);
  const C = RV.compact(JSON.parse(fs.readFileSync(path.join(root, "data/rent_check.json"), "utf8")));
  const st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { snap: null, sent: {}, queue: {} };
  let live;
  if (TEST) live = [{ id: "test-0001", title: "【测试】Carlton · 两房一卫公寓", suburb: "Carlton", beds: 2, rentWeekly: 650, available: "2026-12-20", url: `${SITE}/rentals.html`, address: "1/1 Test St, Carlton" }];
  else live = liveListings(await sb(`listings?status=eq.live&select=id,title,suburb,beds,rent_weekly,available,kind,highlights,address&kind=not.in.(${encodeURIComponent('"求租需求","房东托管咨询","买房咨询","回电请求","代看房","找房订阅","退订","待房东确认"')})`));
  if (!TEST && !st.snap) { st.snap = Object.fromEntries(live.map(x => [x.id, x.rentWeekly])); save(st); console.log("第一次运行：只建快照", live.length, "套，不发信。"); return; }
  const ev = TEST ? live.map(x => ({ x, why: "new" })) : events(live, st.snap);
  // 3 匹配进每人的队列（只算订阅之后出现的变化：快照每小时更新，自然满足）
  const day = today(); let nMail = 0, nSkip = 0;
  for (const s of subs) {
    const to = emailOf(s); if (!to) continue;
    if (TEST && to !== TEST_EMAIL) continue;
    const q = TEST ? [] : (st.queue[s.id] || []);
    for (const e of ev) if (matches(s, e.x) && !q.some(y => y.id === e.x.id)) q.push({ id: e.x.id, why: e.why, from: e.from });
    if (!q.length) { delete st.queue[s.id]; continue; }
    if (!TEST && st.sent[s.id] === day) { st.queue[s.id] = q; nSkip++; continue; } // 今天已发过 → 明天合并发
    const byId = Object.fromEntries(live.map(x => [x.id, x]));
    const items = q.map(y => ({ x: byId[y.id], why: y.why, from: y.from })).filter(y => y.x && matches(s, y.x)); // 已下架或不再符合的去掉
    if (!items.length) { delete st.queue[s.id]; continue; }
    await send(to, emailHtml(s, items.slice(0, 12), C)); nMail++;
    if (!TEST) { st.sent[s.id] = day; delete st.queue[s.id]; }
  }
  if (!TEST) { st.snap = Object.fromEntries(live.map(x => [x.id, x.rentWeekly])); const ids = new Set(subs.map(s => s.id)); for (const k of Object.keys(st.sent)) if (!ids.has(k)) delete st.sent[k]; for (const k of Object.keys(st.queue)) if (!ids.has(k)) delete st.queue[k]; save(st); }
  console.log(`找房订阅：订阅 ${subs.length} 个，退订 ${nUn} 个，房源变化 ${ev.length} 条，发信 ${nMail} 封，留到明天 ${nSkip} 人${TEST ? "（测试模式）" : ""}`);
}
function save(st) { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(st, null, 0) + "\n"); }
module.exports = { matches, events, emailHtml, token };
if (require.main === module) main().catch(e => { console.error("找房订阅出错：", e.message); process.exit(1); });
