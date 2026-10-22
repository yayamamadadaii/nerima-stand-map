import json, sys, math
feat = json.load(open('ab/feat.json'))
bnd = json.load(open('ab/bndg.json'))
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
S = [r for r in json.load(open('stands.json')) if '大泉' in r['address']]
out['stands'] = [{'no': r['no'], 'name': r['name'], 'address': r['address'], 'lat': r['lat'], 'lng': r['lng'],
                  'items': r['items'], 'unmanned': r['unmanned'], 'note': r['note'] + ('（位置は丁目単位のおおよそ）' if r['no']==66 else '')} for r in S]
s = json.dumps(out, ensure_ascii=False, separators=(',',':'))
open('mapdata.json','w',encoding='utf-8').write(s)
print(len(s), {k: len(v) for k, v in out.items()}, [ (t['name'], len(t['rings'])) for t in towns], stations)
