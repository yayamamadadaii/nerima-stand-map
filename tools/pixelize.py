# AI で描いた絵を、粗いドット＋決めた色数に加工する（地図に重ねる絵を前もって作る。動かしてもチカチカしない）
# usage: python3 pixelize.py <in.png> <out.png> <ドットの大きさ(px)> [元の幅の基準 既定1536]
# 出力はドット1つ＝1画素の小さな PNG。地図では raster-resampling: nearest で拡大して表示する（とても軽い）
# 必要: pip install pillow
import sys
from PIL import Image
src, out, block = sys.argv[1], sys.argv[2], int(sys.argv[3])
W = int(sys.argv[4]) if len(sys.argv) > 4 else 1536
# ファミコン風の12色（道・ふち・草・木・水・屋根・壁など、絵地図に要る色だけ）
PAL = ['FBF0C8', '4A2E18', '5DAA3A', '2E7A2A', '9CD25A', '2E7AE6', 'D8402E', '3A62C8', 'F0902A', 'A8A8A8', 'F4F4F0', 'D8B878']
pal_img = Image.new('P', (1, 1))
flat = [int(c[i:i + 2], 16) for c in PAL for i in (0, 2, 4)]
pal_img.putpalette(flat + flat[:3] * (256 - len(PAL)))
im = Image.open(src).convert('RGB')
H = round(im.height * W / im.width)
small = im.resize((W // block, H // block), Image.BOX)            # ドット1つ分の平均の色にする
q = small.quantize(palette=pal_img, dither=Image.Dither.NONE)       # 12色のどれかに置き換える
q.save(out, optimize=True)
print(out, q.size)
