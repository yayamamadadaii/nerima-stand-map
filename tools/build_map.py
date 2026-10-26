# 地図データ（道路・線路・川・公園・畑・大泉5町の境界・駅）と販売所を docs/data/mapdata.json にまとめる
# usage: python3 build_map.py <osm_features.json> <osm_town_boundaries.json> <stands.json（geo.py の出力）> <out.json>
#   osm_features: Overpass で bbox 35.730,139.558,35.782,139.616 の道路・線路・水・公園・畑・駅を out geom で取ったもの
#   osm_town_boundaries: 大泉学園町・東大泉・西大泉・南大泉・大泉町（と西大泉町）の境界リレーションを out geom で取ったもの
import json, sys, math
feat_path, bnd_path, stands_path, out_path = sys.argv[1:5]
feat = json.load(open(feat_path))
bnd = json.load(open(bnd_path))
Q = 1e5
def q(p): return [round(p['lat']*Q)/Q, round(p['lon']*Q)/Q]

def simplify(pts, tol=0.000008):
    # Douglas-Peucker in degrees (~0.8m)
    if len(pts) < 3: return pts
    def d(p, a, b):
        if a == b: return math.hypot(p[0]-a[0], p[1]-a[1])
        x, y = b[0]-a[0], b[1]-a[1]
        t = max(0, min(1, ((p[0]-a[0])*x + (p[1]-a[1])*y) / (x*x+y*y)))
        return math.hypot(p[0]-a[0]-t*x, p[1]-a[1]-t*y)
    keep = [False]*len(pts); keep[0] = keep[-1] = True
    st = [(0, len(pts)-1)]
    while st:
        i, j = st.pop(); m, mi = 0, -1
        for k in range(i+1, j):
            v = d(pts[k], pts[i], pts[j])
            if v > m: m, mi = v, k
        if m > tol: keep[mi] = True; st += [(i, mi), (mi, j)]
    return [p for p, k in zip(pts, keep) if k]

out = {k: [] for k in ['major','mid','minor','motorway','rail','river','water','park','farm']}
stations = []
for e in feat['elements']:
    t = e.get('tags', {})
    if e['type'] == 'node':
        if t.get('name'): stations.append({'name': t['name'], 'p': [e['lat'], e['lon']]})
        continue
    g = e.get('geometry')
    if not g: continue
    pts = simplify([q(p) for p in g])
    h = t.get('highway')
    if h:
        if h.startswith('motorway') or h.startswith('trunk'): out['motorway'].append(pts)
        elif h.split('_')[0] in ('primary','secondary'): out['major'].append(pts)
        elif h.split('_')[0] in ('tertiary',): out['mid'].append(pts)
        else: out['minor'].append(pts)
    elif t.get('railway') == 'rail': out['rail'].append(pts)
    elif t.get('waterway'): out['river'].append(pts)
    elif t.get('natural') == 'water': out['water'].append(pts)
    elif t.get('leisure') == 'park': out['park'].append(pts)
    elif t.get('landuse') in ('farmland','orchard'): out['farm'].append(pts)

def rings(rel):
    segs = [[q(p) for p in m['geometry']] for m in rel['members'] if m['type']=='way' and m.get('role') in ('outer','') and m.get('geometry')]
    res = []
    while segs:
        r = segs.pop(0)
        changed = True
        while changed and r[0] != r[-1]:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == r[-1]: r += s[1:]
                elif s[-1] == r[-1]: r += s[::-1][1:]
                elif s[-1] == r[0]: r = s + r[1:]
                elif s[0] == r[0]: r = s[::-1] + r[1:]
                else: continue
                segs.pop(i); changed = True; break
        res.append(simplify(r, 0.000005))
    return res
towns = []
for e in bnd['elements']:
    rs = rings(e)
    big = max(rs, key=len)
    lat = sum(p[0] for p in big)/len(big); lng = sum(p[1] for p in big)/len(big)
    towns.append({'name': e['tags']['name'], 'rings': rs, 'c': [round(lat,5), round(lng,5)]})
out['towns'] = towns
out['stations'] = stations
S = [r for r in json.load(open(stands_path)) if '大泉' in r['address']]
out['stands'] = [{'no': r['no'], 'name': r['name'], 'address': r['address'], 'lat': r['lat'], 'lng': r['lng'],
                  'items': r['items'], 'unmanned': r['unmanned'], 'note': r['note'] + ('（位置は丁目単位のおおよそ）' if r['no']==66 else '')} for r in S]
# 同じ名前の販売所（「加藤さんの直売所」など）は、一覧で見分けられるように場所を付ける（2026-10-26 だいき了承）
# 町名と丁目で分かれればそこまで、同じ丁目にもあれば番まで・号まで足す
def with_area(stands):
    import collections, re
    def label(s, lv):
        a = re.sub(r'^練馬区', '', s['address']); m = re.match(r'(\D+)([\d-]+)', a)
        if not m: return a
        parts = m[2].split('-')
        return m[1] + parts[0] + '丁目' if lv == 0 else m[1] + '-'.join(parts[:lv + 1])
    n = collections.Counter(s['name'] for s in stands)
    groups = collections.defaultdict(list)
    for s in stands:
        if n[s['name']] > 1: groups[s['name']].append(s)
    for g in groups.values():
        lv = next((lv for lv in range(3) if len({label(s, lv) for s in g}) == len(g)), 2)
        for s in g: s['name'] += f'（{label(s, lv)}）'
    return stands
out['stands'] = with_area(out['stands'])
s = json.dumps(out, ensure_ascii=False, separators=(',',':'))
open(out_path,'w',encoding='utf-8').write(s)
print(len(s), {k: len(v) for k, v in out.items()}, [ (t['name'], len(t['rings'])) for t in towns], stations)
