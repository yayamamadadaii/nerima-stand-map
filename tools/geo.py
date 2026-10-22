# 区のガイドから読み取った一覧（data/stands-guide2025.tsv）の住所を、国土地理院の住所検索で緯度経度にする
# usage: python3 geo.py data/stands-guide2025.tsv stands.json
import json, sys, time, urllib.parse, urllib.request
rows = []
for line in open(sys.argv[1], encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) < 6: continue
    no, name, addr, items, u, note = p[:6]
    q = '東京都練馬区' + addr
    url = 'https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + urllib.parse.quote(q)
    res = json.load(urllib.request.urlopen(url))
    hit = res[0] if res else None
    lng, lat = hit['geometry']['coordinates'] if hit else (None, None)
    rows.append(dict(no=int(no), name=name, address='練馬区' + addr, items=items.split(','), unmanned=u == '1', note=note, lat=lat, lng=lng, matched=hit['properties']['title'] if hit else None))
    time.sleep(0.3)
json.dump(rows, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for r in rows: print(r['no'], r['address'], '→', r['matched'], r['lat'], r['lng'])
