// 好租核心数字自动读数（ROADMAP 1f）：每天在 GitHub Actions 上跑。node tools/stats.js
// 用已有的 SUPABASE_SERVICE_ROLE_KEY（找房订阅已在用）只读 pageviews 和 listings 两张表，算出汇总数，
// 写 data/stats.json（只有数字，没有任何姓名、电话、微信、邮箱、原文），并刷新 METRICS.md 里「自动读数」一段；
// 墨尔本时间周一另在主表追加一行。不改表结构、不写数据库、不需要 Frank 在 SQL 页点 Run。
// 缺密钥就跳过，不报错。测试：node tools/test-stats.js（用假数据，不连网）。
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");

// 询盘 = 真正联系我们的动作（和 admin.html「访问统计」同一口径）
const CONTACT = /^(call|sms|wechat|book-send|lead-send|owner-lead|ask-tbc|callback)(:|@|$)/;
const LEAD_KINDS = ["求租需求", "房东托管咨询", "买房咨询", "回电请求", "代看房", "找房订阅"];
const CH = { google: "Google", search: "其它搜索", xiaohongshu: "小红书", facebook: "Facebook", wechat: "微信", direct: "直接", alert: "订阅邮件" };
const refCh = h => { h = String(h || ""); if (!h) return "直接"; if (/(^|\.)google\./.test(h)) return "Google"; if (/xiaohongshu|xhslink/.test(h)) return "小红书";
  if (/facebook|fb\.com|instagram/.test(h)) return "Facebook"; if (/wechat|weixin/.test(h)) return "微信"; if (/bing|baidu|duckduckgo|yahoo/.test(h)) return "其它搜索"; return h; };
const evCh = ev => { const c = String(ev || "").split("@")[1]; return c ? (CH[c] || c) : "未记录"; };
const melDay = t => new Date(t).toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
const top = (arr, f, n = 3) => { const m = new Map(); arr.forEach(r => { const k = f(r); if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1]).slice(0, n); };
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), i = s.length >> 1; return s.length % 2 ? s[i] : Math.round((s[i - 1] + s[i]) / 2); };
const MIN_CELL = 3; // 隐私门槛：一格少于 3 条不单独显示

// 纯函数：输入原始行，输出只含汇总数的对象
function summarize({ pv = [], leads = [], own = [], pub = [], now = Date.now() }) {
  const t30 = now - 30 * 864e5, t60 = now - 60 * 864e5;
  const P = pv.filter(r => Date.parse(r.at) >= t30);
  const V = P.filter(r => r.ev === "view" && !/^404 /.test(r.path || "")), E = P.filter(r => r.ev && r.ev !== "view"), Q = E.filter(r => CONTACT.test(r.ev));
  const L30 = leads.filter(x => Date.parse(x.created_at) >= t30);
  const byKind = {}; LEAD_KINDS.forEach(k => { byKind[k] = L30.filter(x => x.kind === k).length; });
  const ownLive = own.filter(x => x.status === "live"), ids = new Set(ownLive.map(x => String(x.id)));
  const pubLive = pub.filter(x => x.status === "live" && !ids.has(String(x.id)) && !LEAD_KINDS.includes(x.kind));
  const isSA = r => /^\/guide\/study-abroad\.html/.test(r.path || ""), isB = r => /^\/building\//.test(r.path || "");
  // 求租需求热度（近 60 天）：区 × 几房，少于 3 条的并入“其它”，不出现任何联系方式或原文
  const D60 = leads.filter(x => x.kind === "求租需求" && Date.parse(x.created_at) >= t60);
  const cell = x => `${String(x.suburb || "区域不限").trim().slice(0, 40)}|${x.beds == null ? "不限" : x.beds === 0 ? "单间" : x.beds + "房"}`;
  const cells = new Map(); D60.forEach(x => { const k = cell(x); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(x.rent_weekly || 0); });
  const demand = [], other = [];
  [...cells].forEach(([k, b]) => { if (b.length >= MIN_CELL) { const [area, room] = k.split("|"); demand.push({ area, room, n: b.length, budgetMedian: median(b.filter(Boolean)) }); } else other.push(...b); });
  demand.sort((a, b) => b.n - a.n);
  return {
    updated: melDay(now), window: "近 30 天（需求热度近 60 天）",
    views30: V.length, enquiries30: Q.length, conversionPct: V.length ? +(Q.length / V.length * 100).toFixed(1) : 0,
    mobilePct: V.length ? Math.round(V.filter(r => r.mobile).length / V.length * 100) : 0,
    viewChannels: top(V, r => refCh(r.ref)), enquiryChannels: top(Q, r => evCh(r.ev)),
    forms30: byKind, // 表单留资（回电、求租、托管、代看房、订阅……）条数
    liveListings: ownLive.length + pubLive.length, liveOwn: ownLive.length, livePublic: pubLive.length,
    studyAbroad: { views: V.filter(isSA).length, inspectOpen: E.filter(r => /^inspect:open/.test(r.ev)).length, inspectBook: E.filter(r => /^inspect:book/.test(r.ev)).length,
      enquiries: Q.filter(isSA).length, inspectRows: byKind["代看房"], channels: top(V.filter(isSA), r => refCh(r.ref)) },
    building: { views: V.filter(isB).length, enquiries: Q.filter(isB).length, subs: E.filter(r => isB(r) && /^alert:sub/.test(r.ev)).length },
    alerts: { subscribers: leads.filter(x => x.kind === "找房订阅" && x.status === "pending").length, views: V.filter(r => /utm_source=alert/.test(r.path || "") || /@alert$/.test(r.ev || "")).length, enquiries: Q.filter(r => /@alert$/.test(r.ev)).length },
    demand60: { total: D60.length, cells: demand, otherN: other.length, budgetMedianAll: median(D60.map(x => x.rent_weekly).filter(Boolean)) },
  };
}

const fmtCh = a => a.length ? a.map(([k, n]) => `${k} ${n}`).join("、") : "—";
function metricsBlock(s) {
  return [
    "<!-- auto-stats:start（tools/stats.js 每天自动写，别手改） -->",
    `## 📊 自动读数（${s.updated}，近 30 天，每天更新）`,
    `- **月访问量** ${s.views30} 次浏览（手机 ${s.mobilePct}%）· **月询盘** ${s.enquiries30} 次（转化 ${s.conversionPct}%）· **在线房源** ${s.liveListings} 套（自管 ${s.liveOwn} + 房东发布 ${s.livePublic}）`,
    `- 浏览渠道前三：${fmtCh(s.viewChannels)}；询盘渠道前三：${fmtCh(s.enquiryChannels)}`,
    `- 表单留资：${Object.entries(s.forms30).map(([k, n]) => `${k} ${n}`).join("、")}`,
    `- 开学季专区：访问 ${s.studyAbroad.views} · 询盘 ${s.studyAbroad.enquiries} · 代看房入口点击 ${s.studyAbroad.inspectOpen} → 提交 ${s.studyAbroad.inspectBook}（代看房预约 ${s.studyAbroad.inspectRows} 条）· 渠道 ${fmtCh(s.studyAbroad.channels)}`,
    `- 楼盘百科：浏览 ${s.building.views} · 询盘 ${s.building.enquiries} · 楼盘订阅 ${s.building.subs}；找房订阅 ${s.alerts.subscribers} 人，订阅邮件带来浏览 ${s.alerts.views}、询盘 ${s.alerts.enquiries}`,
    `- 求租需求（近 60 天）${s.demand60.total} 条，预算中位数 ${s.demand60.budgetMedianAll ? "$" + s.demand60.budgetMedianAll + "/周" : "—"}${s.demand60.cells.length ? "；热门：" + s.demand60.cells.slice(0, 5).map(c => `${c.area} ${c.room} ${c.n} 条`).join("、") : ""}`,
    "<!-- auto-stats:end -->",
  ].join("\n");
}
function weeklyRow(s) {
  return `| ${s.updated}（自动） | ${s.views30} | ${s.enquiries30} | ${s.liveListings} 套（自管 ${s.liveOwn} + 房东 ${s.livePublic}） | 待核 | 浏览：${fmtCh(s.viewChannels)} / 询盘：${fmtCh(s.enquiryChannels)} | ${s.forms30["房东托管咨询"]} | 待核 | tools/stats.js 自动读数 |`;
}
// 把自动段落放到 METRICS.md 第一张表前面；周一在主表末尾追加一行（同一天不重复）
function updateMetrics(md, s, isMonday) {
  const blk = metricsBlock(s), re = /<!-- auto-stats:start[\s\S]*?<!-- auto-stats:end -->/;
  md = re.test(md) ? md.replace(re, blk) : md.replace(/\n(\| 周（周一）)/, "\n" + blk + "\n\n$1");
  if (isMonday && !md.includes(`| ${s.updated}（自动）`)) {
    const lines = md.split("\n"), h = lines.findIndex(l => l.startsWith("| 周（周一） | 月访问量"));
    if (h >= 0) { let i = h + 2; while (i < lines.length && lines[i].startsWith("|")) i++; lines.splice(i, 0, weeklyRow(s)); md = lines.join("\n"); }
  }
  return md;
}

async function main() {
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = (fs.readFileSync(path.join(root, "js/config.js"), "utf8").match(/SUPABASE_URL\s*:\s*["']([^"']+)/) || [])[1];
  if (!KEY || !url) { console.log("自动读数：缺少 SUPABASE_SERVICE_ROLE_KEY，这次跳过。"); return; }
  const H = { apikey: KEY, Authorization: "Bearer " + KEY };
  async function all(q) { // 分页读完（每页 1000 行）
    const out = []; for (let from = 0; from < 200000; from += 1000) {
      const r = await fetch(`${url}/rest/v1/${q}`, { headers: Object.assign({ Range: `${from}-${from + 999}`, "Range-Unit": "items" }, H) });
      if (!r.ok) throw new Error(`Supabase ${r.status} ${q.split("?")[0]}`);
      const j = await r.json(); out.push(...j); if (j.length < 1000) break;
    } return out;
  }
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString(), since60 = new Date(Date.now() - 60 * 864e5).toISOString();
  const kinds = encodeURIComponent(`(${LEAD_KINDS.map(k => `"${k}"`).join(",")})`);
  const [pv, leads, pub] = await Promise.all([
    all(`pageviews?select=at,path,ref,mobile,ev&at=gte.${since30}&order=at.asc`),
    // 只取统计要用的列：不取联系方式、描述原文
    all(`listings?select=kind,status,created_at,suburb,beds,rent_weekly&kind=in.${kinds}&or=(created_at.gte.${since60},kind.eq.${encodeURIComponent("找房订阅")})`),
    all(`listings?select=id,kind,status&status=eq.live`),
  ]);
  const own = (JSON.parse(fs.readFileSync(path.join(root, "data/listings.json"), "utf8")).listings || []);
  const s = summarize({ pv, leads, own, pub });
  fs.writeFileSync(path.join(root, "data/stats.json"), JSON.stringify(s, null, 1) + "\n");
  const wd = new Date().toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne", weekday: "short" });
  const mp = path.join(root, "METRICS.md");
  fs.writeFileSync(mp, updateMetrics(fs.readFileSync(mp, "utf8"), s, wd === "Mon"));
  console.log(`自动读数：浏览 ${s.views30}，询盘 ${s.enquiries30}，在线房源 ${s.liveListings}（pageviews ${pv.length} 行，留资 ${leads.length} 行）`);
}
if (require.main === module) main().catch(e => { console.error("自动读数失败：", e.message); process.exit(1); });
module.exports = { summarize, updateMetrics, metricsBlock, CONTACT };
