/* 好租中英文切换（English UI）。
   做法：页面仍按中文写；选了 English 时，按 js/i18n-en.js 的词典把界面上的中文文字（含 JS 后来渲染的内容）换成英文。
   - 语言来自 ?lang=en / ?lang=zh，选过会记在本机（howzu-lang）。
   - 词典的键是整段文字，数字统一写成 {n}（例如 "{n} 房 {n} 卫" → "{n} bed {n} bath"），按顺序填回。
   - 整段没收录时，按“ · ”“、”“，”“|”拆开逐段翻；仍没收录的保留中文（房东写的描述等用户内容不翻）。
   - 页面上自动加一个 EN / 中文 切换按钮。 */
(function () {
  var KEY = "howzu-lang", q = /[?&]lang=(en|zh)\b/.exec(location.search), lang;
  try { if (q) localStorage.setItem(KEY, q[1]); lang = q ? q[1] : (localStorage.getItem(KEY) || "zh"); } catch (e) { lang = q ? q[1] : "zh"; }
  window.HowzuLang = { lang: lang, t: function (s) { return lang === "en" ? tr(s) : s; }, set: setLang };
  var HAN = /[一-鿿]/, NUM = /\$?\d[\d,]*(?:\.\d+)?/g;
  function dict() { return window.HOWZU_EN || {}; }
  function look(core) {
    var D = dict();
    if (Object.prototype.hasOwnProperty.call(D, core)) return D[core];
    var nums = core.match(NUM);
    if (nums) {
      var k = core.replace(NUM, "{n}");
      if (Object.prototype.hasOwnProperty.call(D, k)) { var i = 0; return D[k].replace(/\{n\}/g, function () { return nums[i++] || ""; }); }
    }
    return null;
  }
  function tr(s) {
    if (!s || !HAN.test(s)) return s;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2].replace(/\s+/g, " "), v = look(core);
    if (v == null) {
      // 拆段翻：分隔符保留
      var parts = core.split(/(\s*·\s*|、|，|,\s*|\s*\|\s*|：|:\s*|（|）|\(|\))/), hit = false;
      for (var j = 0; j < parts.length; j++) { if (HAN.test(parts[j])) { var p = look(parts[j].trim()); if (p != null) { parts[j] = parts[j].replace(parts[j].trim(), p); hit = true; } } else if (parts[j] === "、" || parts[j] === "，") parts[j] = ", "; else if (parts[j] === "：") parts[j] = ": "; else if (parts[j] === "（") parts[j] = " ("; else if (parts[j] === "）") parts[j] = ")"; }
      if (!hit) return s;
      v = parts.join("");
    }
    return m[1] + v + m[3];
  }
  var ATTRS = ["placeholder", "title", "aria-label", "alt"], busy = false;
  function walk(root) {
    if (lang !== "en" || !root) return;
    busy = true;
    try {
      if (root.nodeType === 3) { var v = tr(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
      if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
      // 有英文版的内容（如房源描述的 data-en）直接整段换成英文
      var ens = root.querySelectorAll ? root.querySelectorAll("[data-en]") : [];
      for (var e = 0; e < ens.length; e++) if (ens[e].textContent !== ens[e].getAttribute("data-en")) ens[e].textContent = ens[e].getAttribute("data-en");
      if (root.nodeType === 1 && root.hasAttribute("data-en") && root.textContent !== root.getAttribute("data-en")) root.textContent = root.getAttribute("data-en");
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { var p = n.parentElement; return p && !/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(p.tagName) && !p.closest("[data-noi18n],[data-en]") && HAN.test(n.nodeValue) ? 1 : 2; } }), n, list = [];
      while ((n = w.nextNode())) list.push(n);
      list.forEach(function (t) { var v = tr(t.nodeValue); if (v !== t.nodeValue) { var pb = t.parentElement; if (pb && pb.tagName === "BUTTON" && !pb.hasAttribute("data-zh") && pb.childNodes.length === 1) pb.setAttribute("data-zh", t.nodeValue.trim()); t.nodeValue = v; } });
      // ↑ 按钮翻成英文前记下中文原文（data-zh），页面脚本读选项值用它，提交到数据库的仍是中文（发房源页的房型、家具等）
      var els = root.querySelectorAll ? root.querySelectorAll("[placeholder],[title],[aria-label],[alt]") : [];
      for (var i = 0; i < els.length; i++) for (var a = 0; a < ATTRS.length; a++) { var x = els[i].getAttribute(ATTRS[a]); if (x && HAN.test(x)) { var xv = tr(x); if (xv !== x) els[i].setAttribute(ATTRS[a], xv); } }
      if (root.nodeType === 1) for (var b = 0; b < ATTRS.length; b++) { var y = root.getAttribute(ATTRS[b]); if (y && HAN.test(y)) { var yv = tr(y); if (yv !== y) root.setAttribute(ATTRS[b], yv); } }
    } finally { busy = false; }
  }
  function setLang(l) { try { localStorage.setItem(KEY, l); } catch (e) {} var u = location.href.replace(/([?&])lang=(en|zh)&?/, "$1").replace(/[?&]$/, ""); location.href = u + (u.indexOf("?") < 0 ? "?" : "&") + "lang=" + l; }
  function button() {
    var b = document.createElement("a"); b.href = "#"; b.className = "howzu-lang"; b.setAttribute("data-noi18n", "");
    b.textContent = lang === "en" ? "中文" : "EN"; b.title = lang === "en" ? "切换到中文" : "Switch to English";
    b.onclick = function (e) { e.preventDefault(); setLang(lang === "en" ? "zh" : "en"); };
    var host = document.querySelector("nav .in .links"), top = document.querySelector("header.top .all");
    if (top) { b.style.cssText = "margin-left:10px;padding:3px 9px;border:1px solid #cfe6d8;border-radius:12px;font-size:12.5px;font-weight:600;text-decoration:none;color:#0f6b4f"; top.parentNode.insertBefore(b, top.nextSibling); }
    else if (host) { host.insertBefore(b, host.firstChild); b.style.cssText = "margin-right:4px;padding:4px 10px;border:1px solid currentColor;border-radius:14px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;opacity:.9;align-self:center;flex:none;color:inherit"; }
    else { b.style.cssText = "position:fixed;top:10px;right:10px;z-index:9999;padding:6px 12px;border-radius:16px;background:#fff;color:#0f6b4f;border:1px solid #cfe6d8;font:600 13px -apple-system,sans-serif;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.08)"; document.body.appendChild(b); }
  }
  function start() {
    button();
    if (lang !== "en") return;
    document.documentElement.lang = "en";
    document.title = tr(document.title);
    walk(document.body);
    var mo = new MutationObserver(function (ms) {
      if (busy) return;
      ms.forEach(function (m) {
        if (m.type === "characterData") walk(m.target);
        else if (m.type === "attributes") walk(m.target);
        else m.addedNodes.forEach(function (n) { walk(n); });
      });
      mo.takeRecords(); // 丢掉翻译自己引起的变化，否则会无限循环把页面卡死
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
