# 生成 guide/zone-*-primary-*.html 小学学区租房页：python3 tools/primary_pages.py
# 重点：这个小学学区和哪些公立中学学区重叠（在学区里均匀取点计算比例），方便找“小学 + 中学”双学区。
import json,os,re,sys,html,urllib.parse
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import guide_gen as gen
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S=json.load(open(f"{R}/data/schools.json"));by={x["no"]:x for x in S}
ZP=json.load(open(f"{R}/data/zones_primary.json"))["features"];ZS=json.load(open(f"{R}/data/zones_secondary.json"))["features"]
ZG=json.load(open(f"{R}/data/zone_guides.json"))
PICK=["Balwyn North Primary School","Boroondara Park Primary School","Greythorn Primary School","Balwyn Primary School","Deepdene Primary School","Glen Waverley Primary School","Mount Waverley Primary School","Highvale Primary School","Camberwell Primary School","Canterbury Primary School","Chatham Primary School","Surrey Hills Primary School","Mont Albert Primary School","Box Hill North Primary School","Laburnum Primary School","Blackburn Primary School","Kew Primary School","Doncaster Gardens Primary School","Templestowe Park Primary School","Glen Iris Primary School","Ashburton Primary School","McKinnon Primary School","Brighton Primary School","Elsternwick Primary School","Caulfield Junior College","Carlton Gardens Primary School","Docklands Primary School","Vermont Primary School","Wheelers Hill Primary School","Mount View Primary School"]
def polys(f):
    g=f["geometry"];return [g["coordinates"]] if g["type"]=="Polygon" else g["coordinates"]
def inside(x,y,ring):
    c=False;j=len(ring)-1
    for i in range(len(ring)):
        xi,yi=ring[i];xj,yj=ring[j]
        if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi+1e-15)+xi:c=not c
        j=i
    return c
def inf(f,x,y): return any(inside(x,y,p[0]) and not any(inside(x,y,h) for h in p[1:]) for p in polys(f))
def bbox(f):
    xs=[c[0] for p in polys(f) for c in p[0]];ys=[c[1] for p in polys(f) for c in p[0]];return min(xs),max(xs),min(ys),max(ys)
def suburb(a):
    a=re.sub(r"(,\s*)Mt\.? ",r"\1Mount ",a,flags=re.I);m=re.search(r",\s*([^,]+?)\s+\d{4}$",a)
    return re.sub(r"\bMc(\w)",lambda k:"Mc"+k.group(1).upper(),m.group(1).title()) if m else ""
sec7=[f for f in ZS if f["properties"]["yl"] in ("7","7 to 12") and "Girls" not in f["properties"]["name"] and "Boys" not in f["properties"]["name"]]
girls=[f for f in ZS if "Girls" in f["properties"]["name"] or "Boys" in f["properties"]["name"]]
sbb=[(f,bbox(f)) for f in sec7]
out=[]
for name in PICK:
    fs=[f for f in ZP if f["properties"]["name"]==name]
    if not fs: continue
    f=fs[0];no=f["properties"]["no"];s=by.get(no)
    x0,x1,y0,y1=bbox(f);N=40;pts=[]
    for i in range(N):
        for j in range(N):
            x=x0+(x1-x0)*(i+.5)/N;y=y0+(y1-y0)*(j+.5)/N
            if inf(f,x,y): pts.append((x,y))
    cnt={}
    for x,y in pts:
        for g,b in sbb:
            if b[0]<=x<=b[1] and b[2]<=y<=b[3] and inf(g,x,y): cnt[g["properties"]["no"]]=cnt.get(g["properties"]["no"],0)+1
    ov=sorted(((n,c/len(pts)) for n,c in cnt.items() if c/len(pts)>=0.03),key=lambda t:-t[1]) if pts else []
    def sname(n):
        sc=by.get(n);nm=next(g["properties"]["name"] for g in sec7 if g["properties"]["no"]==n)
        vce=f"（2025 VCE 中位分 {sc['vce_med']:.0f}）" if sc and sc.get("vce_med") else ""
        link=f'<a href="/guide/{ZG[str(n)]}.html">{html.escape(nm)}</a>' if str(n) in ZG else html.escape(nm)
        return nm,link+vce
    ovl=[(sname(n),p) for n,p in ov]
    gl=[g["properties"]["name"] for g in girls if pts and sum(1 for x,y in pts if inf(g,x,y))/len(pts)>=0.03]
    subs=sorted({suburb(y["addr"]) for y in S if y.get("lat") and inf(f,y["lng"],y["lat"])}|({suburb(s["addr"])} if s else set()))
    subs=[x for x in subs if x]
    geo=[[[round(c[0],5),round(c[1],5)] for c in p[0]] for p in polys(f)]
    sl="zone-"+re.sub(r"[^a-z0-9]+","-",name.lower()).strip("-")
    rows="".join(f"<tr><td>{l}</td><td>约 {p*100:.0f}%</td></tr>" for (nm,l),p in ovl)
    top=ovl[0][0][0] if ovl else ""
    sm=[f"<b>{html.escape(name)}</b> 是公立小学{('，地址 '+html.escape(s['addr'])) if s else ''}。",
        "住在学区内，孩子<b>保证有学位</b>；租房和买房一样算数，租约可以用来报名。",
        (f"这个小学学区大部分对口中学是 <b>{html.escape(top)}</b>（约占 {ovl[0][1]*100:.0f}% 的面积）" + (f"，其余部分对口 {'、'.join(html.escape(n) for (n,_),_ in ovl[1:3])}" if len(ovl)>1 else "") + "。") if ovl else "中学学区要按具体地址查。",
        "想要“小学 + 中学”双学区，就在两个学区重叠的部分找房，签约前按具体地址到 Find my School 核对。",
        "租期要覆盖开学第一天；报名的家长要写进租约。"]
    body=f'''<h2>学区地图（2027）</h2>
<div id="zmap" style="height:340px;border-radius:16px;overflow:hidden;background:#eef2f0;margin:8px 0"></div>
<p class="meta" style="margin:6px 0 0">橙色为 {html.escape(name)} 的 2027 小学学区，蓝色虚线为对口公立中学学区。仅供参考，以 Find my School 为准。</p>
<h2>这个小学学区对口哪所中学？</h2>
{f'<div class="ex"><table>{rows}</table></div><p class="meta">按学区面积估算（在学区内均匀取点计算），不代表住户比例。</p>' if rows else '<p>请按具体地址查询。</p>'}{f'<p>另外，部分地址还在单性别学校 <b>{html.escape("、".join(gl))}</b> 的学区内（只对女生或男生适用）。</p>' if gl else ''}
<h2>学区里有哪些区？</h2>
<p>{html.escape("、".join(subs)) if subs else "见地图"}。同一个区可能只有一部分在学区里，一定按具体地址查。</p>
<h2>在这个学区租房</h2>
<ol class="steps">
<li><b>先核对地址</b>：用 <a href="/">好租查学区</a> 输入地址，再到 Find my School 核对。</li>
<li><b>报名的家长写进租约，租期覆盖开学第一天</b>，详见 <a href="/guide/school-zone.html">按学区租房</a>。</li>
<li><b>没找到合适的</b>：<a href="/rentals.html?la={urllib.parse.quote(name+' 学区')}#leadCard">留下需求</a>（已帮你填好学校），有学区内的房源第一时间通知你。</li>
</ol>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>
<script>
window.addEventListener("load",function(){{try{{var G={json.dumps(geo)},S={json.dumps([[[[round(c[0],5),round(c[1],5)] for c in p[0]] for p in polys(g)] for g in sec7 if any(g["properties"]["no"]==n for n,_ in ov)])};var m=L.map("zmap",{{scrollWheelZoom:false}});L.tileLayer("https://tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png",{{maxZoom:18,attribution:"&copy; OpenStreetMap"}}).addTo(m);S.forEach(function(P){{L.polygon(P.map(function(r){{return r.map(function(c){{return [c[1],c[0]]}})}}),{{color:"#2563eb",weight:2,dashArray:"6 4",fillOpacity:.04}}).addTo(m)}});var p=L.polygon(G.map(function(r){{return r.map(function(c){{return [c[1],c[0]]}})}}),{{color:"#c2410c",weight:2,fillOpacity:.15}}).addTo(m);{f'L.circleMarker([{s["lat"]},{s["lng"]}],{{radius:7,color:"#c2410c",fillColor:"#c2410c",fillOpacity:1}}).addTo(m).bindPopup({json.dumps(name)});' if s and s.get("lat") else ''}m.fitBounds(p.getBounds(),{{padding:[10,10]}});}}catch(e){{document.getElementById("zmap").textContent="地图加载失败，请到 Find my School 查看学区。"}}}});
</script>'''
    title=f"{name} 学区租房指南：学区地图、对口中学和双学区"
    desc=f"{name} 2027 小学学区地图，学区覆盖的区，以及这个小学学区对口哪所公立中学（按面积估算），帮你找“小学 + 中学”双学区租房。"
    gen.build(dict(slug=sl,section="rental",kick="小学学区",org="维州教育部 Find my School ",title=title,desc=desc,sum=sm,body=body,
      disc="本文只是通俗说明，不构成法律或教育建议。学区每年可能调整，以 Find my School、学校和维州教育部官网为准；重叠比例按面积估算，仅供参考。",
      cta='<section class="cta">\n<h3>想在好学区附近租房？</h3>\n<p>好租房源全程中文、持牌管理、押金交政府 RTBA 托管、租客零中介费。</p>\n<div class="b"><a href="/rentals.html">看在租房源</a><a class="g" href="/rentals.html#leadCard">留下需求，有房通知你</a></div>\n</section>',
      sources=[("Find my School（维州官方学区查询）","https://www.findmyschool.vic.gov.au"),("DataVic · Victorian Government School Zones 2027","https://discover.data.vic.gov.au/dataset/victorian-government-school-zones-2027")]))
    out.append((sl,name,suburb(s["addr"]) if s else "",top,no))
json.dump(out,open(os.path.join(R,"tools","primary_pages.json"),"w"),ensure_ascii=False)
_zgp=os.path.join(R,"data","zone_guides.json");_zg=json.load(open(_zgp));_zg.update({str(o[4]):o[0] for o in out});json.dump(_zg,open(_zgp,"w"),separators=(",",":"))
print(len(out))
