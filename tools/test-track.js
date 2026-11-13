// 访问统计 js/track.js：打开页面写一条 view；点带 data-act 的按钮写一条咨询；本机/自动化测试时不发；不带 IP、cookie
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "track.js"), "utf8");
let fail = 0; const ok = (n, c) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) fail++; };
function run(host, webdriver) {
  const calls = [], listeners = {};
  const ctx = { window: { HOWZU: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k" } },
    location: { hostname: host, pathname: "/rentals.html", search: "?id=a" },
    navigator: { userAgent: "iPhone", webdriver },
    document: { referrer: "https://www.google.com/search?q=1", addEventListener: (t, f) => (listeners[t] = f) },
    URL, fetch: (u, o) => { calls.push([u, JSON.parse(o.body), o.headers]); return { catch() {} }; } };
  vm.runInNewContext(src, ctx);
  return { calls, listeners, ctx };
}
const a = run("howzu.com.au", false);
ok("打开页面写一条 view，带路径、来源域名（不带搜索词）、手机", a.calls.length === 1 && a.calls[0][0].endsWith("/rest/v1/pageviews") && a.calls[0][1].ev === "view" && a.calls[0][1].path === "/rentals.html?id=a" && a.calls[0][1].ref === "www.google.com" && a.calls[0][1].mobile === true);
ok("不带 IP、cookie 等字段", Object.keys(a.calls[0][1]).sort().join() === "ev,mobile,path,ref");
const btn = { getAttribute: k => ({ "data-act": "wechat", "data-id": "2110-spencer" })[k] };
a.listeners.click({ target: { closest: () => btn } });
ok("点咨询按钮记一条 wechat:房源id@来源渠道", a.calls.length === 2 && a.calls[1][1].ev === "wechat:2110-spencer@google");
{ const T = a.ctx.window.HowzuTrack;
  ok("渠道识别：Google、小红书短链、Facebook、微信内打开、utm、直接", T.classify("", "www.google.com.au") === "google" && T.classify("", "xhslink.com") === "xiaohongshu" && T.classify("", "m.facebook.com") === "facebook" && T.classify("", "", "Mozilla MicroMessenger/8") === "wechat" && T.classify("XHS", "www.google.com") === "xiaohongshu" && T.classify("", "") === "direct"); }
ok("本机预览不发", run("localhost", false).calls.length === 0);
ok("自动化测试浏览器不发", run("howzu.com.au", true).calls.length === 0);
process.exit(fail ? 1 : 0);
