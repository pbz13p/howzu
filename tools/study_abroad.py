# 生成 guide/study-abroad.html 留学生远程租房专区：python3 tools/study_abroad.py
# 数据：data/rent_check.json（DFFH 周租中位数）、data/listings.json（在租房源，build-listing-pages.js 也会刷新）
import json,os,sys,math,html
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import guide_gen as gen
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=json.load(open(f"{R}/data/rent_check.json"))
L=[x for x in json.load(open(f"{R}/data/listings.json"))["listings"] if x.get("status")=="live"]
e=html.escape
Q=D["rent_quarter"]; QZ=f'{Q[:4]} 年 {int(Q[5:])} 月季度'; QE=f'quarter to {["","","","Mar","","","Jun","","","Sep","","","Dec"][int(Q[5:])]} {Q[:4]}'
def grp(sub):
    for g in D["groups"]:
        if sub.upper() in g["suburbs"]: return g
def rent(sub):
    g=grp(sub)
    if not g: return None
    r=g["rents"]; return {k:r[k]["now"] for k in ("1 bedroom flat","2 bedroom flat") if k in r}
def km(a,b,c,d):
    r=math.pi/180;h=math.sin((c-a)*r/2)**2+math.cos(a*r)*math.cos(c*r)*math.sin((d-b)*r/2)**2;return 2*6371*math.asin(math.sqrt(h))
def est(d):  # 和 js/commute.js 同一套估算
    if d<1.2: m=max(1,round(d*1.3/4.8*60)); return f"步行约 {m} 分钟",f"about {m} min walk"
    m=max(15,round((10+d*2.6)/5)*5); return f"公交约 {m} 分钟",f"about {m} min by public transport"
# 区：中文名、英文、listings.json 里的 suburb、区中心点、区域页
AR={"cbd":("墨尔本 CBD","Melbourne CBD","Melbourne CBD",-37.8136,144.9631,"area-melbourne-cbd","Melbourne"),
 "southbank":("Southbank","Southbank","Southbank",-37.8226,144.9646,"area-southbank","Southbank"),
 "docklands":("Docklands","Docklands","Docklands",-37.816,144.946,"area-docklands","Docklands"),
 "carlton":("Carlton","Carlton","Carlton",-37.8001,144.9671,"area-carlton","Carlton"),
 "parkville":("Parkville","Parkville","Parkville",-37.787,144.951,"area-parkville","Parkville"),
 "northmelb":("North Melbourne","North Melbourne","North Melbourne",-37.799,144.946,"area-north-melbourne","North Melbourne"),
 "brunswick":("Brunswick","Brunswick","Brunswick",-37.767,144.962,"area-brunswick","Brunswick"),
 "clayton":("Clayton","Clayton","Clayton",-37.9245,145.1196,"area-clayton","Clayton"),
 "glen":("Glen Waverley","Glen Waverley","Glen Waverley",-37.8781,145.1648,"area-glen-waverley","Glen Waverley"),
 "mtw":("Mount Waverley","Mount Waverley","Mount Waverley",-37.877,145.129,"area-mount-waverley","Mount Waverley"),
 "burwood":("Burwood","Burwood","Burwood",-37.85,145.115,"area-burwood","Burwood"),
 "boxhill":("Box Hill","Box Hill","Box Hill",-37.8189,145.125,"area-box-hill","Box Hill"),
 "bundoora":("Bundoora","Bundoora","Bundoora",-37.698,145.06,"area-bundoora","Bundoora"),
}
SCH=[("monash","莫纳什大学 Clayton 校区","Monash University (Clayton)",-37.9105,145.1362,["clayton","mtw","glen"]),
 ("um","墨尔本大学 Parkville 校区","University of Melbourne (Parkville)",-37.7963,144.9614,["carlton","parkville","northmelb","brunswick","cbd"]),
 ("rmit","RMIT 城市校区和 CBD 各校","RMIT City campus and CBD colleges",-37.8083,144.9631,["cbd","southbank","docklands","carlton"]),
 ("deakin","迪肯大学 Burwood 校区","Deakin University (Burwood)",-37.8475,145.1149,["burwood","boxhill","glen"]),
 ("latrobe","拉筹伯大学 Bundoora 校区","La Trobe University (Bundoora)",-37.7215,145.0475,["bundoora"]),
]
def li_listing(x): return f'<li><a href="/rent/{e(x["id"])}.html">{e(x["title"])}{" · $"+e(str(x["rentWeekly"]))+"/周" if x.get("rentWeekly") else ""}</a></li>'
def listings_html(subs):
    xs=[x for x in L if x.get("suburb") in subs]
    return "".join(li_listing(x) for x in xs) if xs else '<li>这几个区暂时没有在租房源。<a href="/rentals.html#leadCard">留下需求</a>，有房第一时间通知你。</li>'
blocks=[]
for k,zh,en,la,ln,areas in SCH:
    rows=[]
    for a in areas:
        n,ne,sub,al,ag,slug,_=AR[a]; c,ce=est(km(al,ag,la,ln)); r=rent(sub if sub!="Melbourne CBD" else "Melbourne")
        rz=" / ".join(f'{"1 房" if t.startswith("1") else "2 房"} ${v}' for t,v in (r or {}).items()) or "—"
        re_=" / ".join(f'{t[0]}-bed ${v}' for t,v in (r or {}).items()) or "—"
        rows.append(f'<tr><td><a href="/guide/{slug}.html" data-en="{e(ne)}">{e(n)}</a></td><td data-en="{e(re_)}">{e(rz)}</td><td data-en="{e(ce)}">{e(c)}</td></tr>')
    subs=[AR[a][2] for a in areas]
    blocks.append(f'''<section class="sch" id="{k}">
<h2 data-en="{e(en)}">{e(zh)}</h2>
<div class="ex"><table><tr><th data-en="Area">常住的区</th><th data-en="Median weekly rent (DFFH)">周租中位数（DFFH）</th><th data-en="To campus (estimate)">到校（估算）</th></tr>{"".join(rows)}</table></div>
<p class="sm" data-en="Rents: DFFH Rental Report, {QE}, new lettings median for 1- and 2-bedroom flats. Commute: straight-line estimate, check the PTV Journey Planner before signing.">租金：DFFH 租金报告 {QZ}，1 房、2 房公寓新租约中位数。通勤：按直线距离估算，签约前请用 PTV 官方行程规划核实。</p>
<h3 data-en="Live listings near campus">附近在租房源</h3>
<ul class="dot" id="sa-{k}" data-subs="{e(json.dumps(subs,ensure_ascii=False))}">{listings_html(subs)}</ul>
</section>''')
CAV="https://www.consumer.vic.gov.au/housing/renting"
body=f'''<p class="lead" data-en="Coming to Melbourne for the February 2027 intake? Most students apply from November to January — while still overseas. This page puts what you need in one place: where to live for each university, what rent really costs, what to send when you have no Australian rental history, how not to get scammed, and a paid inspection service if you can't come and see the place yourself.">2027 年 2 月开学？大多数同学 11 月到次年 1 月就要申请房子，这时人还在国内。这一页把要用的都放在一起：每所学校附近住哪、房租多少、没有澳洲租房记录要准备什么材料、怎么防骗，以及人来不了时的“代看房”。</p>
<nav class="jump"><a href="#monash" data-en="Monash Clayton">莫纳什 Clayton</a><a href="#um" data-en="UniMelb Parkville">墨大 Parkville</a><a href="#rmit">RMIT / CBD</a><a href="#deakin" data-en="Deakin Burwood">迪肯 Burwood</a><a href="#latrobe" data-en="La Trobe Bundoora">拉筹伯 Bundoora</a><a href="#docs" data-en="Documents">申请材料</a><a href="#scam" data-en="Avoid scams">防骗</a><a href="#book" data-en="Book an inspection">预约代看房</a></nav>
{"".join(blocks)}
<section id="docs">
<h2 data-en="No Australian rental history? What to send instead">没有澳洲租房记录？用这些材料代替</h2>
<p data-en="Agents mainly want to know two things: can you pay, and will you look after the place. Without local history, prove both another way:">中介最想知道两件事：你付不付得起、会不会爱护房子。没有本地记录，就换一种方式证明：</p>
<ul>
<li data-en="Proof of funds: bank statements or a deposit certificate (overseas accounts are fine; add an English translation).">资金证明：近几个月银行流水或存款证明（国内账户也可以，附英文翻译）。</li>
<li data-en="Offer letter / Confirmation of Enrolment (CoE) and your student visa grant.">录取信或 CoE（确认入学通知书），以及学生签证批准信。</li>
<li data-en="Scholarship letter, if you have one — it shows regular income.">奖学金证明（如果有），说明有稳定收入。</li>
<li data-en="A guarantor or parents' letter of financial support, with their bank statements.">担保人或父母的资助说明，附他们的银行流水。</li>
<li data-en="References: a previous landlord or dorm manager overseas, or a teacher.">推荐人：国内房东、宿舍管理员或老师都可以。</li>
<li data-en="Offering extra rent in advance? In Victoria a landlord cannot ask for, invite or accept more than one month's rent in advance (14 days if rent is paid weekly), unless the rent is over $900 a week. Bond is normally capped at one month's rent.">想多付几个月房租换取通过？维州法律规定：房东不能要求、引导或接受超过 1 个月的预付租金（按周付的最多 14 天），周租超过 $900 的除外；押金一般也最多 1 个月租金。</li>
</ul>
<p class="sm" data-en="Rules from Consumer Affairs Victoria (CAV), checked 18 Nov 2026 — links at the bottom of the page. This is general information, not legal advice.">规则来自维州消费者事务局（CAV）官网，2026 年 11 月 18 日查阅，链接见文末。只是通俗说明，不是法律意见。</p>
</section>
<section id="scam">
<h2 data-en="Renting from overseas: 3 rules against scams">远程租房防骗 3 条</h2>
<ol>
<li data-en="Never transfer money for a place nobody you trust has seen. Fake landlords copy photos from real listings.">没看过房（自己或信得过的人）就不转钱。假房东会盗用真房源的照片。</li>
<li data-en="Bond only goes to the RTBA (the Victorian government bond authority) — never to a personal account. You'll get an RTBA receipt.">押金只交给维州政府押金管理局 RTBA，不转到任何个人账户；交了会收到 RTBA 的回执。</li>
<li data-en="Be suspicious of rent far below the DFFH median above, or anyone rushing you to pay today.">房租比上面的 DFFH 中位数便宜很多，或者催你“今天不付就没了”，都要警惕。</li>
</ol>
<p><a href="/guide/first-rental.html#scam" data-en="Full scam checklist: first rental in Melbourne">完整防骗清单：留学生第一次在墨尔本租房</a> · <a href="/guide/bond.html" data-en="How bond works">押金怎么交、怎么退</a> · <a href="/guide/apply.html" data-en="How to apply">怎么申请租房</a></p>
</section>
<section id="book" class="book">
<h2 data-en="Can't come to Melbourne? Book a paid inspection">人在国外？预约代看房</h2>
<p data-en="A Chinese-speaking Howzu team member visits the property for you and sends a report:">好租的中文工作人员替你到现场看房，看完发你一份报告：</p>
<ul>
<li data-en="Photos and video of every room, plus a live video call if you want one.">每个房间的照片和视频；想要的话可以视频直播看房。</li>
<li data-en="Item-by-item check against Victoria's rental minimum standards (15 categories: locks, heating, kitchen, bathroom, mould and damp, window coverings and more).">按维州出租房最低标准逐项核对（共 15 类：门锁、暖气、厨房、卫生间、霉菌潮湿、窗帘等）。</li>
<li data-en="The surroundings: noise, nearest tram/train stop, supermarket, how it feels at night.">周边环境：噪音、最近的电车或火车站、超市、晚上安不安全。</li>
</ul>
<p class="price" data-en="Price: to be confirmed — send a request and we'll quote before anything is booked. No payment online.">价格：待定 · 先咨询。提交后我们先报价，你同意了才安排，网上不收任何钱。</p>
<div id="ibook"><noscript><p>请打开 JavaScript 后填写预约表，或直接电话 / 短信 0431 438 595。</p></noscript></div>
<p class="sm" data-en="We're inspecting for you, not for the landlord. We don't take bond or rent; you still sign and pay through the agent and the RTBA.">我们替你看房，不代表房东。我们不收押金和房租；签约和付款仍然通过中介和 RTBA。</p>
</section>'''
STY='''<style>.lead{font-size:16px}.jump{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 4px}.jump a{border:1px solid #cfe3da;border-radius:16px;padding:4px 10px;font-size:13px;text-decoration:none;color:#0f6b4f;background:#f2f8f5}
.sch{margin-top:22px}.sch table{width:100%}.sch th{text-align:left;font-size:13px;color:#555}.sm{font-size:13px;color:#666}
.book{background:#f2f8f5;border:1px solid #cfe3da;border-radius:12px;padding:12px 14px 70px;margin-top:22px}.price{font-weight:600}
#ibook form{display:grid;gap:8px;margin-top:8px}#ibook input,#ibook textarea{font:inherit;padding:10px;border:1px solid #cdd;border-radius:8px;width:100%;box-sizing:border-box}
#ibook label.ck{display:flex;gap:8px;align-items:center;font-size:15px}#ibook label.ck input{width:auto}#ibook .go{background:#0f6b4f;color:#fff;border:0;border-radius:8px;padding:12px;font-size:16px;font-weight:600}
#ibook .m{font-size:13px;color:#666}</style>'''
A=dict(slug="study-abroad",section="rent",kick="开学季专区",title="人在国内租墨尔本房：留学生开学季专区（2027 年 2 月开学）",
 desc="2027 年 2 月开学的留学生人在国内怎么租墨尔本房：莫纳什、墨大、RMIT、迪肯、拉筹伯附近住哪、DFFH 周租中位数、到校通勤，没有本地租房记录的替代材料，远程防骗，以及代看房预约。",
 org="维州消费者事务局（CAV）、维州家庭公平住房部（DFFH）",
 sum=["每所学校附近常住的区、真实周租中位数（DFFH 官方数据）和到校时间，表格一眼看完。","没有澳洲租房记录：准备资金证明、录取信或 CoE、担保人，不用靠多付房租硬换。","防骗：没看过房不转钱；押金只交政府 RTBA，不进个人账户。","人来不了：预约好租代看房，照片、视频、直播，加最低标准逐项核对。"],
 body=body,
 cta='<section class="cta">\n<h3>开学前想先锁定房子？</h3>\n<p>好租房源全程中文、持牌管理、押金交政府 RTBA 托管、租客零中介费。</p>\n<div class="b"><a href="/rentals.html">看在租房源</a><a class="g" href="/rentals.html#leadCard">留下需求，有房通知你</a></div>\n</section>',
 sources=[("CAV 预付租金规定","https://www.consumer.vic.gov.au/housing/renting/rent-bond-bills-and-condition-reports/rent/rent-payments-and-rent-in-advance"),
  ("CAV 签约须知（押金、预付租金上限）","https://www.consumer.vic.gov.au/housing/renting/starting-and-changing-rental-agreements/applying-signing-and-moving-in/knowing-your-rights-when-signing-an-agreement"),
  ("CAV 申请租房","https://www.consumer.vic.gov.au/housing/renting/starting-and-changing-rental-agreements/applying-signing-and-moving-in/applying-for-a-property"),
  ("CAV 出租房最低标准（15 类）","https://www.consumer.vic.gov.au/housing/renting/repairs-alterations-safety-and-pets/minimum-standards/minimum-standards-for-rental-properties"),
  ("Study Melbourne 租房骗局（维州政府）","https://www.studymelbourne.vic.gov.au/living-here/accommodation/rental-scams"),
  ("DFFH 租金报告","https://www.dffh.vic.gov.au/publications/rental-report")],
 disc="本页是通俗说明，不构成法律意见；规则以 CAV 官网为准（2026 年 11 月 18 日查阅）。租金是区域中位数，不代表某一套房的价格。")
gen.build(A)
f=f"{R}/guide/study-abroad.html";s=open(f,encoding="utf8").read()
s=s.replace("2026 年 11 月 12 日更新","2026 年 11 月 18 日更新").replace('"2026-11-12"','"2026-11-18"').replace("</head>",STY+"\n</head>",1)
s=s.replace('<script src="/js/contact-fab.js','<script src="/js/inspect-book.js?v=20261118" defer></script><script src="/js/i18n-en.js?v=20261118" defer></script><script src="/js/i18n.js?v=20261117b" defer></script><script src="/js/contact-fab.js',1)
open(f,"w",encoding="utf8").write(s);print("guide/study-abroad.html")
