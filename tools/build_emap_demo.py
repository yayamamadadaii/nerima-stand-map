# 絵地図の見本（docs/emap/）用のデータを作る。見本が終わったら消す
# usage: python3 build_emap_demo.py <osm_buildings_center.json> <docs_dir>
import json, sys, collections, random
bld_path, docs = sys.argv[1:3]
S, W, N, E = 35.7480, 139.5805, 35.7615, 139.5930
inb = lambda p: S - 0.001 <= p[0] <= N + 0.001 and W - 0.001 <= p[1] <= E + 0.001
M = json.load(open(docs + '/data/mapdata.json', encoding='utf-8'))
L = json.load(open(docs + '/data/layers.json', encoding='utf-8'))
Sm = json.load(open(docs + '/data/small.json', encoding='utf-8'))
clip = lambda lst: [g for g in lst if any(inb(p) for p in g)]
out = {k: clip(M[k]) for k in ['farm', 'park', 'water', 'river', 'minor', 'mid', 'major', 'motorway', 'rail']}
out['lane'] = clip(Sm['lane']); out['path'] = clip(Sm['path'])
# 家の絵: 55m 四方に建物が3軒以上あれば、そのまん中に1軒だけ置く（町に家が並ぶ雰囲気を、まばらな絵で出す）
random.seed(5)
cells = collections.defaultdict(list)
CLAT, CLNG = 55 / 111000, 55 / 90000
for e in json.load(open(bld_path))['elements']:
    c = e.get('center'); t = e.get('tags', {}).get('building', 'yes')
    if not c or t in ('public', 'school', 'civic', 'hospital', 'temple', 'shrine', 'church', 'kindergarten', 'train_station'): continue
    cells[(int(c['lat'] / CLAT), int(c['lon'] / CLNG))].append((c['lat'], c['lon'], t in ('apartments', 'dormitory')))
houses = []
for bs in cells.values():
    if len(bs) < 3: continue
    la = sum(b[0] for b in bs) / len(bs); ln = sum(b[1] for b in bs) / len(bs)
    apt = sum(b[2] for b in bs) >= len(bs) / 3
    houses.append([round(la, 5), round(ln, 5), 'apt' if apt else 'house' + str(random.randint(0, 2))])
out['houses'] = houses
out['pois'] = [p for p in L['pois'] if inb(p)]
out['stands'] = [s for s in M['stands'] if inb((s['lat'], s['lng']))]
out['stations'] = [s for s in M['stations'] if inb(s['p'])]
out['bbox'] = [S, W, N, E]
s = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open(docs + '/emap/data.json', 'w', encoding='utf-8').write(s)
print(len(s), {k: len(v) for k, v in out.items() if isinstance(v, list)})
