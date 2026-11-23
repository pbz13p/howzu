# 在 GitHub Actions 上跑（工作环境连不上政府网站）：下载墨尔本市政府 CLUE 开放数据 + OpenStreetMap，写 data/clue_buildings.json、data/osm_pois.json
# 数据来源：City of Melbourne Open Data（CLUE，CC BY 4.0）；OpenStreetMap（ODbL）
import json, urllib.request, urllib.parse, datetime, collections, sys
API = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/"
def get(url, data=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "howzu.com.au building pages (open data)"})
    return json.load(urllib.request.urlopen(req, timeout=180))
def latest_year(ds):
    r = get(API + ds + "/records?" + urllib.parse.urlencode({"select": "max(census_year) as y", "limit": 1}))
    return int(str(r["results"][0]["y"])[:4])
def export(ds, where):
    return get(API + ds + "/exports/json?" + urllib.parse.urlencode({"where": where}))
today = datetime.date.today().isoformat()
# 1 住宅套数（按楼）
DW = "residential-dwellings"; ydw = latest_year(DW)
dw = export(DW, f"year(census_year)={ydw}")
by = collections.defaultdict(lambda: {"dwellings": 0})
for r in dw:
    k = r.get("property_id") or r.get("building_address")
    b = by[k]; b["dwellings"] += int(r.get("dwelling_number") or 0)
    b.update(property_id=r.get("property_id"), address=r.get("building_address"), area=r.get("clue_small_area"), lat=r.get("latitude"), lon=r.get("longitude"))
    b.setdefault("types", collections.Counter())[r.get("dwelling_type") or "?"] += int(r.get("dwelling_number") or 0)
# 2 楼名、建成年份、层数
BL = "buildings-with-name-age-size-accessibility-and-bicycle-facilities"; ybl = latest_year(BL)
bl = {str(r.get("property_id")): r for r in export(BL, f"year(census_year)={ybl}")}
AREAS = {"Melbourne (CBD)", "Southbank", "Docklands", "Carlton", "West Melbourne (Residential)", "North Melbourne", "East Melbourne", "Parkville"}
out = []
for b in by.values():
    if b["dwellings"] < 80: continue
    x = bl.get(str(b["property_id"]), {})
    out.append({"property_id": b["property_id"], "address": b["address"], "area": b["area"], "lat": b["lat"], "lon": b["lon"],
                "dwellings": b["dwellings"], "dwelling_types": dict(b["types"]),
                "name": (x.get("building_name") or "").strip() or None, "built": x.get("construction_year"),
                "floors": x.get("number_of_floors_above_ground"), "use": x.get("predominant_space_use")})
out.sort(key=lambda r: -r["dwellings"])
json.dump({"source": "City of Melbourne Open Data — CLUE: Residential dwellings (census %d) and Buildings with name, age, size (census %d). CC BY 4.0" % (ydw, ybl),
           "fetched": today, "dwellings_year": ydw, "buildings_year": ybl, "buildings": out}, open("data/clue_buildings.json", "w"), ensure_ascii=False, indent=0)
print("CLUE buildings:", len(out), "dwellings census", ydw, "buildings census", ybl)
# 3 OpenStreetMap：电车站、火车站、超市、中餐（墨尔本 CBD 及周边）
# 火车站用 nwr：City Loop 地下站（Melbourne Central、Flagstaff、Parliament）和 Southern Cross 在 OSM 里是面（way），只查 node 会漏掉
q = """[out:json][timeout:120];(
node["railway"="tram_stop"](-37.86,144.92,-37.77,145.00);
node["public_transport"="stop_position"]["tram"="yes"](-37.86,144.92,-37.77,145.00);
nwr["railway"="station"](-37.86,144.92,-37.77,145.00);
nwr["shop"="supermarket"](-37.86,144.92,-37.77,145.00);
nwr["amenity"="restaurant"]["cuisine"~"chinese|sichuan|cantonese|dumpling|hot_pot|noodle|taiwanese|malaysian|asian"](-37.86,144.92,-37.77,145.00);
);out center tags;"""
o = get("https://overpass-api.de/api/interpreter", data=urllib.parse.urlencode({"data": q}).encode())
pois = []
for e in o.get("elements", []):
    t = e.get("tags", {}); lat = e.get("lat") or e.get("center", {}).get("lat"); lon = e.get("lon") or e.get("center", {}).get("lon")
    if lat is None: continue
    kind = "station" if t.get("railway") == "station" else "tram" if (t.get("railway") == "tram_stop" or t.get("tram") == "yes") else "supermarket" if t.get("shop") == "supermarket" else "food"
    pois.append({"k": kind, "n": t.get("name") or t.get("brand") or "", "zh": t.get("name:zh") or "", "c": t.get("cuisine", ""), "lat": lat, "lon": lon})
json.dump({"source": "© OpenStreetMap contributors (ODbL)", "fetched": today, "pois": pois}, open("data/osm_pois.json", "w"), ensure_ascii=False)
print("OSM pois:", collections.Counter(p["k"] for p in pois))
