"""Build compact site data from raw government files.

Inputs (raw/): school zones GeoJSON (DataVic, CC BY 4.0), school locations CSV
(DataVic, CC BY 4.0), VCAA Senior Secondary Completion and Achievement 2025.
Outputs (data/): zones_primary.json, zones_secondary.json, schools.json, meta.json
"""
import json, re, datetime, pathlib, difflib, sys
sys.setrecursionlimit(20000)
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / "raw", ROOT / "data"
OUT.mkdir(exist_ok=True)


def rnd(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 5), round(coords[1], 5)]
    return [rnd(c) for c in coords]


# 墨尔本都市圈保留原精度（fetch_raw.sh 已按 20 米误差简化）；都市圈以外的学区很大，
# 再按约 100 米误差简化，减小文件，避免查学区页面加载过慢。
METRO = (144.20, 145.70, -38.55, -37.35)  # lng_min, lng_max, lat_min, lat_max（含吉朗）
RURAL_TOL = 0.001  # 约 100 米（经纬度）


def _dp(pts, tol):
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = (dx * dx + dy * dy) ** 0.5
    best, idx = -1.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / L if L else ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
        if d > best:
            best, idx = d, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return _dp(pts[: idx + 1], tol)[:-1] + _dp(pts[idx:], tol)


def simplify_ring(ring, tol):
    if len(ring) < 8:
        return ring
    out = _dp(ring[:-1], tol) + [ring[-1]]
    return out if len(out) >= 4 else ring


def is_metro(geom):
    rings = [geom["coordinates"][0]] if geom["type"] == "Polygon" else [p[0] for p in geom["coordinates"]]
    xs = [c[0] for r in rings for c in r]; ys = [c[1] for r in rings for c in r]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    return METRO[0] <= cx <= METRO[1] and METRO[2] <= cy <= METRO[3]


def shrink(geom):
    if is_metro(geom):
        return geom
    if geom["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": [simplify_ring(r, RURAL_TOL) for r in geom["coordinates"]]}
    return {"type": "MultiPolygon", "coordinates": [[simplify_ring(r, RURAL_TOL) for r in p] for p in geom["coordinates"]]}


def school_no(entity_code):
    return (int(entity_code) // 100) % 10000


def load_zones(files, label):
    feats = []
    for fn in files:
        p = RAW / "zones" / fn
        if not p.exists():
            continue
        for f in json.load(open(p))["features"]:
            if not f.get("geometry"):
                continue
            pr = f["properties"]
            feats.append({
                "type": "Feature",
                "properties": {
                    "no": school_no(pr["ENTITY_CODE"]),
                    "name": pr["School_Name"],
                    "campus": pr.get("Campus_Name") or "",
                    "yl": str(pr.get("Year_Level") or ""),
                    "kind": label,
                },
                "geometry": shrink({"type": f["geometry"]["type"], "coordinates": rnd(f["geometry"]["coordinates"])}),
            })
    return {"type": "FeatureCollection", "features": feats}


ABBR = {"SEC": "SECONDARY", "COLL": "COLLEGE", "SCHL": "SCHOOL", "GS": "GRAMMAR SCHOOL",
        "INTERNATL": "INTERNATIONAL", "COMM": "COMMUNITY", "ST": "SAINT", "MT": "MOUNT",
        "PS": "PRIMARY SCHOOL", "SC": "SECONDARY COLLEGE", "GRAM": "GRAMMAR",
        "CATH": "CATHOLIC", "REG": "REGIONAL", "COMMTY": "COMMUNITY", "CHRISTN": "CHRISTIAN",
        "ACAD": "ACADEMY", "AC": "ANGLICAN COLLEGE"}


def norm(s):
    s = str(s).upper().replace("’", "").replace("�", "").replace("'", "")
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    words = [ABBR.get(w, w) for w in s.split() if w not in ("THE", "CAMPUS")]
    return "".join(words)


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main():
    prim = load_zones(["Primary_Integrated_2027.json"], "primary")
    sec = load_zones(["Secondary_Integrated_Year7_2027.json", "Standalone_singlesex_2027.json",
                      "Standalone_juniorsec_2027.json"], "secondary")
    json.dump(prim, open(OUT / "zones_primary.json", "w"), separators=(",", ":"), ensure_ascii=False)
    json.dump(sec, open(OUT / "zones_secondary.json", "w"), separators=(",", ":"), ensure_ascii=False)

    loc = pd.read_csv(RAW / "school_locations.csv", encoding="latin-1")
    loc = loc[loc.School_Status.astype(str).str.upper().eq("O")]

    vce = pd.read_excel(RAW / "vce_2025.xlsx", header=11)
    med_col = next(c for c in vce.columns if "Median VCE study score" in str(c))
    p40_col = next(c for c in vce.columns if "40 and over" in str(c))
    n_col = next(c for c in vce.columns if str(c).startswith("Number of students enrolled in at least one VCE"))
    comp_col = next(c for c in vce.columns if "satisfactory VCE completions" in str(c))
    vce = vce[vce["School"].notna()]

    loc = loc.reset_index(drop=True)
    loc["_n"] = loc.School_Name.map(norm)
    loc["_t"] = loc.Address_Town.map(norm)
    by_name = {}
    for i, n in enumerate(loc["_n"]):
        by_name.setdefault(n, []).append(i)
    all_names = list(by_name)

    # VCE row -> location row index
    best = {}  # loc idx -> (same_town, record)
    for _, r in vce.iterrows():
        med = num(r[med_col])
        if med is None:
            continue
        cohort = num(r[n_col]) or 0
        rec = {"med": med, "p40": num(r[p40_col]),
               "rankable": str(r.get("Small School")) != "*" and cohort >= 20
               and num(r[comp_col]) is not None}
        n, t = norm(r["School"]), norm(r["Locality"])
        cands = by_name.get(n)
        if not cands:
            close = difflib.get_close_matches(n, all_names, n=3, cutoff=0.88)
            cands = [i for c in close for i in by_name[c]]
        if not cands:
            continue
        same = [i for i in cands if loc.at[i, "_t"] == t]
        if same:
            idx, st = same[0], True
        elif len(set(loc.at[i, "_n"] for i in cands)) == 1:
            idx, st = cands[0], False
        else:
            continue
        prev = best.get(idx)
        if prev is None or (st and not prev[0]) or (st == prev[0] and cohort > prev[2]):
            best[idx] = (st, rec, cohort)

    rankable = sorted([b[1] for b in best.values() if b[1]["rankable"]],
                      key=lambda v: (-v["med"], -(v["p40"] or 0)))
    for i, v in enumerate(rankable):
        v["rank"] = i + 1
    total_ranked = len(rankable)

    schools, matched = [], 0
    for i, r in loc.iterrows():
        v = best.get(i, (None, None))[1]
        if v:
            matched += 1
        s = {
            "no": int(r.School_No), "name": str(r.School_Name).replace("\ufffd", "'"),
            "sector": r.Education_Sector, "type": r.School_Type,
            "addr": f"{r.Address_Line_1}, {str(r.Address_Town).title()} {r.Address_Postcode}",
            "phone": "" if pd.isna(r.Full_Phone_No) else str(r.Full_Phone_No),
            "lat": round(float(r.Y), 5), "lng": round(float(r.X), 5),
        }
        if v:
            s.update({"vce_med": v["med"], "vce_p40": v["p40"]})
            if "rank" in v:
                s["vce_rank"] = v["rank"]
        schools.append(s)
    json.dump(schools, open(OUT / "schools.json", "w"), separators=(",", ":"), ensure_ascii=False)
    meta = {"zones_year": 2027, "vce_year": 2025, "vce_ranked_total": total_ranked,
            "built": datetime.date.today().isoformat(), "schools": len(schools), "vce_matched": matched}
    json.dump(meta, open(OUT / "meta.json", "w"), ensure_ascii=False)
    print(meta, "primary zones", len(prim["features"]), "secondary zones", len(sec["features"]))


if __name__ == "__main__":
    main()
