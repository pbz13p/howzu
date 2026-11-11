// 收藏（不用登录，存在本机 localStorage）。纯函数 + 小存取封装。
(function (root) {
  const KEY = "howzu-fav";
  function parse(s) { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a.filter(x => typeof x === "string").slice(0, 100) : []; } catch (_) { return []; } }
  // 收藏/取消：新收藏的排最前，最多 100 条
  function toggle(list, id) { id = String(id); return list.includes(id) ? list.filter(x => x !== id) : [id, ...list].slice(0, 100); }
  function load(ls) { try { return parse(ls.getItem(KEY)); } catch (_) { return []; } }
  function save(ls, list) { try { ls.setItem(KEY, JSON.stringify(list)); } catch (_) {} }
  // 最近浏览：刚看的排最前，去重，最多 10 条
  const RKEY = "howzu-recent";
  function seen(list, id) { id = String(id); return [id, ...list.filter(x => x !== id)].slice(0, 10); }
  // 要显示的最近浏览：只留还在列表里、没租出的房源；正在看的那套不算
  function recentShow(list, all, isLet, skip) { const m = new Map(all.map(x => [String(x.id), x])); return list.filter(id => id !== String(skip ?? "") && m.has(id) && !isLet(m.get(id))).map(id => m.get(id)).slice(0, 6); }
  const loadR = ls => { try { return parse(ls.getItem(RKEY)).slice(0, 10); } catch (_) { return []; } };
  const saveR = (ls, list) => { try { ls.setItem(RKEY, JSON.stringify(list)); } catch (_) {} };
  const api = { KEY, parse, toggle, load, save, RKEY, seen, recentShow, loadR, saveR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HowzuFav = api;
})(typeof window !== "undefined" ? window : this);
