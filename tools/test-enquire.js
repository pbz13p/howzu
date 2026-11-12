// 预约看房 / 咨询消息 / .ics 的测试。由 test-data.js 自动调用。
const E = require("../js/enquire.js");
let fail = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fail++; console.log("✗ " + m); } };
const x = { id: "2110-spencer", title: "Spencer St · 两房", address: "138 Spencer St, Melbourne VIC 3000" };
const D = E.days(new Date(2026, 10, 11, 20, 0));
ok(D.length === 7 && D[0].ymd === "20261112" && D[0].label === "明天", "从明天开始 7 天");
ok(D[6].ymd === "20261118", "第 7 天");
ok(E.days(new Date(2026, 11, 30))[2].ymd === "20270102", "跨年");
ok(E.timeLabel("10:00") === "上午 10 点" && E.timeLabel("12:00") === "中午 12 点" && E.timeLabel("16:00") === "下午 4 点" && E.timeLabel("18:00") === "晚上 6 点", "时间文字");
const m = E.bookMsg(x, "20261114", "14:00");
ok(m.includes("房源编号 2110-spencer") && m.includes("11 月 14 日 下午 2 点"), "预约消息带房源编号和时间");
ok(E.askMsg(x).includes("2110-spencer"), "咨询消息带房源编号");
const ics = E.ics(x, "20261114", "16:00", { now: new Date(Date.UTC(2026, 10, 11)), tel: "0431438595" });
ok(ics.includes("DTSTART;TZID=Australia/Melbourne:20261114T160000") && ics.includes("DTEND;TZID=Australia/Melbourne:20261114T163000"), "ics 起止时间");
ok(ics.includes("LOCATION:138 Spencer St\\, Melbourne VIC 3000"), "ics 逗号转义");
ok(ics.includes("UID:2110-spencer-20261114T160000@howzu.com.au") && ics.includes("TRIGGER:-PT1H"), "ics UID 和提醒");
ok(ics.split("\r\n").filter(l => l === "BEGIN:VEVENT").length === 1 && ics.endsWith("END:VCALENDAR\r\n"), "ics 结构");
ok(E.ics(x, "20261114", "18:45").includes("T191500"), "跨小时结束时间");
ok(E.smsHref("0431438595", "a b").startsWith("sms:0431438595?&body=a%20b"), "短信链接");
// 看房安排
const N = new Date(2026, 10, 12, 9, 0); // 周四
const pw = E.viewPlan({ highlights: ["近火车站", "看房 周末看房"] }, N);
ok(pw.mode === "weekend" && pw.days.length === 4 && pw.days.every(d => d.label === "周六" || d.label === "周日") && pw.days[0].ymd === "20261114", "周末看房只给周末日期");
ok(!pw.times.includes("18:00"), "周末不给晚上");
const pv = E.viewPlan({ highlights: ["看房 视频看房"] }, N);
ok(pv.mode === "video" && pv.days.length === 7 && E.bookMsg(x, "20261114", "14:00", true).includes("视频看房"), "视频看房");
ok(E.viewPlan({}, N).mode === "" && E.viewPlan({}, N).days.length === 7, "没写看房方式：默认 7 天");
const pf = E.viewPlan({ highlights: ["看房 周末看房"], inspections: [{ date: "2026-11-15", time: "11:00" }, { date: "2026-11-10", time: "10:00" }, { date: "2026-11-13", time: "17:30" }, { date: "bad", time: "1" }] }, N);
ok(pf.mode === "fixed" && pf.slots.length === 2 && pf.slots[0].ymd === "20261113" && pf.slots[0].label === "11/13 周五" && pf.slots[1].t === "11:00", "固定开放时间：过期和坏数据去掉、按时间排序");
const pt = E.viewPlan({ highlights: ["看房 定好时间", "开放看房 2026-11-15 11:00", "开放看房 2026-11-14 10:00"] }, N);
ok(pt.mode === "fixed" && pt.slots.length === 2 && pt.slots[0].ymd === "20261114" && pt.slots[0].t === "10:00", "发房源时填的开放看房时间");
ok(E.timeLabel("18:30") === "晚上 6:30" && E.whenText("20261118", "09:15") === "11 月 18 日 上午 9:15", "带分钟的时间文字");
ok(E.viewPlan({ highlights: ["看房 定好时间", "开放看房 2026-11-01 11:00"] }, N).note.includes("已过"), "开放时间都过期：退回自选时间并说明");
console.log(`enquire: ${n - fail}/${n} 通过`);
if (fail) process.exit(1);
