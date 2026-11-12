// 好租访问统计：每次打开页面写一条（页面路径、来源域名、手机/电脑），表里不存 IP、不用 cookie。
// 表还没建好或网络失败时静默忽略，不影响页面。咨询按钮可调用 HowzuTrack.ev('wechat') 等。
(function () {
  var C = window.HOWZU || {}, U = C.SUPABASE_URL, K = C.SUPABASE_ANON_KEY;
  function send(ev) {
    try {
      if (!U || !K || /localhost|127\.0\.0\.1/.test(location.hostname) || navigator.webdriver) return;
      var ref = ""; try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) {}
      if (ref === location.hostname) ref = "";
      fetch(U + "/rest/v1/pageviews", { method: "POST", keepalive: true,
        headers: { apikey: K, Authorization: "Bearer " + K, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ path: (window.HOWZU_PATH || (location.pathname + location.search)).slice(0, 200), ref: ref.slice(0, 100), mobile: /Mobi|Android|iPhone/i.test(navigator.userAgent), ev: String(ev || "view").slice(0, 40) })
      }).catch(function () {});
    } catch (e) {}
  }
  window.HowzuTrack = { ev: send };
  send("view");
  // 咨询类按钮（带 data-act，例如 wechat / call / book / lead / ics）点一下记一条，带上房源 id
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
    if (b) send((b.getAttribute("data-act") + ":" + (b.getAttribute("data-id") || "")).slice(0, 40));
  }, true);
})();
