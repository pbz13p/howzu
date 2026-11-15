/* 贴帖入库：把微信群 / 小红书的房源帖文字整理成好租的标准房源字段（浏览器和 node 测试共用）。
   只用规则识别，不调用 AI 接口（不花 API 额度）。识别不出的放进 missing（后台显示“待确认”），绝不编数据。
   字段和 post.html 发房源一致：类型、卧/卫/车位、家具、可入住日期、租期、押金、宠物、包不包水电网、设施，
   结构化选项按 post-form.js 的约定写进 highlights（"类型 公寓"、"押金 4 周"、"租期 12 个月"、"包网" 等）。 */
(function (root) {
  const CN = { 零: 0, 〇: 0, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const num = s => { s = String(s); if (/^\d+$/.test(s)) return +s; if (s === "十") return 10; if (/^十.$/.test(s)) return 10 + (CN[s[1]] || 0); if (/^.十$/.test(s)) return (CN[s[0]] || 0) * 10; return CN[s] != null ? CN[s] : NaN; };
  const N = "(\\d+|[一两二三四五六七八九十])";

  // 墨尔本华人常见区（中英文写法）→ 标准英文区名
  const SUBURBS = [
    ["Melbourne CBD", /\bCBD\b|墨尔本市中心|市中心|city\b|Melbourne\s*(?:VIC\s*)?3000/i],
    ["Southbank", /southbank|南岸/i], ["Docklands", /docklands|码头区/i], ["Carlton", /\bcarlton\b|卡尔顿/i],
    ["West Melbourne", /west\s*melbourne/i], ["North Melbourne", /north\s*melbourne/i], ["South Yarra", /south\s*yarra/i],
    ["Box Hill", /box\s*hill|博士山/i], ["Clayton", /\bclayton\b|克莱顿/i], ["Glen Waverley", /glen\s*waverley|\bGW\b|格伦韦弗利/i],
    ["Burwood", /\bburwood\b|伯伍德/i], ["Doncaster", /doncaster|当卡斯特|东卡/i], ["Mount Waverley", /mount\s*waverley|\bMW\b/i],
    ["Caulfield", /caulfield|考菲尔德/i], ["Hawthorn", /hawthorn|霍桑/i], ["Balwyn", /balwyn|巴尔温/i],
    ["Point Cook", /point\s*cook/i], ["Footscray", /footscray/i], ["Richmond", /richmond/i], ["Malvern East", /malvern\s*east/i],
    ["Bentleigh", /bentleigh/i], ["Parkville", /parkville/i], ["Brunswick", /brunswick/i], ["Kew", /\bkew\b/i],
  ];
  const AMEN = [["泳池", /泳池|游泳池|pool/i], ["健身房", /健身房|gym/i], ["电梯", /电梯|lift|elevator/i], ["阳台", /阳台|balcony/i],
    ["空调", /空调|冷暖|aircon|air\s*con|split\s*system/i], ["洗衣机", /洗衣机|washing\s*machine|washer/i], ["烘干机", /烘干|dryer/i],
    ["洗碗机", /洗碗机|dishwasher/i], ["门禁/礼宾", /门禁|礼宾|concierge|保安/i]];
  const HI = [["近火车站", /火车站|train\s*station|近站/i], ["免费电车区", /免费电车|free\s*tram/i], ["近大学", /墨大|墨尔本大学|蒙纳士|莫纳什|monash|rmit|皇家理工|迪肯|deakin|大学/i],
    ["景观好", /景观|海景|城景|view/i], ["近华人超市", /华人超市|亚洲超市|中超|asian\s*grocer/i], ["安静", /安静|quiet/i]];

  function rent(t) {
    // 周租：$650/周、650pw、周租650、650 per week；月租折算成周租（×12÷52，取整到 5 元）
    let m = t.match(/(?:周租|租金|房租|rent)?\s*[$＄]?\s*(\d{3,4})\s*(?:澳?元|刀|aud)?\s*(?:\/|每|一|per\s*)?\s*(?:周|week|wk|pw)/i) || t.match(/周租\s*[:：]?\s*[$＄]?\s*(\d{3,4})/);
    if (m) return { weekly: +m[1], from: "week" };
    m = t.match(/月租\s*[:：]?\s*[$＄]?\s*(\d{3,5})/) || t.match(/[$＄]?\s*(\d{3,5})\s*(?:澳?元|刀)?\s*(?:\/|每|一|per\s*)\s*(?:月|month|pcm)/i);
    if (m) return { weekly: Math.round(+m[1] * 12 / 52 / 5) * 5, from: "month", monthly: +m[1] };
    m = t.match(/[$＄]\s*(\d{3,4})(?!\d)/);
    if (m && +m[1] >= 150 && +m[1] <= 3000) return { weekly: +m[1], from: "guess" };
    return null;
  }
  function rooms(t) {
    const r = {};
    let m = t.match(new RegExp(N + "\\s*(?:房|室|卧|bed(?:room)?s?|b(?=\\d|\\s*b))", "i")); if (m) r.beds = num(m[1]);
    if (/studio|开间|单身公寓/i.test(t) && r.beds == null) r.beds = 0;
    m = t.match(new RegExp(N + "\\s*(?:卫|厕|浴|bath(?:room)?s?|ba\\b)", "i")); if (m) r.baths = num(m[1]);
    m = t.match(/(\d)\s*b\s*(\d)\s*b/i); if (m) { r.beds = +m[1]; r.baths = +m[2]; }
    m = t.match(new RegExp(N + "\\s*(?:个)?\\s*(?:车位|car\\s*(?:park|space)s?)", "i")); if (m) r.cars = num(m[1]);
    else if (/无车位|没有车位|no\s*car\s*park/i.test(t)) r.cars = 0;
    else if (/带车位|含车位|有车位|car\s*park\s*included/i.test(t)) r.cars = 1;
    return r;
  }
  function avail(t, today) {
    if (/即可入住|随时入住|马上入住|立即入住|现在可入住|available\s*now|immediately/i.test(t)) return "马上";
    let m = t.match(/(\d{1,2})\s*[月\/.]\s*(\d{1,2})\s*[日号]?\s*(?:起|开始|可?入住|available)/) || t.match(/(?:入住|起租|available)\s*(?:日期|时间)?\s*[:：]?\s*(\d{1,2})\s*[月\/.]\s*(\d{1,2})/i);
    if (m) {
      const d = today || new Date(); let y = d.getFullYear(); const mo = +m[1], da = +m[2];
      if (mo < d.getMonth() + 1 - 1) y++; // 早于上个月的日期视为明年
      const p = n => String(n).padStart(2, "0"); return `${y}-${p(mo)}-${p(da)}`;
    }
    m = t.match(/(\d{1,2})\s*月\s*(?:初|中|底)?\s*(?:起|入住|开始)/); if (m) return `${m[1]} 月起（具体日期待确认）`;
    return null;
  }
  function contacts(t) {
    const phones = [...t.matchAll(/(?:\+?61\s*|0)4\d{2}[\s-]?\d{3}[\s-]?\d{3}/g)].map(x => x[0].replace(/[\s-]/g, ""));
    const wx = (t.match(/(?:微信|vx|v信|wx|wechat|weixin|➕v|\+v|加v)\s*(?:号)?\s*[:：]?\s*([A-Za-z][\w-]{5,19})/i) || [])[1] || null;
    return { phone: phones[0] || null, wechat: wx };
  }
  // 去掉个人电话和微信号（统一走好租咨询按钮），也去掉 emoji 标签行和平台话题标签
  function clean(t) {
    return t.replace(/(?:\+?61\s*|0)4\d{2}[\s-]?\d{3}[\s-]?\d{3}/g, "")
      .replace(/(?:微信|vx|v信|wx|wechat|weixin|➕v|\+v|加v)\s*(?:号)?\s*[:：]?\s*[A-Za-z][\w-]{5,19}/gi, "")
      .replace(/(?:电话|联系|tel|phone|call)\s*[:：]?\s*(?=\n|$)/gi, "")
      .replace(/#[^\s#]+/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function address(t) {
    const m = t.match(/(?:\d+[A-Za-z]?\s*\/\s*)?\d+[A-Za-z]?\s+[A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+)?\s+(?:St|Street|Rd|Road|Ave|Avenue|Pde|Parade|Dr|Drive|Ct|Court|Cres|Crescent|Pl|Place|Lane|Ln|Blvd|Boulevard|Way|Hwy|Highway|Tce|Terrace)\b\.?(?:,?\s*(?!VIC\b)[A-Z][A-Za-z]*(?:\s+(?!VIC\b)[A-Z][A-Za-z]*)*)?(?:,?\s*VIC)?(?:\s*\d{4})?/);
    return m ? m[0].replace(/\s+/g, " ").trim() : null;
  }

  function parse(text, today) {
    const t = String(text || ""), x = { highlights: [], missing: [] };
    const k = /单间|主卧|次卧|房间出租|合租|room\s*(?:for\s*)?rent/i.test(t) ? "单间出租" : /转租|顶租|lease\s*transfer|break\s*lease/i.test(t) ? "转租 / 顶租约" : /短租|short\s*term|日租/i.test(t) ? "短租" : "整套出租";
    x.kind = k;
    const r = rent(t); if (r) { x.rent_weekly = r.weekly; if (r.from === "month") x.rentNote = `原帖写月租 $${r.monthly}，已折算成周租`; if (r.from === "guess") x.rentNote = "原帖没写“周 / 月”，按周租理解，请核对"; } else x.missing.push("周租");
    Object.assign(x, rooms(t));
    if (x.beds == null && k !== "单间出租") x.missing.push("卧室数"); if (x.baths == null) x.missing.push("卫生间数"); if (x.cars == null) x.missing.push("车位");
    const ptype = /独立屋|别墅|\bhouse\b/i.test(t) ? "独立屋" : /联排|townhouse|unit\b/i.test(t) ? "联排别墅" : k === "单间出租" ? "单间" : /公寓|apartment|apt\b|高层|楼/i.test(t) ? "公寓" : null;
    if (ptype) x.highlights.push("类型 " + ptype); else x.missing.push("房屋类型");
    x.available = avail(t, today); if (!x.available) x.missing.push("可入住日期");
    x.furnished = /部分家具|半家具|部分家私/i.test(t) ? "部分家具" : /不带家具|无家具|空房|unfurnished/i.test(t) ? "不带家具" : /带家具|全家具|拎包入住|家具齐全|家私|fully\s*furnished|furnished/i.test(t) ? "带家具" : null;
    if (!x.furnished) x.missing.push("家具");
    let m = t.match(new RegExp("(?:租期|lease)\\s*[:：]?\\s*" + N + "\\s*(?:个)?\\s*月", "i")) || t.match(new RegExp(N + "\\s*(?:个)?月\\s*(?:起租|租期|lease)", "i"));
    const lease = m ? (num(m[1]) >= 12 ? "12 个月" : num(m[1]) === 6 ? "6 个月" : num(m[1]) + " 个月") : /一年|1\s*年|12\s*months?/i.test(t) ? "12 个月" : /半年|6\s*months?/i.test(t) ? "6 个月" : /租期灵活|灵活|flexible/i.test(t) ? "灵活可谈" : null;
    if (lease) x.highlights.push("租期 " + lease); else x.missing.push("租期");
    m = t.match(new RegExp("押金\\s*[:：]?\\s*(?:" + N + "\\s*(周|个?月)|[$＄]?\\s*(\\d{3,5}))"));
    const bond = m ? (m[3] ? `$${m[3]}` : /月/.test(m[2]) ? "1 个月" : num(m[1]) + " 周") : null;
    if (bond) x.highlights.push("押金 " + bond); else x.missing.push("押金");
    const pets = /不可养?宠物|不能养宠物|禁止宠物|no\s*pets?/i.test(t) ? "不可养宠物" : /可养宠物|宠物友好|可以养|pets?\s*(?:ok|allowed|friendly)/i.test(t) ? "可养宠物" : null;
    if (pets) x.highlights.push(pets); else x.missing.push("能否养宠物");
    const bills = [];
    if (/包\s*bills?|包所有账单|bills?\s*included|包水电网|水电网全包|包水电煤网/i.test(t)) bills.push("包水费", "包电费", "包网");
    else { if (/包水|水费全包|含水费/.test(t)) bills.push("包水费"); if (/包电|含电费/.test(t)) bills.push("包电费"); if (/包网|含网|网费全包|免费\s*wifi|wifi\s*included/i.test(t)) bills.push("包网"); }
    if (!bills.length && /不包|bills?\s*(?:not\s*included|excluded|另付|自理)|水电网自理|水电自理/i.test(t)) bills.push("不包水电网");
    if (bills.length) x.highlights.push(...bills); else x.missing.push("包不包水电网");
    for (const [name, re] of AMEN) if (re.test(t)) x.highlights.push(name);
    for (const [name, re] of HI) if (re.test(t)) x.highlights.push(name);
    x.suburb = (SUBURBS.find(([, re]) => re.test(t)) || [])[0] || null; if (!x.suburb) x.missing.push("区域");
    x.address = address(t); if (!x.address) x.missing.push("地址");
    x.contact = contacts(t);
    x.description = clean(t).slice(0, 3000);
    const typeWord = ptype === "单间" ? "单间" : ptype || "房源";
    x.title = `${x.suburb || "墨尔本"} ${x.beds != null ? (x.beds === 0 ? "开间" : `${x.beds} 房`) : ""}${x.baths != null ? ` ${x.baths} 卫` : ""} ${typeWord}`.replace(/\s+/g, " ").trim().slice(0, 80);
    return x;
  }
  // 发给房东的两段话术（只生成，不自动发）
  function askMsg() { return "你好，我是好租 Howzu（墨尔本中文租房网站 howzu.com.au）。看到你在出租房子，可以免费帮你挂到好租上，带地图、学区和通勤时间，租客咨询直接转给你。需要的话我帮你整理好，你确认后才会上线，不收任何费用。"; }
  function confirmMsg(link) { return `你好，你的房源我已经整理好了（还没有公开）。请点下面的链接核对租金和信息，确认无误点“确认上线”，我们审核后就会挂出来：\n${link}\n有任何要改的直接在页面里改就行。`; }
  const api = { parse, askMsg, confirmMsg, clean, rent };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PostParse = api;
})(typeof window !== "undefined" ? window : globalThis);
