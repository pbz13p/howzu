// 首页“正在招租”横滑卡片：从 data/listings.json 挑在租房源（纯函数，tools/test-home-rent.js 测试）
(function (g) {
  const isNow = x => /尽快|马上|即|now/i.test(x.available || "");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // 只要 live；马上能住的排前面，其余保持原顺序
  function pick(list) {
    return (list || []).filter(x => x && x.status === "live").map((x, i) => [x, i])
      .sort((a, b) => (isNow(b[0]) - isNow(a[0])) || a[1] - b[1]).map(p => p[0]);
  }
  // 有独立页（rent/<id>.html）就链过去，否则打开租房页详情
  const href = x => /^[\w-]+$/.test(x.id) ? `rent/${x.id}.html` : `rentals.html?id=${encodeURIComponent(x.id)}`;
  function card(x) {
    const t = String(x.title || x.suburb || "").split("·")[0].trim();
    const sub = [x.beds != null ? `${x.beds} 房` : "", x.baths != null ? `${x.baths} 卫` : "", String(x.suburb || "").replace(/ CBD$/, "")].filter(Boolean).join(" · ");
    const price = x.rentWeekly ? `<span class="hr-p">$${esc(x.rentWeekly)}<small>/周</small></span>` : `<span class="hr-p q">租金咨询</span>`;
    const tag = isNow(x) ? "马上入住" : x.available ? `${x.available}入住` : "";
    return `<a class="hr-c" href="${esc(href(x))}"><span class="hr-i"><img src="${esc((x.photos || [])[0] || "")}" alt="" loading="lazy">${tag ? `<em>${esc(tag)}</em>` : ""}</span><b>${esc(t)}</b><span class="hr-s">${esc(sub)}</span>${price}</a>`;
  }
  function html(list) { const L = pick(list); return { n: L.length, cards: L.slice(0, 8).map(card).join("") }; }
  const api = { pick, href, card, html };
  if (typeof module !== "undefined") module.exports = api; else g.HomeRent = api;
})(this);
