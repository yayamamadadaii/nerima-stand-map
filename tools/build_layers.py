# レイヤー用データ（丁目・番地・道路名・目印）を作る
# usage: python3 build_layers.py <osm_poi.json> <isj.csv(cp932)> <mapdata.json> <out.json>
import csv, json, math, re, sys
poi_path, isj_path, map_path, out_path = sys.argv[1:5]
M = json.load(open(map_path, encoding='utf-8'))
towns = [t for t in M['towns'] if t['name'] != '西大泉町']
TOWN_NAMES = ('大泉学園町', '東大泉', '西大泉', '南大泉', '大泉町')

def inside(lat, lng, ring):
    c = False
    for i in range(len(ring)):
        y1, x1 = ring[i]; y2, x2 = ring[i - 1]
        if (y1 > lat) != (y2 > lat) and lng < (x2 - x1) * (lat - y1) / (y2 - y1) + x1: c = not c
    return c
def in_area(lat, lng, pad=0.0):
    if pad:
        return any(inside(lat + dy, lng + dx, t['rings'][0]) for t in towns for dy in (-pad, 0, pad) for dx in (-pad, 0, pad))
    return any(inside(lat, lng, t['rings'][0]) for t in towns)
def dist(a, b):
    return math.hypot((a[0] - b[0]) * 111000, (a[1] - b[1]) * 90000)
r5 = lambda v: round(v, 5)

KANJI = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}
def chome_no(s):
    m = re.search(r'([一二三四五六七八九十]+)丁目$', s)
    if not m: return None
    k = m.group(1)
    return KANJI[k] if len(k) == 1 else 10 + KANJI.get(k[1], 0)

# 番地（街区）と丁目
blocks, chome = [], {}
with open(isj_path, encoding='cp932') as f:
    for r in csv.DictReader(f):
        if r['市区町村名'] != '練馬区' or r['代表フラグ'] != '1' or r['更新後履歴フラグ'] != '0': continue
        name = r['大字・丁目名']
        town = next((t for t in TOWN_NAMES if name.startswith(t)), None)
        n = chome_no(name)
        if not town or not n: continue
        lat, lng = float(r['緯度']), float(r['経度'])
        blocks.append([r5(lat), r5(lng), f"{n}-{r['街区符号・地番']}"])
        chome.setdefault(f'{town}{n}丁目', []).append((lat, lng))
chome_lbl = [[r5(sum(p[0] for p in v) / len(v)), r5(sum(p[1] for p in v) / len(v)), k] for k, v in chome.items()]

# 道路名と目印（OSM）
P = json.load(open(poi_path, encoding='utf-8'))['elements']
SKIP = re.compile(r'補助第|放射第|区画街路|[0-9０-９]・[0-9０-９]|建設中|IC|JCT|ＩＣ|仮称|敷地|出入り口|アプローチ|^.*線$|^.*線（')
roads = {}
TYPES = [('school', lambda t: t.get('amenity') in ('school', 'university', 'college')),
         ('kinder', lambda t: t.get('amenity') == 'kindergarten'),
         ('station', lambda t: False),
         ('post', lambda t: t.get('amenity') == 'post_office'),
         ('police', lambda t: t.get('amenity') == 'police'),
         ('fire', lambda t: t.get('amenity') == 'fire_station'),
         ('public', lambda t: t.get('amenity') in ('library', 'community_centre', 'townhall', 'hospital') or t.get('tourism') in ('museum', 'attraction')),
         ('shrine', lambda t: t.get('amenity') == 'place_of_worship'),
         ('conv', lambda t: t.get('shop') == 'convenience'),
         ('super', lambda t: t.get('shop') == 'supermarket'),
         ('drug', lambda t: t.get('amenity') == 'pharmacy' or t.get('shop') == 'chemist'),
         ('variety', lambda t: t.get('shop') == 'variety_store'),
         ('food', lambda t: t.get('amenity') in ('fast_food', 'cafe', 'restaurant')),   # restaurant はチェーン（brand あり）だけ取っている
         ('bank', lambda t: t.get('amenity') == 'bank'),
         ('fuel', lambda t: t.get('amenity') == 'fuel'),
         ('park', lambda t: t.get('leisure') == 'park')]
pois, cross = [], []
for e in P:
    t = e.get('tags', {})
    c = e.get('center') or ({'lat': e['lat'], 'lon': e['lon']} if 'lat' in e else None)
    if not c: continue
    lat, lng = c['lat'], c['lon']
    # 交差点名（信号や交差点に付いた名前）
    if e['type'] == 'node' and (t.get('highway') == 'traffic_signals' or 'junction' in t):
        nm = t.get('name', '')
        if nm and in_area(lat, lng, 0.001) and all(dist((lat, lng), (q[0], q[1])) > 80 or q[2] != nm for q in cross):
            cross.append([r5(lat), r5(lng), nm])
        continue
    if 'highway' in t:
        nm = t.get('name', '')
        if nm and not SKIP.search(nm) and in_area(lat, lng, 0.001): roads.setdefault(nm, []).append((lat, lng))
        continue
    if t.get('boundary'): continue
    if not in_area(lat, lng, 0.001): continue
    kind = next((k for k, fn in TYPES if fn(t)), None)
    name = t.get('name') or t.get('brand') or {'conv': 'コンビニ', 'super': 'スーパー'}.get(kind)
    # 同じ店が「薬局」と「ドラッグストア」の2つで登録されていることがあるので、近くの同名は1つに
    if kind and name and all(q[3] != name or dist((lat, lng), (q[0], q[1])) > 40 for q in pois):
        pois.append([r5(lat), r5(lng), kind, name])
# 同じ名前の道路は 600m 以上離して置く
road_lbl = []
for nm, pts in roads.items():
    placed = []
    for p in sorted(pts):
        if all(dist(p, q) > 600 for q in placed): placed.append(p)
    road_lbl += [[r5(p[0]), r5(p[1]), nm] for p in placed]

out = {'chome': chome_lbl, 'blocks': blocks, 'roads': road_lbl, 'cross': cross, 'pois': pois}
s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open(out_path, 'w', encoding='utf-8').write(s)
from collections import Counter
print(len(s), {k: len(v) for k, v in out.items()}, Counter(p[2] for p in pois), sorted(roads)[:40])
