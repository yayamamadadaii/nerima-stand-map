# docs/index.html をもとに、版番号を付け直し、シンプルな見た目のページ（simple/）を作る。
# docs/ の中身を変えたら公開前に実行する: python3 tools/build_pages.py
import re, time
from pathlib import Path
docs = Path(__file__).resolve().parent.parent / 'docs'
v = time.strftime('%Y%m%d%H%M')
src = (docs / 'index.html').read_text(encoding='utf-8')
# スマホに古いファイルが残らないよう、自分のファイルの参照に版番号を付ける
src = re.sub(r'(href|src)="((?:style|themes|common|layers)\.(?:css|js))(?:\?v=[^"]*)?"', rf'\1="\2?v={v}"', src)
src = re.sub(r'window\.APP_V = "[^"]*";', f'window.APP_V = "{v}";', src)
(docs / 'index.html').write_text(src, encoding='utf-8')
# 色味の試作ページ（c1/・c2/）。決まったら消す
for theme in ('simple', 'c1', 'c2'):
    s = re.sub(r'(href|src)="((?:style|themes|common|layers)\.(?:css|js)\?v=[^"]*)"', r'\1="../\2"', src)
    extra = f'window.APP_THEME = "{theme}";' if theme == 'simple' else f'window.APP_COLOR = "{theme}";'
    s = s.replace(f'window.APP_V = "{v}";', f'window.APP_V = "{v}"; window.APP_BASE = "../"; {extra}')
    if theme == 'simple': s = s.replace('<meta name="theme-color" content="#A51C1C">', '<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">\n<meta name="theme-color" content="#2C2C2E" media="(prefers-color-scheme: dark)">')
    (docs / theme).mkdir(exist_ok=True)
    (docs / theme / 'index.html').write_text(s, encoding='utf-8')
print('version', v)
