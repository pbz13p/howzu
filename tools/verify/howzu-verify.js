#!/usr/bin/env node
// 好租固定验证工具：像真实用户一样在手机尺寸上走一遍关键流程，留下截图和证据。
// 用法见 .claude/skills/verify-howzu/SKILL.md。
//
//   node tools/verify/howzu-verify.js run              本地起站，跑全部流程，自动清理
//   node tools/verify/howzu-verify.js run book owner   只跑指定流程
//   node tools/verify/howzu-verify.js run --live       对线上 howzu.com.au 跑（只读）
//   node tools/verify/howzu-verify.js doctor [--live]  只检查网站能不能开
//   node tools/verify/howzu-verify.js list             列出全部流程
//
// 安全：所有写 Supabase 的请求（发房源、留需求、回电、访问统计）都在浏览器里被拦下，
// 不会写进数据库，只把“本来要写什么”存成证据。读数据照常。
// 证据放在 .verify/<时间>/（已在 .gitignore），清理时不删。

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

let playwright;
try { playwright = require("playwright"); } catch (_) {
  try { playwright = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")); }
  catch (e) { console.error("缺 Playwright：先运行 npm i -g playwright && npx playwright install chromium"); process.exit(2); }
}

const ROOT = path.resolve(__dirname, "../..");
const LIVE_URL = "https://howzu.com.au";
const PORT = 8761;
const args = process.argv.slice(2);
const cmd = args[0] || "run";
const live = args.includes("--live");
const only = args.slice(1).filter(a => !a.startsWith("--"));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outArg = args.find(a => a.startsWith("--out="));
const OUT = outArg ? path.resolve(outArg.slice(6)) : path.join(ROOT, ".verify", stamp + (live ? "-live" : "-local"));
const BASE = live ? LIVE_URL : `http://127.0.0.1:${PORT}`;

const PHONE_SIZES = [{ name: "390", width: 390, height: 844 }, { name: "360", width: 360, height: 780 }];
const TEST_CONTACT = "0400 000 000"; // 验证专用，不是真人号码

// ---------- 启动 / 自检 / 清理 ----------
let server = null;
function get(url) {
  return new Promise(res => {
    const lib = url.startsWith("https") ? require("https") : http;
    const req = lib.get(url, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => res({ status: r.statusCode, body: b })); });
    req.on("error", e => res({ status: 0, body: String(e.message) }));
    req.setTimeout(15000, () => { req.destroy(); res({ status: 0, body: "超时" }); });
  });
}
async function launch() {
  if (live) return;
  const busy = await get(`${BASE}/index.html`);
  if (busy.status) throw new Error(`端口 ${PORT} 已被别的程序占用，不在别人的实例上跑。先关掉它，或改 PORT。`);
  server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 250));
    const r = await get(`${BASE}/index.html`);
    if (r.status === 200 && r.body.includes("好租")) return;
  }
  throw new Error("本地网站 10 秒内没起来");
}
async function doctor() {
  const checks = [];
  for (const p of ["/index.html", "/rentals.html", "/rents.html", "/post.html", "/data/listings.json", "/data/rent_check.json", "/js/config.js"]) {
    const r = await get(BASE + p);
    checks.push({ page: p, ok: r.status === 200, status: r.status });
  }
  let commit = "";
  try { commit = require("child_process").execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim(); } catch (_) {}
  return { base: BASE, commit: live ? "（线上版本）" : commit, ok: checks.every(c => c.ok), checks };
}
function cleanup() { if (server) { server.kill(); server = null; } }
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });

// ---------- 浏览器和证据 ----------
let browser;
async function phone(size = PHONE_SIZES[0], mobile = true) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: mobile, hasTouch: mobile, locale: "zh-CN", timezoneId: "Australia/Melbourne" });
  // 复制到剪贴板的内容记下来当证据
  await ctx.addInitScript(() => {
    window.__copied = [];
    try { const c = navigator.clipboard; if (c) c.writeText = t => { window.__copied.push(t); return Promise.resolve(); }; } catch (_) {}
    const ex = document.execCommand.bind(document);
    document.execCommand = (c, ...a) => { if (c === "copy") window.__copied.push((document.activeElement && document.activeElement.value) || String(getSelection())); return ex(c, ...a); };
  });
  const page = await ctx.newPage();
  const ev = { errors: [], writes: [], opened: [], blocked: [] };
  page.on("pageerror", e => ev.errors.push(e.message));
  // 外部脚本（如 esm.sh 上的 Supabase 库）加载失败：多半是运行环境的网络限制，单独记下，别当成网站的错
  page.on("requestfailed", r => { const u = r.url(); if (!u.startsWith(BASE) && !/supabase\.co/.test(u) && ["script", "stylesheet"].includes(r.resourceType())) ev.blocked.push(new URL(u).host); });
  page.on("request", r => { if (/^(sms|tel|mailto):/.test(r.url())) ev.opened.push(decodeURIComponent(r.url())); });
  await page.route(/supabase\.co/, route => {
    const q = route.request();
    if (q.method() === "GET" || q.method() === "HEAD" || q.method() === "OPTIONS") return route.continue();
    let body = q.postData() || "";
    try { body = JSON.parse(body); } catch (_) { body = body.length > 300 ? `（二进制 ${body.length} 字节）` : body; }
    ev.writes.push({ method: q.method(), url: q.url().replace(/^https:\/\/[^/]+/, ""), body });
    const json = /\/storage\//.test(q.url()) ? { Key: "verify/fake.jpg" } : [];
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(json) });
  });
  return { ctx, page, ev };
}
async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
const slug = s => s.replace(/[^\w.-]+/g, "_").slice(0, 60);

// ---------- 流程（功能地图里每个文件对应这里一个流程） ----------
const J = {};

// 房源一致性：每套在租房源的周租，在首页、租房列表、房源页三处必须一样
J.listings = async (t) => {
  const L = JSON.parse((await get(BASE + "/data/listings.json")).body).listings.filter(x => x.status === "live");
  t.note(`在租房源 ${L.length} 套：${L.map(x => x.id).join("、")}`);
  const { ctx, page } = await t.phone();
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  const home = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map(a => ({ href: a.getAttribute("href"), text: a.innerText })));
  await t.shot(page, "首页");
  await page.goto(BASE + "/rentals.html", { waitUntil: "networkidle" });
  const list = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map(a => ({ href: a.getAttribute("href"), text: a.innerText })));
  await t.shot(page, "租房列表");
  for (const x of L) {
    const want = `$${x.rentWeekly}`;
    t.check(!!x.rentWeekly, `${x.id} 写了固定周租`);
    const h = home.find(a => a.href.includes(x.id) && /\$\d/.test(a.text));
    t.check(h && h.text.includes(want), `${x.id} 首页卡片周租 = ${want}`, h ? h.text.replace(/\s+/g, " ").slice(0, 80) : "首页找不到这套");
    const l = list.find(a => a.href.includes(x.id) && /\$\d/.test(a.text));
    t.check(l && l.text.includes(want), `${x.id} 租房列表周租 = ${want}`, l ? l.text.replace(/\s+/g, " ").slice(0, 80) : "列表找不到这套");
    const r = await page.goto(`${BASE}/rent/${x.id}.html`, { waitUntil: "domcontentloaded" });
    t.check(r && r.status() === 200, `${x.id} 房源页能打开`);
    const body = await page.locator("main, body").first().innerText();
    t.check(body.includes(want), `${x.id} 房源页周租 = ${want}`);
    t.check(await page.getByRole("link", { name: "📅 预约看房" }).count() > 0, `${x.id} 房源页底部有“预约看房”`);
  }
  await ctx.close();
};

// 预约看房：房源页 → 预约看房 → 选日期和时间 → 发送，短信里带房源编号和时间
J.book = async (t) => {
  const id = await t.firstLive();
  const { ctx, page, ev } = await t.phone();
  await page.goto(`${BASE}/rent/${id}.html`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "📅 预约看房" }).click(); t.clicks++;
  await page.waitForLoadState("networkidle");
  const d = page.getByRole("dialog", { name: "预约看房" });
  await d.waitFor({ timeout: 8000 });
  const day = d.getByRole("button", { name: /^周[六日]/ }).first();
  const dayText = (await day.innerText()).replace(/\s+/g, " ");
  await day.click(); t.clicks++;
  await d.getByRole("button", { name: /下午 2点/ }).click(); t.clicks++;
  await t.shot(page, "预约看房-选好时间");
  await d.getByRole("button", { name: "发送预约" }).click(); t.clicks++;
  await page.waitForTimeout(800);
  const sms = ev.opened.find(u => u.startsWith("sms:")) || "";
  t.save("打开的短信.txt", sms);
  t.check(sms.includes(`房源编号 ${id}`), "短信里有房源编号", sms.slice(0, 120));
  t.check(/下午 2 点/.test(sms), `短信里有选的时间（${dayText} 下午 2 点）`);
  t.check(t.clicks <= 4, `从房源页到发出预约 ≤ 4 次点击（实际 ${t.clicks}）`);
  t.check(ev.errors.length === 0, "没有页面报错", ev.errors.join(" | "));
  await ctx.close();
};

// 房东卡片：查租金页 → 选区和房型 → 看到中位数和数据日期 → 免费上架，发房源页已预填
J.landlord = async (t) => {
  const { ctx, page, ev } = await t.phone();
  await page.goto(BASE + "/rents.html", { waitUntil: "networkidle" });
  const card = page.locator("#llCard");
  await card.getByRole("combobox", { name: "区" }).selectOption({ label: "Box Hill" }); t.clicks++;
  await card.getByRole("combobox", { name: "房型" }).selectOption({ label: "2 房公寓" }); t.clicks++;
  const res = (await card.locator("#llR").innerText()).replace(/\s+/g, " ");
  t.save("估租金结果.txt", res);
  const m = res.match(/约 \$(\d+) \/ 周/);
  t.check(!!m, "显示周租中位数", res.slice(0, 80));
  t.check(/截至/.test(res) && /DFFH/.test(res), "写了数据日期和来源（DFFH）");
  t.check(!/\$\d+\s*[-–~]\s*\$?\d+/.test(res), "没有编造租金区间");
  await card.scrollIntoViewIfNeeded(); await t.shot(page, "房东卡片");
  await card.getByRole("link", { name: "免费上架到好租" }).click(); t.clicks++;
  await page.waitForURL(/post\.html/); await page.waitForLoadState("networkidle");
  t.check(/rent=\d+/.test(page.url()) && /suburb=Box/i.test(page.url()), "跳转网址带上了区和周租");
  if (ev.blocked.some(h => h.includes("esm.sh"))) { t.note("发房源页预填没验证：运行环境连不上 esm.sh（线上每日巡检会验证）"); await ctx.close(); return; }
  const rent = await page.locator("#rent").inputValue();
  t.check(m && rent === m[1], `发房源页周租已预填 = ${m && m[1]}`, `实际：${rent}`);
  const addr = await page.locator("#addr").inputValue();
  t.save("预填.txt", `网址：${page.url()}\n周租：${rent}\n地址框：${addr}`);
  t.check(/suburb=Box/i.test(page.url()), "区已带到发房源页");
  await t.shot(page, "发房源页-预填");
  t.check(t.clicks <= 3, `查租金到上架 ≤ 3 次点击（实际 ${t.clicks}）`);
  t.check(ev.errors.length === 0, "没有页面报错", ev.errors.join(" | "));
  await ctx.close();
};

// 房东托管留资：房东卡片 → 想找人托管 → 留电话 → 提交内容带来源“租金查询-房东”
J.owner = async (t) => {
  const { ctx, page, ev } = await t.phone();
  await page.goto(BASE + "/rents.html", { waitUntil: "networkidle" });
  const card = page.locator("#llCard");
  await card.getByRole("button", { name: "想找人托管" }).click();
  await card.getByPlaceholder("微信号或手机").fill(TEST_CONTACT);
  await card.locator("#llF button").first().click();
  await card.getByText("收到了").waitFor({ timeout: 8000 });
  await t.shot(page, "托管留资-提交后");
  const w = ev.writes.find(x => /rest\/v1\/listings/.test(x.url) && x.body && x.body.kind);
  t.save("提交内容.json", JSON.stringify(ev.writes, null, 2));
  t.check(w && w.body.kind === "房东托管咨询", "存为“房东托管咨询”", w && w.body.kind);
  t.check(w && JSON.stringify(w.body).includes("租金查询-房东"), "来源记为“租金查询-房东”");
  t.check(w && w.body.status === "pending", "状态是待处理（公众看不到）");
  t.check(ev.errors.length === 0, "没有页面报错", ev.errors.join(" | "));
  await ctx.close();
};

// 租客留需求：租房列表底部 → 填区、预算、房型、时间、联系方式 → 存为“求租需求”
J.tenant = async (t) => {
  const { ctx, page, ev } = await t.phone();
  await page.goto(BASE + "/rentals.html", { waitUntil: "networkidle" });
  const f = page.locator("form").filter({ has: page.getByRole("button", { name: "有新房通知我" }) });
  await f.getByRole("combobox", { name: "想住哪里" }).fill("Carlton");
  await f.getByRole("textbox", { name: "每周预算（澳元）" }).fill("650");
  await f.getByRole("button", { name: "2 房" }).click();
  await f.getByRole("button", { name: "越快越好" }).click();
  await f.getByRole("textbox", { name: "微信号、手机或邮箱" }).fill(TEST_CONTACT);
  await f.getByRole("button", { name: "有新房通知我" }).click();
  await page.waitForTimeout(1500);
  await t.shot(page, "留需求-提交后");
  t.save("提交内容.json", JSON.stringify(ev.writes, null, 2));
  const w = ev.writes.find(x => /rest\/v1\/listings/.test(x.url) && x.body && x.body.kind);
  t.check(w && w.body.kind === "求租需求", "存为“求租需求”", w ? w.body.kind : "没有提交");
  t.check(w && JSON.stringify(w.body).includes("650"), "预算 650 存进去了");
  t.check(w && JSON.stringify(w.body).includes("Carlton"), "想住的区 Carlton 存进去了");
  t.check(w && w.body.status === "pending", "状态是待处理（公众看不到）");
  t.check(ev.errors.length === 0, "没有页面报错", ev.errors.join(" | "));
  await ctx.close();
};

// 全站“联系我们”回电：房源页右下角 → 留电话 → 存为“回电请求”，话题自动是“租房”
J.callback = async (t) => {
  const id = await t.firstLive();
  const { ctx, page, ev } = await t.phone();
  await page.goto(`${BASE}/rent/${id}.html`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "💬 联系我们" }).click();
  await page.getByPlaceholder("你的电话或微信号").fill(TEST_CONTACT);
  await page.getByRole("button", { name: "请回电给我" }).click();
  await page.getByText("收到了").waitFor({ timeout: 8000 });
  await t.shot(page, "回电-提交后");
  t.save("提交内容.json", JSON.stringify(ev.writes, null, 2));
  const w = ev.writes.find(x => /rest\/v1\/listings/.test(x.url) && x.body && x.body.kind);
  t.check(w && w.body.kind === "回电请求", "存为“回电请求”");
  t.check(w && (w.body.highlights || []).includes("租房"), "房源页上默认话题是“租房”");
  t.check(w && w.body.contact_phone === TEST_CONTACT, "电话存进 contact_phone");
  t.check(ev.errors.length === 0, "没有页面报错", ev.errors.join(" | "));
  await ctx.close();
};

// 免费发房源：传照片 → 粘贴介绍自动填 → 补地址和联系方式 → 预览 → 确认发布，提交内容正确
J.post = async (t) => {
  const { ctx, page, ev } = await t.phone();
  await page.goto(BASE + "/post.html", { waitUntil: "networkidle" });
  if (t.envBlocked(ev, "esm.sh")) { await ctx.close(); return; }
  if (await page.locator("#closed").isVisible()) { t.check(false, "发布功能是开着的", "页面显示“马上开放”"); await ctx.close(); return; }
  await page.locator("#file").setInputFiles(path.join(ROOT, "photos", fs.readdirSync(path.join(ROOT, "photos")).find(f => /\.jpe?g$/.test(f) && !/-(480|960)\./.test(f))));
  await page.getByRole("textbox", { name: /例如：CBD 两房两卫/ }).fill("CBD 两房一卫，周租 $720，带家具包网，马上入住，租期一年");
  await page.waitForTimeout(800);
  const auto = await page.locator("body").innerText();
  t.check(/已帮你填好/.test(auto), "粘贴介绍后自动填好了");
  t.check((await page.locator("#rent").inputValue()) === "720", "周租自动识别为 720");
  await page.locator("#addr").fill("138 Spencer St Melbourne");
  await page.getByPlaceholder("微信号").fill("verify_test");
  for (let i = 0; i < 20 && await page.getByText("照片还在压缩").count(); i++) await page.waitForTimeout(500);
  await page.getByRole("button", { name: "发布" }).click();
  const pv = page.locator("#pv");
  try { await pv.waitFor({ state: "visible", timeout: 8000 }); } catch (_) {
    const err = await page.locator("#err").innerText().catch(() => "");
    t.check(false, "点发布后出现预览", err || "没有出现预览");
    await t.shot(page, "发房源-卡住"); await ctx.close(); return;
  }
  await t.shot(page, "发房源-预览");
  await page.locator("#pvYes").click();
  await page.getByText("提交成功").waitFor({ timeout: 15000 }).catch(() => {});
  await t.shot(page, "发房源-提交后");
  t.save("提交内容.json", JSON.stringify(ev.writes, null, 2));
  const up = ev.writes.filter(x => /\/storage\//.test(x.url));
  const row = ev.writes.find(x => /rest\/v1\/listings/.test(x.url) && x.body && x.body.address);
  t.check(up.length >= 1, `照片上传了（${up.length} 张）`);
  t.check(row && row.body.rent_weekly === 720, "提交的周租 = 720", row && String(row.body.rent_weekly));
  t.check(row && /Spencer/.test(row.body.address), "提交的地址正确");
  t.check(row && row.body.contact_wechat === "verify_test", "联系方式存进去了");
  t.check(row && !row.body.status || (row && row.body.status !== "live"), "提交后不会直接上线（要审核）", row && row.body.status);
  t.check(ev.errors.length === 0, "没有页面报错", ev.errors.join(" | "));
  await ctx.close();
};

// 英文界面：?lang=en 后标题变英文，选过会记住
J.english = async (t) => {
  const { ctx, page, ev } = await t.phone();
  await page.goto(BASE + "/rentals.html?lang=en", { waitUntil: "networkidle" });
  const h = await page.getByRole("heading", { level: 1 }).first().innerText();
  t.check(!/[一-鿿]/.test(h), "租房页标题是英文", h);
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  const h2 = await page.getByRole("heading", { level: 1 }).first().innerText();
  t.check(!/[一-鿿]/.test(h2), "换页后仍是英文（记住了选择）", h2);
  await t.shot(page, "英文首页");
  t.check(ev.errors.length === 0, "没有页面报错", ev.errors.join(" | "));
  await ctx.close();
};

// 页面体检：主要页面在 390 和 360 宽都没有报错、没有横向溢出
J.pages = async (t) => {
  const id = await t.firstLive();
  const pages = ["/index.html", "/rentals.html", "/rents.html", "/post.html", `/rent/${id}.html`, "/guide/landlord.html", "/invest.html"];
  for (const size of PHONE_SIZES) {
    const { ctx, page, ev } = await t.phone(size);
    for (const p of pages) {
      ev.errors.length = 0;
      const r = await page.goto(BASE + p, { waitUntil: "networkidle" }).catch(e => null);
      t.check(r && r.status() === 200, `${size.name} 宽 ${p} 能打开`);
      const o = await overflow(page);
      t.check(o <= 1, `${size.name} 宽 ${p} 没有横向溢出`, `多出 ${o}px`);
      t.check(ev.errors.length === 0, `${size.name} 宽 ${p} 没有页面报错`, ev.errors.join(" | "));
      if (size.name === "390") t.save(`无障碍结构-${slug(p)}.txt`, await page.locator("body").ariaSnapshot());
    }
    await ctx.close();
  }
};

const NAMES = {
  listings: "房源一致性（三处周租一样）", book: "预约看房", landlord: "房东卡片 → 免费上架",
  owner: "房东托管留资", tenant: "租客留需求", callback: "联系我们 · 回电", post: "免费发房源", english: "英文界面", pages: "页面体检（390/360 宽）",
};

// ---------- 运行 ----------
async function main() {
  if (cmd === "list") { for (const k in NAMES) console.log(`${k.padEnd(9)} ${NAMES[k]}`); return; }
  await launch();
  const doc = await doctor();
  if (cmd === "doctor") { console.log(JSON.stringify(doc, null, 2)); cleanup(); process.exit(doc.ok ? 0 : 1); }
  if (!doc.ok) { console.error("自检没过，不跑流程：\n" + JSON.stringify(doc, null, 2)); cleanup(); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  browser = await playwright.chromium.launch();
  const keys = only.length ? only : Object.keys(J);
  const results = [];
  let liveId = null;
  for (const k of keys) {
    if (!J[k]) { console.error(`没有这个流程：${k}（node tools/verify/howzu-verify.js list 看全部）`); continue; }
    const dir = path.join(OUT, k); fs.mkdirSync(dir, { recursive: true });
    const r = { key: k, name: NAMES[k], checks: [], notes: [], shots: [] };
    let n = 0;
    const t = {
      clicks: 0,
      phone: (size, mobile) => phone(size, mobile),
      check: (ok, what, detail) => { r.checks.push({ ok: !!ok, what, detail: ok ? undefined : (detail || "") }); },
      note: s => r.notes.push(s),
      // 运行环境连不上外部脚本时，这个流程算“没验证”，不算网站坏了
      envBlocked: (ev, host) => { const h = ev.blocked.find(b => b.includes(host)); if (h) { r.skipped = `运行环境连不上 ${h}，这个流程没法在这里验证（网站本身不一定有问题）`; } return !!h; },
      save: (name, content) => fs.writeFileSync(path.join(dir, name), content),
      shot: async (page, name) => { const f = `${String(++n).padStart(2, "0")}-${name}.png`; await page.screenshot({ path: path.join(dir, f), fullPage: false }); r.shots.push(path.join(k, f)); },
      firstLive: async () => {
        if (!liveId) { const L = JSON.parse((await get(BASE + "/data/listings.json")).body).listings; liveId = (L.find(x => x.status === "live") || {}).id; }
        return liveId;
      },
    };
    const started = Date.now();
    try { await J[k](t); } catch (e) { r.checks.push({ ok: false, what: "流程走完", detail: e.message.split("\n")[0] }); }
    r.seconds = Math.round((Date.now() - started) / 1000);
    if (r.skipped) r.checks = [];
    r.ok = r.skipped ? null : r.checks.length > 0 && r.checks.every(c => c.ok);
    results.push(r);
    const bad = r.checks.filter(c => !c.ok);
    if (r.skipped) { console.log(`⚪ ${r.name}  没验证：${r.skipped}`); continue; }
    console.log(`${r.ok ? "✅" : "❌"} ${r.name}  ${r.checks.length - bad.length}/${r.checks.length}  ${r.seconds}s`);
    for (const c of bad) console.log(`   ✗ ${c.what}${c.detail ? "：" + c.detail : ""}`);
  }
  await browser.close();
  const summary = { when: new Date().toISOString(), target: BASE, commit: doc.commit, ok: results.every(r => r.ok !== false), skipped: results.filter(r => r.skipped).map(r => r.key), results };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  const md = [`# 好租验证 ${summary.when.slice(0, 16).replace("T", " ")} UTC`, ``, `对象：${BASE}　版本：${doc.commit}　结果：${summary.ok ? "全部通过" : "有失败"}`, ``,
    ...results.flatMap(r => [`## ${r.skipped ? "⚪" : r.ok ? "✅" : "❌"} ${r.name}`, ...(r.skipped ? [`- 没验证：${r.skipped}`] : []), ...r.notes.map(s => `- ${s}`), ...r.checks.map(c => `- ${c.ok ? "✓" : "✗"} ${c.what}${c.detail ? "：" + c.detail : ""}`), ...r.shots.map(s => `- 截图：${s}`), ``])];
  fs.writeFileSync(path.join(OUT, "summary.md"), md.join("\n"));
  console.log(`\n证据：${OUT}`);
  cleanup();
  process.exit(summary.ok ? 0 : 1);
}
main().catch(e => { console.error(e); cleanup(); process.exit(1); });
