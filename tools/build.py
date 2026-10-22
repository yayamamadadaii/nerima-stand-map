# src/app.html に Leaflet の CSS と data/mapdata.json を埋め込み、公開用の dist/nerima-stands.html を作る
from pathlib import Path
root = Path(__file__).resolve().parent.parent
s = (root / 'src/app.html').read_text(encoding='utf-8')
s = s.replace('/*LEAFLET_CSS*/', (root / 'src/leaflet-core.css').read_text(encoding='utf-8'))
s = s.replace('__DATA__', (root / 'data/mapdata.json').read_text(encoding='utf-8'))
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/nerima-stands.html').write_text(s, encoding='utf-8')
print('dist/nerima-stands.html', len(s))
