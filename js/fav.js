// 收藏（不用登录，存在本机 localStorage）。纯函数 + 小存取封装。
(function (root) {
  const KEY = "howzu-fav";
  function parse(s) { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a.filter(x => typeof x === "string").slice(0, 100) : []; } catch (_) { return []; } }
  // 收藏/取消：新收藏的排最前，最多 100 条
  function toggle(list, id) { id = String(id); return list.includes(id) ? list.filter(x => x !== id) : [id, ...list].slice(0, 100); }
  function load(ls) { try { return parse(ls.getItem(KEY)); } catch (_) { return []; } }
  function save(ls, list) { try { ls.setItem(KEY, JSON.stringify(list)); } catch (_) {} }
  const api = { KEY, parse, toggle, load, save };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HowzuFav = api;
})(typeof window !== "undefined" ? window : this);
