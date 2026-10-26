# 絵地図の元の画像（tools/render_base.html）に描く建物の形を、OSM から取ってくる
# usage: python3 fetch_buildings.py <出力 render_bld.json> [S W N E]（既定は大泉5町のまわり）
# Overpass が混んでいるとき（502 など）は30秒おいて5回まで取り直す
import json, sys, time, urllib.parse, urllib.request
out = sys.argv[1]
S, W, N, E = map(float, sys.argv[2:6]) if len(sys.argv) > 5 else (35.7320, 139.5550, 35.7840, 139.6150)
q = f'[out:json][timeout:250][bbox:{S},{W},{N},{E}];(way["building"];);out geom;'
req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=urllib.parse.urlencode({'data': q}).encode(),
                             headers={'User-Agent': 'nerima-stand-map/0.1 (personal project)'})
for t in range(5):
    try:
        d = json.load(urllib.request.urlopen(req, timeout=280))['elements']
        break
    except Exception as e:
        print('retry', e); time.sleep(30)
else:
    sys.exit('Overpass から取れなかった')
Q = 1e5
bld = [[[round(p['lat'] * Q) / Q, round(p['lon'] * Q) / Q] for p in e['geometry']] for e in d if e.get('geometry') and len(e['geometry']) > 3]
json.dump(bld, open(out, 'w'), separators=(',', ':'))
print(out, len(bld), 'buildings')
