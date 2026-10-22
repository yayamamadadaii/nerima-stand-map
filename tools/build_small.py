# 細い道（私道・路地・歩道など）のデータを作る。地図を拡大したときだけ読み込む
# usage: python3 build_small.py <osm_small.json> <out.json>
import json, math, sys
src, out_path = sys.argv[1:3]
Q = 1e5
def simplify(pts, tol=0.000008):
    if len(pts) < 3: return pts
    def d(p, a, b):
        x, y = b[0] - a[0], b[1] - a[1]
        if x == 0 and y == 0: return math.hypot(p[0] - a[0], p[1] - a[1])
        t = max(0, min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / (x * x + y * y)))
        return math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * y)
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    st = [(0, len(pts) - 1)]
    while st:
        i, j = st.pop(); m, mi = 0, -1
        for k in range(i + 1, j):
            v = d(pts[k], pts[i], pts[j])
            if v > m: m, mi = v, k
        if m > tol: keep[mi] = True; st += [(i, mi), (mi, j)]
    return [p for p, k in zip(pts, keep) if k]
out = {'lane': [], 'path': []}
for e in json.load(open(src, encoding='utf-8'))['elements']:
    t = e.get('tags', {}); g = e.get('geometry')
    if not g: continue
    h = t.get('highway')
    if h == 'service' and t.get('service') in ('parking_aisle', 'drive-through'): continue
    if h == 'footway' and t.get('footway') in ('sidewalk', 'crossing'): continue
    pts = simplify([[round(p['lat'] * Q) / Q, round(p['lon'] * Q) / Q] for p in g])
    out['lane' if h in ('service', 'track') else 'path'].append(pts)
s = json.dumps(out, separators=(',', ':'))
open(out_path, 'w').write(s)
print(len(s), {k: len(v) for k, v in out.items()})
