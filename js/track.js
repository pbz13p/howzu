// 好租访问统计：每次打开页面写一条（页面路径、来源、手机/电脑），表里不存 IP、不用 cookie。
// 表还没建好或网络失败时静默忽略，不影响页面。咨询按钮可调用 HowzuTrack.ev('wechat') 等。
// 来源渠道：访客第一次进站时判断（utm_source > 来源网站 > 微信内打开 > 直接），存在本机 30 天；
// 咨询事件写成 "动作:房源id@渠道"，后台据此统计各渠道带来的询盘。
(function () {
  var C = window.HOWZU || {}, U = C.SUPABASE_URL, K = C.SUPABASE_ANON_KEY;
  function refHost() {
    try { var h = document.referrer ? new URL(document.referrer).hostname : ""; return h === location.hostname ? "" : h; } catch (e) { return ""; }
  }
  // 把来源归到几个渠道；认不出的保留域名
  function classify(utm, host, ua) {
    var s = String(utm || "").toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 20);
    if (s) {
      if (/^(xhs|xiaohongshu|rednote|red)$/.test(s)) return "xiaohongshu";
      if (/^(fb|facebook|ig|instagram|meta)$/.test(s)) return "facebook";
      if (/^(wx|wechat|weixin)$/.test(s)) return "wechat";
      return s;
    }
    var h = String(host || "").toLowerCase();
    if (/(^|\.)google\./.test(h)) return "google";
    if (/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|baidu\.com)$/.test(h)) return "search";
    if (/xiaohongshu\.com$|xhslink\.com$/.test(h)) return "xiaohongshu";
    if (/facebook\.com$|fb\.com$|instagram\.com$/.test(h)) return "facebook";
    if (/weixin\.qq\.com$|wechat\.com$/.test(h) || /MicroMessenger/i.test(ua || "")) return "wechat";
    if (h) return h.replace(/^www\./, "").slice(0, 20);
    return "direct";
  }
  function current() {
    var utm = ""; try { utm = new URLSearchParams(location.search).get("utm_source") || ""; } catch (e) {}
    return classify(utm, refHost(), navigator.userAgent);
  }
  // 首次来源：30 天内保留第一次的渠道（"直接"不覆盖已有的外部渠道）
  function firstTouch() {
    var now = Date.now(), cur = current(), v = null;
    try { v = JSON.parse(localStorage.getItem("howzu-src") || "null"); } catch (e) {}
    if (!v || !v.c || now - (v.t || 0) > 30 * 864e5 || (v.c === "direct" && cur !== "direct")) {
      v = { c: cur, t: now };
      try { localStorage.setItem("howzu-src", JSON.stringify(v)); } catch (e) {}
    }
    return v.c;
  }
  var SRC = "direct"; try { SRC = firstTouch(); } catch (e) {}
  function send(ev) {
    try {
      if (!U || !K || /localhost|127\.0\.0\.1/.test(location.hostname) || navigator.webdriver) return;
      ev = String(ev || "view");
      // 浏览记来源网站（没有来源但在微信里打开就记 wechat；带 utm 的记 utm 渠道）；咨询事件末尾带首次来源渠道
      var cur = current(), ref = refHost() || (cur !== "direct" ? cur : "");
      if (ev !== "view") ev = ev.slice(0, 39 - SRC.length) + "@" + SRC;
      fetch(U + "/rest/v1/pageviews", { method: "POST", keepalive: true,
        headers: { apikey: K, Authorization: "Bearer " + K, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ path: (window.HOWZU_PATH || (location.pathname + location.search)).slice(0, 200), ref: ref.slice(0, 100), mobile: /Mobi|Android|iPhone/i.test(navigator.userAgent), ev: ev.slice(0, 40) })
      }).catch(function () {});
    } catch (e) {}
  }
  window.HowzuTrack = { ev: send, src: function () { return SRC; }, classify: classify };
  send("view");
  // 咨询类按钮（带 data-act，例如 wechat / call / book / lead / ics）点一下记一条，带上房源 id
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
    if (b) send(b.getAttribute("data-act") + ":" + (b.getAttribute("data-id") || ""));
  }, true);
})();
