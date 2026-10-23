# AI で描いた絵を、粗いドット＋決めた色数に加工する（地図に重ねる絵を前もって作る。動かしてもチカチカしない）
# usage: python3 pixelize.py <in.png> <out.png> <ドットの大きさ(px)> [元の幅の基準 既定1536] [--green 空き地を緑にする最小のドット数 既定120]
# 出力はドット1つ＝1画素の小さな PNG。地図では raster-resampling: nearest で拡大して表示する（とても軽い）
# 必要: pip install pillow
import sys
from PIL import Image
src, out, block = sys.argv[1], sys.argv[2], int(sys.argv[3])
rest = sys.argv[4:]
if '--green' in rest: i = rest.index('--green'); rest = rest[:i] + rest[i + 2:]
args = rest
W = int(args[0]) if args else 1536
GREEN_MIN = int(sys.argv[sys.argv.index('--green') + 1]) if '--green' in sys.argv else 120
# ファミコン風の12色（道・ふち・草・木・水・屋根・壁など、絵地図に要る色だけ）
PAL = ['FBF0C8', '4A2E18', '5DAA3A', '2E7A2A', '9CD25A', '2E7AE6', 'D8402E', '3A62C8', 'F0902A', 'A8A8A8', 'F4F4F0', 'D8B878']
pal_img = Image.new('P', (1, 1))
flat = [int(c[i:i + 2], 16) for c in PAL for i in (0, 2, 4)]
pal_img.putpalette(flat + flat[:3] * (256 - len(PAL)))
im = Image.open(src).convert('RGB')
H = round(im.height * W / im.width)
small = im.resize((W // block, H // block), Image.BOX)            # ドット1つ分の平均の色にする
q = small.quantize(palette=pal_img, dither=Image.Dither.NONE)       # 12色のどれかに置き換える
# 広い砂色（空き地・校庭・駐車場など）は緑にする（だいき指示 2026-10-23）。小さな砂色（道のはしなど）はそのまま
SAND, GRASS, TREE = PAL.index('D8B878'), PAL.index('9CD25A'), PAL.index('5DAA3A')
px = q.load(); w, h = q.size; seen = bytearray(w * h)
for y0 in range(h):
    for x0 in range(w):
        if seen[y0 * w + x0] or px[x0, y0] != SAND: continue
        stack, comp = [(x0, y0)], []
        seen[y0 * w + x0] = 1
        while stack:
            x, y = stack.pop(); comp.append((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny] == SAND:
                    seen[ny * w + nx] = 1; stack.append((nx, ny))
        if len(comp) >= GREEN_MIN:
            for x, y in comp: px[x, y] = TREE if (x * 7 + y * 13) % 29 == 0 else GRASS   # ところどころ濃い緑で草むらに
q.save(out, optimize=True)
print(out, q.size)
