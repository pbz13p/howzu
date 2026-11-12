// 每套房一个独立静态页（rent/<id>.html）：给微信 / 小红书 / Google 抓标题、首图、描述用。
// 纯函数，Node 和浏览器都能用；由 tools/build-listing-pages.js 生成文件。
(function (root) {
  const SITE = "https://howzu.com.au";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hideUnit = a => String(a || "").replace(/^\s*[\w-]+\s*\/\s*/, "");
  const isLet = x => x.status === "let";
  const pageUrl = x => `${SITE}/rent/${encodeURIComponent(x.id)}.html`;
  const fmtTel = t => String(t || "").replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");

  function facts(x) {
    return [x.beds != null ? `${x.beds}房` : "", x.baths != null ? `${x.baths}卫` : "", x.cars ? `${x.cars}车位` : ""].filter(Boolean).join("");
  }
  function priceText(x) {
    if (isLet(x)) return "已租出";
    return x.rentWeekly ? `$${x.rentWeekly}/周` : "租金咨询";
  }
  // 分享卡片标题：区 · 几房几卫 · 租金
  function ogTitle(x) {
    return [x.title || x.suburb || "墨尔本房源", isLet(x) ? "已租出" : x.rentWeekly ? `$${x.rentWeekly}/周` : ""].filter(Boolean).join(" · ") + " | 好租 Howzu";
  }
  // 分享卡片描述：关键信息 + 介绍第一句，限 110 字
  function ogDesc(x) {
    const head = [x.suburb, facts(x), isLet(x) ? "已租出" : x.available ? `${x.available}入住` : "", x.furnished === true ? "带家具" : ""].filter(Boolean).join(" · ");
    const first = String(x.desc || "").split(/\n/).map(s => s.trim()).filter(Boolean)[0] || "";
    const s = head + (first ? "。" + first : "") + " 好租 Howzu 中文服务，持牌管理。";
    return s.length > 110 ? s.slice(0, 109) + "…" : s;
  }
  function ogImage(x) {
    const p = (x.photos || [])[0];
    if (!p) return `${SITE}/icons/og-share.jpg`;
    return /^https?:/.test(p) ? p : `${SITE}/${String(p).replace(/^\//, "")}`;
  }
  // 关键信息栏：押金 / 可入住 / 租期 / 看房。押金、租期、看房来自发房源时存进 highlights 的标签；
  // 没填的写"咨询"，不编数据。返回 { cells:[[标签,值]], rest:剩下的普通亮点 }
  const KEY = [["押金", /^押金\s*/], ["租期", /^租期\s*/], ["看房", /^看房\s*/], ["类型", /^类型\s*/], ["楼层", /^楼层\s*/]];
  function keyFacts(x) {
    const hs = (x.highlights || []).map(String), got = {};
    const rest = hs.filter(h => !/^开放看房 |^不可养宠|^不包水电网$/.test(h)).filter(h => { const k = KEY.find(([, re]) => re.test(h)); if (k && !got[k[0]]) { got[k[0]] = h.replace(k[1], "").trim(); return false; } return true; });
    const avail = isLet(x) ? "已租出" : x.available ? String(x.available).replace(/入住$/, "") : "咨询";
    const cells = [["押金", got["押金"] || "咨询"], ["可入住", avail], ["租期", got["租期"] || "咨询"], ["看房", got["看房"] === "定好时间" ? "定时开放" : got["看房"] || "预约看房"]];
    return { cells, rest };
  }

  // 统一的"房屋信息"表：每套房同样的字段、同样的顺序。没有数据就写"待确认"，不猜。
  // 来源优先级：结构化字段 → 发房源时选的标签（highlights）→ 标题/介绍里的明确说法
  const TBC = "待确认";
  const AMEN = [["电梯", /电梯|lift|elevator/i], ["健身房", /健身房|gym/i], ["泳池", /泳池|pool/i], ["阳台", /阳台|balcony/i], ["洗衣机", /洗衣机|washing machine|washer/i], ["烘干机", /烘干机|dryer/i], ["空调", /空调|冷暖|air ?con|heating/i], ["洗碗机", /洗碗机|dishwasher/i], ["门禁/礼宾", /门禁|礼宾|concierge|intercom/i]];
  function specs(x) {
    const hs = (x.highlights || []).map(String), all = [x.title, ...hs, x.desc].filter(Boolean).join(" ");
    const tag = p => { const h = hs.find(v => v.startsWith(p)); return h ? h.slice(p.length).trim() : ""; };
    const num = (n, unit, zero) => n == null || n === "" ? TBC : +n === 0 ? zero : `${n} ${unit}`;
    const no = re => re.test(all);
    const type = tag("类型 ") || x.type || (/公寓|apartment|高层|层.*一房|层.*两房/i.test(all) ? "公寓" : /联排|townhouse/i.test(all) ? "联排别墅" : /独立屋|别墅|\bhouse\b/i.test(all) ? "独立屋" : /单间|房间出租|合租/.test(all) ? "单间" : TBC);
    const furn = x.furnished === true ? "带家具" : x.furnished === false ? "不带家具" : typeof x.furnished === "string" && x.furnished ? x.furnished
      : no(/不带家具|无家具|unfurnished/i) ? "不带家具" : no(/带家具|家具齐全|拎包入住|furnished/i) ? "带家具" : TBC;
    const pets = x.pets === true ? "可以" : x.pets === false ? "不可以" : no(/不可养宠|不能养宠|禁止宠物|no pets/i) ? "不可以" : no(/可养宠|宠物友好|允许宠物|可带宠物|pets? (ok|allowed|friendly)/i) ? "可以" : TBC;
    const bills = ["水", "电", "网"].filter(k => hs.includes("包" + k + "费") || hs.includes("包" + k) || new RegExp("(^|[^不])包[水电网、和]*" + k).test(all));
    const floor = (all.match(/(\d{1,3})\s*(?:层|楼(?!下))/) || [])[1];
    const amen = AMEN.filter(([, re]) => re.test(all)).map(([k]) => k);
    const avail = isLet(x) ? "已租出" : x.available ? String(x.available).replace(/入住$/, "") : TBC;
    return [
      ["类型", type], ["卧室", num(x.beds, "间", "开间 Studio")], ["卫生间", num(x.baths, "个", TBC)], ["车位", num(x.cars, "个", "无")],
      ["家具", furn], ["可入住", avail], ["租期", tag("租期 ") || TBC], ["押金", tag("押金 ") || TBC],
      ["宠物", pets], ["包水电网", bills.length ? "包" + bills.join("、") + "费" : hs.includes("不包水电网") ? "不包，租客自付" : TBC], ["楼层", tag("楼层 ") || (floor ? `${floor} 层` : /高层|high[- ]?rise/i.test(all) ? "高层" : TBC)], ["看房", tag("看房 ") === "定好时间" ? "定时开放" : tag("看房 ") || "预约看房"],
      ["设施", amen.length ? amen.join("、") : TBC],
    ];
  }

  // 并排对比（最多 3 套）：第一行租金，后面是统一的房屋信息；每行标出各套是否不同，方便一眼看差别
  function compare(list) {
    const L = (list || []).slice(0, 3), S = L.map(specs);
    const rows = [["周租", L.map(x => Number(x.rentWeekly) > 0 ? `$${x.rentWeekly}` : "面议")], ["区域", L.map(x => x.suburb || TBC)]];
    if (S[0]) S[0].forEach(([k], i) => rows.push([k, S.map(r => r[i][1])]));
    return rows.map(([k, v]) => ({ k, v, diff: new Set(v).size > 1 }));
  }
  const rel = p => /^https?:/.test(p) ? p : "../" + String(p).replace(/^\//, "");

  function render(x, contact, letCount) {
    contact = contact || {};
    const tel = x.phone || contact.phone, wx = x.wechat || contact.wechat;
    const P = x.photos || [];
    const t = ogTitle(x), d = ogDesc(x), img = ogImage(x), url = pageUrl(x);
    const full = `../rentals.html?id=${encodeURIComponent(x.id)}`;
    const msg = encodeURIComponent(`你好，我在好租 Howzu 看到房源：${x.title}（${url}）`);
    const ld = {
      "@context": "https://schema.org", "@type": "Apartment", name: x.title, url, image: P.map(p => ogImage({ photos: [p] })),
      address: { "@type": "PostalAddress", streetAddress: hideUnit(x.address), addressLocality: x.suburb, addressRegion: "VIC", addressCountry: "AU" },
    };
    if (x.beds != null) ld.numberOfRooms = x.beds;
    if (x.baths != null) ld.numberOfBathroomsTotal = x.baths;
    const tags = [
      x.beds != null ? `🛏 ${x.beds} 房` : "", x.baths != null ? `🛁 ${x.baths} 卫` : "", x.cars != null ? `🚗 ${x.cars ? x.cars + " 车位" : "无车位"}` : "",
    ].filter(Boolean);
    const kf = keyFacts(x);
    const chips = [x.furnished === true ? "带家具" : x.furnished === false ? "不带家具" : x.furnished === "部分家具" ? "部分家具" : "", ...kf.rest].filter(Boolean);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title>
<meta name="description" content="${esc(d)}">
<link rel="canonical" href="${esc(url)}">
${isLet(x) ? '<meta name="robots" content="noindex">\n' : ""}<meta property="og:type" content="website">
<meta property="og:site_name" content="好租 Howzu">
<meta property="og:title" content="${esc(t)}">
<meta property="og:description" content="${esc(d)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:locale" content="zh_CN">
<meta name="twitter:card" content="summary_large_image">
<meta itemprop="name" content="${esc(t)}"><meta itemprop="image" content="${esc(img)}"><meta itemprop="description" content="${esc(d)}">
<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#0f6b4f">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#1d2321;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit}.top{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;max-width:880px;margin:0 auto}
.logo{font-weight:700;text-decoration:none;color:#0f6b4f;letter-spacing:.02em}.top a.all{font-size:14px;color:#6b726f;text-decoration:none}
main{max-width:880px;margin:0 auto;padding:0 20px 120px}
.hero{position:relative;border-radius:16px;overflow:hidden;background:#eee;aspect-ratio:4/3}.hero img{width:100%;height:100%;object-fit:cover;display:block}
.hero .n{position:absolute;right:12px;bottom:12px;background:rgba(0,0,0,.55);color:#fff;font-size:13px;padding:4px 10px;border-radius:99px;text-decoration:none}
.let{position:absolute;left:12px;top:12px;background:#1d2321;color:#fff;font-size:13px;padding:4px 10px;border-radius:99px}
.price{font-size:28px;font-weight:700;margin:20px 0 2px;letter-spacing:-.01em}.price small{font-size:15px;font-weight:500;color:#6b726f}
h1{font-size:19px;font-weight:600;margin:0 0 4px}.addr{color:#6b726f;font-size:14px}
.facts{display:flex;gap:18px;margin:14px 0;font-size:15px;color:#1d2321}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}.chips span{background:#e8f3ee;color:#0f6b4f;font-size:13px;padding:4px 10px;border-radius:99px}
.kf{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #ece9e2;border-radius:12px;margin:0 0 16px}.kf div{padding:10px 4px;text-align:center;min-width:0}.kf div+div{border-left:1px solid #ece9e2}.kf small{display:block;font-size:12px;color:#6b726f}.kf b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kf b.m{color:#9aa09d;font-weight:500}
.sp{margin:0 0 18px}.sp-h{font-size:15px;font-weight:600;margin-bottom:6px}.sp dl{display:grid;grid-template-columns:1fr 1fr;margin:0;border-top:1px solid #ece9e2}.sp dl div{display:flex;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid #ece9e2;font-size:14px;min-width:0}.sp dl div:nth-child(odd):not(.w){padding-right:12px}.sp dl div:nth-child(even){padding-left:12px}.sp dl div.w{grid-column:1/-1;padding-left:0}.sp dt{color:#6b726f;flex:none}.sp dd{margin:0;font-weight:500;text-align:right}.sp dd.m{color:#a3a8a5;font-weight:400}
.tr{border-radius:14px;background:#f2f7f4;padding:12px 14px 11px;margin:0 0 18px}.tr-h{font-size:14px;font-weight:600;color:#0f6b4f;margin-bottom:8px}
.tr-l{display:block;margin-top:9px;font-size:12.5px;font-weight:600;color:#0f6b4f;text-decoration:none}.tr-g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.tr-g b{display:block;font-size:13px}.tr-g small{display:block;font-size:11.5px;color:#6b726f;line-height:1.35}.tr-n{font-size:12px;color:#6b726f;margin-top:9px;padding-top:8px;border-top:1px solid rgba(15,107,79,.12)}
.desc{white-space:pre-line;font-size:15px;border-top:1px solid #ece9e2;padding-top:18px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:22px 0}.grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;display:block}
.more{display:block;text-align:center;padding:14px;border:1px solid #e4e1d8;border-radius:12px;text-decoration:none;font-size:15px;margin-top:8px}
.trust{font-size:13px;color:#6b726f;margin-top:22px}
.bar{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:1px solid #ece9e2;padding:12px 16px calc(12px + env(safe-area-inset-bottom))}
.bar div{max-width:880px;margin:0 auto;display:flex;gap:10px}
.bar a{flex:1;text-align:center;padding:13px 0;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;background:#0f6b4f;color:#fff}
.bar a.g{background:#e8f3ee;color:#0f6b4f}.bar a.p{flex:1.6}
@media(min-width:700px){.grid{grid-template-columns:repeat(3,1fr)}.hero{aspect-ratio:16/9}}
</style>
</head>
<body>
<header class="top"><a class="logo" href="../rentals.html">好租 Howzu</a><a class="all" href="../rentals.html">全部房源 ›</a></header>
<main>
<div class="hero">${P.length ? `<a href="${esc(full)}"><img src="${esc(rel(P[0]))}" alt="${esc(x.title)}"></a>` : ""}${isLet(x) ? '<span class="let">已租出</span>' : ""}${P.length > 1 ? `<a class="n" href="${esc(full)}">共 ${P.length} 张照片</a>` : ""}</div>
<div class="price">${isLet(x) ? "已租出" : x.rentWeekly ? `$${esc(x.rentWeekly)}<small> / 周</small>` : "<small>租金请咨询</small>"}</div>
<h1>${esc(x.title)}</h1>
<div class="addr">📍 ${esc(hideUnit(x.address))}</div>
${tags.length ? `<div class="facts">${tags.map(esc).join("<span></span>")}</div>` : ""}
<div class="kf">${kf.cells.map(([k, v]) => `<div><small>${esc(k)}</small><b${v === "咨询" ? ' class="m"' : ""}>${esc(v)}</b></div>`).join("")}</div>
${chips.length ? `<div class="chips">${chips.map(c => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
${isLet(x) ? "" : `<div class="sp"><div class="sp-h">房屋信息</div><dl>${specs(x).map(([k, v]) => `<div${k === "设施" ? ' class="w"' : ""}><dt>${esc(k)}</dt><dd${v === TBC ? ' class="m"' : ""}>${esc(v)}</dd></div>`).join("")}</dl></div>`}
${isLet(x) ? "" : (T => `<div class="tr"><div class="tr-h">✓ ${esc(T.title)}</div><div class="tr-g">${T.items.map(([b, s]) => `<div><b>${esc(b)}</b><small>${esc(s)}</small></div>`).join("")}</div>${T.note ? `<div class="tr-n">${esc(T.note)}</div>` : ""}${T.guide ? `<a class="tr-l" href="${esc(T.guide)}">押金怎么交、怎么退？看中文指南 ›</a>` : ""}</div>`)(trust(x, letCount))}
${x.desc ? `<div class="desc">${esc(x.desc)}</div>` : ""}
${P.length > 1 ? `<div class="grid">${P.slice(1, 7).map(p => `<a href="${esc(full)}"><img src="${esc(rel(p))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}
<a class="more" href="${esc(full)}">查看全部照片 · 看对口学区 ›</a>
<a class="more" href="../rentals.html">${isLet(x) ? "这套已租出，看看其他在租房源 ›" : "看看其他在租房源 ›"}</a>
<p class="trust">好租 Howzu · 持牌物业管理 · 全程中文服务</p>
</main>
${isLet(x) || !tel ? "" : `<nav class="bar"><div><a class="g" href="sms:${esc(tel)}?&amp;body=${msg}" data-act="sms" data-id="${esc(x.id)}">💬 短信</a><a class="g" href="tel:${esc(tel)}" data-act="call" data-id="${esc(x.id)}">📞 电话</a><a class="p" href="${esc(full)}#book" data-act="book" data-id="${esc(x.id)}">📅 预约看房</a></div></nav>`}
${!isLet(x) && !tel && wx ? `<nav class="bar"><div><a href="${esc(full)}">微信咨询：${esc(wx)}</a></div></nav>` : ""}
</body>
</html>
`;
  }

  const STATIC = [
    ["https://howzu.com.au/", "monthly", "1.0"],
    ["https://howzu.com.au/rentals.html", "daily", "0.9"],
    ["https://howzu.com.au/invest.html", "monthly", "0.8"],
    ["https://howzu.com.au/post.html", "monthly", "0.6"],
    ["https://howzu.com.au/guide/property.html", "weekly", "0.7"],
    ["https://howzu.com.au/guide/bond.html", "monthly", "0.7"],
    ["https://howzu.com.au/guide/apply.html", "monthly", "0.7"],
  ];
  // guides：guide/ 目录下的其它文章文件名（如 "cgt-discount.html"），由构建脚本读目录传进来，写新文章不用再改这里。
  function sitemap(listings, guides) {
    const have = new Set(STATIC.map(r => r[0]));
    const extra = (guides || []).filter(f => /^[a-z0-9-]+\.html$/.test(f)).sort().map(f => ["https://howzu.com.au/guide/" + f, "monthly", "0.7"]).filter(r => !have.has(r[0]));
    const rows = STATIC.concat(extra).map(([u, f, p]) => `  <url><loc>${u}</loc><changefreq>${f}</changefreq><priority>${p}</priority></url>`);
    for (const x of listings) if (x.status === "live") rows.push(`  <url><loc>${esc(pageUrl(x))}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
  }
  const safeId = id => /^[\w-]+$/.test(String(id || ""));

  // 信任信息：自管房源讲清楚我们的保障；个人发布的房源给防骗提醒（不替私人房东做承诺）
  function trust(x, letCount) {
    if (x && x.user) return {
      kind: "user", title: "个人发布 · 好租已审核",
      items: [["看房前不转账", "不要先付定金或押金"], ["押金交 RTBA", "不交现金给个人"], ["签标准合同", "维州 CAV 标准租约"]],
      note: "这是房东或租客自己发布的房源，好租只做了信息审核。",
      guide: "/guide/first-rental.html#scam", guideText: "怎么识别租房骗局？看防骗 6 招 ›",
    };
    const n = +letCount || 0;
    return {
      kind: "own", title: "好租直管 · 持牌物业管理",
      items: [["零中介费", "看房签约不收费"], ["押金政府托管", "存进维州 RTBA"], ["全程中文", "看房、签约、报修"]],
      note: n > 0 ? `我们已帮 ${n} 套同类房源找到租客` : "",
      cases: n,
      guide: "/guide/bond.html",
    };
  }

  // 列表卡片：每套房同样几项（楼层 / 家具 / 楼内设施），取自房屋信息表；待确认的不显示，不编
  const CARD_AMEN = ["泳池", "健身房", "阳台", "空调", "洗碗机"];
  function cardFacts(x) {
    const S = Object.fromEntries(specs(x)), out = [];
    if (S["楼层"] !== TBC) out.push(S["楼层"]);
    if (S["家具"] !== TBC) out.push(S["家具"]);
    if (S["设施"] !== TBC) CARD_AMEN.filter(a => S["设施"].split("、").includes(a)).slice(0, 2).forEach(a => out.push(a));
    return out;
  }
  const api = { cardFacts, keyFacts, specs, compare, TBC, trust, render, sitemap, ogTitle, ogDesc, ogImage, pageUrl, hideUnit, safeId };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ListingPage = api;
})(this);
