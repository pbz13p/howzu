// 把中介房源的询盘转一份给那家中介（询盘照常留在好租后台）。每 2 小时跟着 feeds.yml 跑。
// 只转 data/feeds.json 里 forward: true 且填了 leadEmail 的中介；默认关，Frank 和中介谈好后再打开。
// 用 Resend 从 alerts@howzu.com.au 发；租客的联系方式只进邮件，不进仓库、不进日志。
// 记账：data/feeds-state.json 只记“上次处理到哪个时间”和“每月给每家转了几个”（数字，没有个人信息）。
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), STATE = path.join(root, "data/feeds-state.json");
const LEAD_KINDS = ["求租需求", "回电请求", "代看房"]; // 预约看房也存成“求租需求”（描述里带房源 id）

// 询盘描述里出现了哪套中介房源的 id
function matchLeads(leads, listings) {
  const out = [];
  for (const l of leads) { const d = String(l.description || "") + " " + String(l.title || ""); const x = listings.find(x => d.includes(x.id)); if (x) out.push([l, x]); }
  return out;
}
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function emailHtml(ag, lead, x, nThisMonth) {
  return `<div style="font-family:-apple-system,'PingFang SC',Arial,sans-serif;max-width:560px;color:#1d2b26">
<h2 style="color:#0f6b4f;font-size:18px">New enquiry from Howzu 好租 · 新询盘</h2>
<p style="font-size:14px">Listing / 房源：<b>${esc(x.title)}</b><br>${esc(x.address)}<br><a href="https://howzu.com.au/rentals.html?id=${encodeURIComponent(x.id)}">View on Howzu</a></p>
<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;background:#f3f8f5;padding:12px;border-radius:8px">${esc(lead.description || lead.title)}</pre>
<p style="font-size:12px;color:#777">Sent by Howzu 好租 (howzu.com.au, operated by Cendant Property, 0431 438 595) because ${esc(ag.name)} authorised Howzu to display this listing. This is enquiry #${nThisMonth} forwarded to you this month. Reply to the tenant directly using the details above. To stop, just tell Frank Peng.</p></div>`;
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "data/feeds.json"), "utf8"));
  const ags = (cfg.agencies || []).filter(a => a.active !== false && a.forward === true && /@/.test(a.leadEmail || ""));
  if (!ags.length) { console.log("询盘转发：没有打开转发的中介，跳过"); return; }
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY, RK = process.env.RESEND_API_KEY;
  if (!KEY || !RK) { console.log("询盘转发：缺 SUPABASE_SERVICE_ROLE_KEY 或 RESEND_API_KEY，跳过"); return; }
  const url = (/SUPABASE_URL:\s*"([^"]+)"/.exec(fs.readFileSync(path.join(root, "js/config.js"), "utf8")) || [])[1];
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const S = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {};
  S.monthly = S.monthly || {};
  const since = S.lastLeadAt || new Date(Date.now() - 2 * 864e5).toISOString();
  const leads = await (await fetch(`${url}/rest/v1/listings?select=id,kind,title,description,created_at&kind=in.(${LEAD_KINDS.map(encodeURIComponent).join(",")})&created_at=gt.${encodeURIComponent(since)}&order=created_at.asc&limit=500`, { headers: H })).json();
  if (!Array.isArray(leads)) { console.log("询盘转发：读询盘失败，跳过"); return; }
  const month = new Date().toISOString().slice(0, 7); S.monthly[month] = S.monthly[month] || {};
  for (const ag of ags) {
    const L = await (await fetch(`${url}/rest/v1/listings?select=id,title,address&review_note=like.${encodeURIComponent(`feed:${ag.key}:*`)}&limit=2000`, { headers: H })).json();
    for (const [lead, x] of matchLeads(leads, Array.isArray(L) ? L : [])) {
      const n = (S.monthly[month][ag.key] || 0) + 1;
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RK}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.ALERT_FROM || "好租 Howzu <alerts@howzu.com.au>", to: [ag.leadEmail], subject: `Howzu 好租 enquiry: ${x.address}`.slice(0, 150), html: emailHtml(ag, lead, x, n) }) });
      if (r.ok) S.monthly[month][ag.key] = n; else console.log(`  转给 ${ag.name} 失败 HTTP ${r.status}`);
    }
    console.log(`询盘转发：${ag.name} 本月已转 ${S.monthly[month][ag.key] || 0} 个`);
  }
  if (leads.length) S.lastLeadAt = leads[leads.length - 1].created_at;
  fs.writeFileSync(STATE, JSON.stringify(S, null, 1) + "\n");
}
if (require.main === module) main().catch(e => console.log("询盘转发出错：" + e.message));
module.exports = { matchLeads, emailHtml, LEAD_KINDS };
