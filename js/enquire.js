// 咨询 / 预约看房：纯函数（浏览器和 node 测试都能用）。
// 每条消息都带上房源编号，方便以后统计是哪套房带来的咨询。
(function (root) {
  const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const TIMES = ["10:00", "12:00", "14:00", "16:00", "18:00"];
  const pad = n => String(n).padStart(2, "0");
  // 可选日期：从明天起 7 天（看房一般至少提前一天约）
  function days(now) {
    now = now || new Date();
    const out = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      out.push({ ymd: `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`, label: `${i === 1 ? "明天" : WD[d.getDay()]}`, sub: `${d.getMonth() + 1}/${d.getDate()}`, wk: WD[d.getDay()] });
    }
    return out;
  }
  // 看房安排：按房东发房源时选的"看房方式"（highlights 里的「看房 xxx」标签）给出可选日期。
  // 以后如果房源数据带 inspections:[{date:"2026-11-15",time:"10:00"}]（房东定好的开放看房时间），就只显示这些时段。
  function viewPlan(x, now) {
    now = now || new Date();
    const hs = (x && x.highlights) || [], h = hs.find(v => String(v).startsWith("看房 "));
    const mode = h ? String(h).slice(3).trim() : "";
    const today = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const tagged = hs.map(String).filter(v => v.startsWith("开放看房 ")).map(v => { const p = v.slice(5).trim().split(" "); return { date: p[0], time: p[1] }; });
    const fixed = ((x && x.inspections) || []).concat(tagged).map(o => ({ ymd: String(o.date || "").replace(/-/g, ""), t: String(o.time || "") }))
      .filter(o => /^\d{8}$/.test(o.ymd) && /^\d\d:\d\d$/.test(o.t) && o.ymd > today).sort((a, b) => (a.ymd + a.t < b.ymd + b.t ? -1 : 1));
    if (fixed.length) {
      return { mode: "fixed", note: "房东定好的开放看房时间，选一个就行", slots: fixed.slice(0, 8).map(o => { const d = new Date(+o.ymd.slice(0, 4), +o.ymd.slice(4, 6) - 1, +o.ymd.slice(6, 8));
        return { ymd: o.ymd, t: o.t, label: `${+o.ymd.slice(4, 6)}/${+o.ymd.slice(6, 8)} ${WD[d.getDay()]}`, sub: timeLabel(o.t) }; }) };
    }
    if (mode === "周末看房") {
      const out = [];
      for (let i = 1; i <= 14 && out.length < 4; i++) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        if (d.getDay() === 0 || d.getDay() === 6) out.push({ ymd: `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`, label: WD[d.getDay()], sub: `${d.getMonth() + 1}/${d.getDate()}`, wk: "" }); }
      return { mode: "weekend", note: "房东只在周末带看，下面是最近的 4 个周末日", days: out, times: TIMES.filter(t => t !== "18:00") };
    }
    if (mode === "定好时间") return { mode: "", note: "房东定的看房时间已过，选一个你方便的时间，我们帮你约", days: days(now), times: TIMES };
    if (mode === "视频看房") return { mode: "video", note: "可以视频看房：选个时间，我们用微信视频带你看", days: days(now), times: TIMES };
    return { mode: mode === "随时可约" ? "any" : "", note: mode === "随时可约" ? "房东随时可约，选一个你方便的时间" : "选一个你方便的时间，我们回复确认", days: days(now), times: TIMES };
  }
  const timeLabel = t => { const h = +t.slice(0, 2), m = t.slice(3, 5); return `${h < 12 ? "上午" : h === 12 ? "中午" : h < 18 ? "下午" : "晚上"} ${h > 12 ? h - 12 : h}${m && m !== "00" ? ":" + m : " 点"}`; };
  const whenText = (ymd, t) => `${+ymd.slice(4, 6)} 月 ${+ymd.slice(6, 8)} 日 ${timeLabel(t)}`;
  // 发给我们的预约短信/微信内容
  function bookMsg(x, ymd, t, video) {
    return `你好，我在好租 Howzu 看到房源「${x.title}」（房源编号 ${x.id}），想预约 ${whenText(ymd, t)} ${video ? "视频看房（微信视频）" : "看房"}，请帮我确认，谢谢！`;
  }
  function askMsg(x) { return `你好，我在好租 Howzu 看到房源「${x.title}」（房源编号 ${x.id}），想咨询一下。`; }
  const icsEsc = s => String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/[,;]/g, m => "\\" + m).replace(/\r?\n/g, "\\n");
  // 生成 .ics（墨尔本时间，30 分钟，提前 1 小时提醒）
  function ics(x, ymd, t, opts) {
    opts = opts || {};
    const st = `${ymd}T${t.replace(":", "")}00`;
    const endMin = +t.slice(0, 2) * 60 + +t.slice(3, 5) + 30;
    const en = `${ymd}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`;
    const stamp = (opts.now || new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const url = opts.url || `https://howzu.com.au/rentals.html?id=${encodeURIComponent(x.id)}`;
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Howzu//Inspection//ZH", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${icsEsc(x.id)}-${st}@howzu.com.au`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Australia/Melbourne:${st}`,
      `DTEND;TZID=Australia/Melbourne:${en}`,
      `SUMMARY:${icsEsc("看房：" + x.title)}`,
      `LOCATION:${icsEsc(x.address || "")}`,
      `DESCRIPTION:${icsEsc(`好租 Howzu 房源编号 ${x.id}\n待确认：请等我们回复确认时间${opts.tel ? "\n电话 " + opts.tel : ""}\n${url}`)}`,
      `URL:${url}`,
      "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc("1 小时后看房：" + x.title)}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR", "",
    ].join("\r\n");
  }
  const smsHref = (tel, body) => `sms:${tel}?&body=${encodeURIComponent(body)}`;
  const api = { days, viewPlan, TIMES, timeLabel, whenText, bookMsg, askMsg, ics, smsHref };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HowzuEnquire = api;
})(this);
