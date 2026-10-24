# 絵地図（docs/art/）を、町の境界から外へ行くほど透明にする（四角い絵の端を目立たなくする）
# usage: python3 fade_art.py <入力フォルダ> <出力フォルダ> <smooth|dots> [消えきるまでの幅 m 既定120]
#   smooth: 外へ行くほど少しずつ薄くなる / dots: 外へ行くほどドットがまばらに消える
# 入力フォルダの tiles.json（四角の位置）と docs/data/mapdata.json（町の境界）を使う
# 必要: pip install pillow numpy scipy
import json, sys, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt

src, dst, mode = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
FADE_M = float(sys.argv[4]) if len(sys.argv) > 4 else 120
root = Path(__file__).resolve().parent.parent
D = json.loads((root / 'docs/data/mapdata.json').read_text())
towns = [t for t in D['towns'] if t['name'] != '西大泉町']   # 地図と同じ5町（common.js と合わせる）
tiles = json.loads((src / 'tiles.json').read_text())['tiles']
dst.mkdir(parents=True, exist_ok=True)
LEVELS = 16   # 透明さの段階。12色 × 16段 = 192色に収めて、色の少ない小さな PNG のままにする


def save_small(a, path):
    """12色 × 透明さ16段のパレット PNG で保存する（RGBA で保存すると2〜3倍重くなる）"""
    rgb = a[..., :3].reshape(-1, 3)
    cols, idx = np.unique(rgb, axis=0, return_inverse=True)
    lev = np.round(a[..., 3].reshape(-1) / 255 * (LEVELS - 1)).astype(np.int64)
    p = Image.frombytes('P', (a.shape[1], a.shape[0]), (idx.reshape(-1) * LEVELS + lev).astype(np.uint8).tobytes())
    p.putpalette([int(v) for c in cols for _ in range(LEVELS) for v in c])
    p.info['transparency'] = bytes(round(i / (LEVELS - 1) * 255) for _ in cols for i in range(LEVELS))
    p.save(path, optimize=True, transparency=p.info['transparency'])

for t in tiles:
    im = Image.open(src / t['url']).convert('RGBA')
    w, h = im.size
    (l, top), _, (r, bottom), _ = t['corners']
    # 町の内側 = 1 の絵を、ドット1つ = 1画素で作る
    inside = Image.new('L', (w, h), 0)
    dr = ImageDraw.Draw(inside)
    for town in towns:
        dr.polygon([((lng - l) / (r - l) * w, (top - lat) / (top - bottom) * h) for lat, lng in town['rings'][0]], fill=255)
    m_per_px = (r - l) * 111320 * math.cos(math.radians((top + bottom) / 2)) / w
    dist = distance_transform_edt(np.array(inside) == 0) * m_per_px   # 町の外の、境界からの距離（m）
    k = np.clip(1 - dist / FADE_M, 0, 1)
    k = k * k * (3 - 2 * k)                                           # はじめはゆっくり、外でしっかり消える
    a = np.array(im)
    if mode == 'smooth':
        a[..., 3] = (a[..., 3] * k).astype(np.uint8)
    else:
        # 場所で決まる乱数なので、作り直しても同じ所が消える。隣の絵とも続く（経緯度から作る）
        ys, xs = np.mgrid[0:h, 0:w]
        gx = np.round(l / (r - l) * w).astype(np.int64) + xs
        gy = np.round(-top / (top - bottom) * h).astype(np.int64) + ys
        n = ((gx * 73856093) ^ (gy * 19349663)).astype(np.uint64)
        n = (((n ^ (n >> np.uint64(13))) * np.uint64(1274126177)) >> np.uint64(16)) & np.uint64(0xFFFF)
        a[..., 3] = np.where(n / 0xFFFF < k, a[..., 3], 0)
    save_small(a, dst / t['url'])
(dst / 'tiles.json').write_text((src / 'tiles.json').read_text())
print(dst, len(tiles), 'tiles')
