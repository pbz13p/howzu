# 在 GitHub Actions 上跑：从公开新闻订阅源（RSS/Atom）收集近 36 小时的标题和链接 → data/news/raw-YYYY-MM-DD.json
# 只存标题、链接、来源、时间、简介前 200 字（用于写中文摘要），不存全文。
import json, re, datetime, html, urllib.request, xml.etree.ElementTree as ET, email.utils
FEEDS = [  # (来源名, 订阅源, 默认分类)
 ("ABC 新闻", "https://www.abc.net.au/news/feed/51120/rss.xml", ""),
 ("ABC 新闻", "https://www.abc.net.au/news/feed/45910/rss.xml", ""),
 ("SBS 新闻", "https://www.sbs.com.au/news/feed", ""),
 ("SBS 中文", "https://www.sbs.com.au/language/chinese/zh-hans/feed", ""),
 ("卫报澳洲", "https://www.theguardian.com/australia-news/rss", ""),
 ("The Conversation", "https://theconversation.com/au/articles.atom", ""),
 ("澳联储 RBA", "https://www.rba.gov.au/rss/rss-cb-media-releases.xml", "地产"),
 ("Domain 新闻", "https://www.domain.com.au/news/feed/", "地产"),
 ("realestate 新闻", "https://www.realestate.com.au/news/feed/", "地产"),
 ("维州州长新闻稿", "https://www.premier.vic.gov.au/rss.xml", "墨尔本"),
 ("移民局新闻", "https://minister.homeaffairs.gov.au/_layouts/15/feed.aspx?xsl=1&web=%2F&page=c0a7e9e5-0f5b-4b4e-9b3b-3f0b5e8b1c6b&wp=baf2ac10-6f2c-4d5e-a3a8-8a6d1d5f6f6e", "移民"),
]
CATS = [("地产", r"rent|renter|tenan|landlord|housing|home loan|mortgage|property|auction|clearance|real estate|interest rate|RBA|租|房"),
        ("移民", r"visa|migra|international student|citizenship|permanent resid|Home Affairs|签证|移民|留学"),
        ("中澳", r"China|Chinese|Beijing|Xi Jinping|中国|华人"),
        ("墨尔本", r"Melbourne|Victoria|Victorian|VicPol|Allan|墨尔本|维州"),
        ("生活", r"Medicare|cost of living|price|petrol|energy bill|weather|BOM|school|health|transport|train|tram|超市|生活")]
def cat(t, d):
    for c, rx in CATS:
        if re.search(rx, t, re.I): return c
    return d or "澳洲"
def text(e, *tags):
    for t in tags:
        x = e.find(t)
        if x is not None:
            v = x.text or x.get("href") or ""
            if v.strip(): return v.strip()
    return ""
now = datetime.datetime.now(datetime.timezone.utc); cut = now - datetime.timedelta(hours=36)
items, log = [], []
for name, url, d in FEEDS:
    try:
        raw = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (howzu.com.au news digest)"}), timeout=40).read()
        root = ET.fromstring(raw); n = 0
        for e in root.iter():
            tag = e.tag.split("}")[-1]
            if tag not in ("item", "entry"): continue
            ns = {c.tag.split("}")[-1]: c for c in e}
            title = html.unescape(re.sub("<[^>]+>", "", (ns.get("title").text if ns.get("title") is not None else "") or "")).strip()
            link = ""
            if ns.get("link") is not None: link = (ns["link"].text or ns["link"].get("href") or "").strip()
            when = None
            for k in ("pubDate", "published", "updated", "date"):
                if ns.get(k) is not None and ns[k].text:
                    s = ns[k].text.strip()
                    try: when = email.utils.parsedate_to_datetime(s)
                    except Exception:
                        try: when = datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))
                        except Exception: pass
                    break
            if when and when.tzinfo is None: when = when.replace(tzinfo=datetime.timezone.utc)
            if not title or not link or (when and when < cut): continue
            desc = ""
            for k in ("description", "summary", "content"):
                if ns.get(k) is not None and ns[k].text: desc = html.unescape(re.sub("<[^>]+>", " ", ns[k].text)); break
            desc = re.sub(r"\s+", " ", desc).strip()[:200]
            items.append({"src": name, "title": title, "link": link, "when": when.isoformat() if when else "", "desc": desc, "cat": cat(title + " " + desc, d)}); n += 1
        log.append(f"{name}: {n}")
    except Exception as ex:
        log.append(f"{name}: 失败 {type(ex).__name__}")
seen, out = set(), []
for it in sorted(items, key=lambda x: x["when"], reverse=True):
    k = re.sub(r"\W+", "", it["title"].lower())[:60]
    if k in seen: continue
    seen.add(k); out.append(it)
day = (now + datetime.timedelta(hours=11)).date().isoformat()
json.dump({"fetched": now.isoformat(), "log": log, "items": out[:150]}, open(f"data/news/raw-{day}.json", "w"), ensure_ascii=False, indent=0)
print("\n".join(log)); print("共", len(out), "条，按分类：", {c: sum(1 for x in out if x["cat"] == c) for c in set(x["cat"] for x in out)})
