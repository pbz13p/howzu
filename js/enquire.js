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
  const timeLabel = t => { const h = +t.slice(0, 2); return `${h < 12 ? "上午" : h === 12 ? "中午" : h < 18 ? "下午" : "晚上"} ${h > 12 ? h - 12 : h} 点`; };
  const whenText = (ymd, t) => `${+ymd.slice(4, 6)} 月 ${+ymd.slice(6, 8)} 日 ${timeLabel(t)}`;
  // 发给我们的预约短信/微信内容
  function bookMsg(x, ymd, t) {
    return `你好，我在好租 Howzu 看到房源「${x.title}」（房源编号 ${x.id}），想预约 ${whenText(ymd, t)} 看房，请帮我确认，谢谢！`;
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
  const api = { days, TIMES, timeLabel, whenText, bookMsg, askMsg, ics, smsHref };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HowzuEnquire = api;
})(this);
