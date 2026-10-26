# 収穫体験ができる農園（data/harvest-2026.tsv）を、地図データ（docs/data/mapdata.json）の販売所に足す
# - 今の地図にある所: その販売所に harvest（体験の一覧）を付ける
# - 新しい所: 国土地理院の住所検索で位置を出し、販売はしていない所（sale: false）として足す。番号は 1001 から
# 何度実行しても同じ結果になる（前に足した分は消してから足し直す）
# usage: python3 tools/build_harvest.py
import json, time, urllib.parse, urllib.request
from pathlib import Path
root = Path(__file__).resolve().parent.parent
mp = root / 'docs/data/mapdata.json'
D = json.loads(mp.read_text(encoding='utf-8'))
SEASON = {'ブルーベリー': '6月下旬〜9月', 'ミカン': '冬（日にちは農園に確認）', 'カキ': '10月中旬〜11月ごろ', '野菜': '日程は「とれたてねりま」で案内'}
stands = [s for s in D['stands'] if s['no'] < 1001]
for s in stands:
    s.pop('harvest', None); s['sale'] = True
by_no = {s['no']: s for s in stands}
new_no = 1001
for line in open(root / 'data/harvest-2026.tsv', encoding='utf-8'):
    if line.startswith('#') or not line.strip(): continue
    no, name, addr, what = line.rstrip('\n').split('\t')
    exp = []
    for w in what.split(';'):
        title = w.rstrip('*')
        exp.append({'what': title, 'reserve': w.endswith('*'), 'season': next(v for k, v in SEASON.items() if k in title)})
    if no:
        by_no[int(no)]['harvest'] = exp
        continue
    q = '東京都練馬区' + addr
    hit = json.load(urllib.request.urlopen('https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + urllib.parse.quote(q)))[0]
    lng, lat = hit['geometry']['coordinates']
    print(name, addr, '→', hit['properties']['title'], lat, lng)
    stands.append({'no': new_no, 'name': name, 'address': '練馬区' + addr, 'lat': lat, 'lng': lng, 'items': [], 'unmanned': False,
                   'note': '', 'sale': False, 'harvest': exp})
    new_no += 1
    time.sleep(0.3)
D['stands'] = stands
mp.write_text(json.dumps(D, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(len(stands), 'stands,', sum(1 for s in stands if s.get('harvest')), 'with harvest,', sum(1 for s in stands if not s['sale']), 'harvest only')
