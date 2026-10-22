// 地図をにぎやかにする部品。
// - 細い道（私道・路地・歩道）: 拡大したときだけ、あとから読み込んで描く（どの見た目でも）
// - ドット絵の飾り: 畑・公園・水の模様、公園の木、住宅地の家（ファミコン本体風のときだけ）
window.Decor = (() => {
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const retro = () => !!window.Theme;
  const SMALL_Z = 15.5, TREE_Z = 15.5, HOUSE_Z = 16.25;

  // ---------- 模様（8×8 のドットを敷き詰める） ----------
  const PATTERN = {
    // 畑: 作物の列
    farm: ['........', '.##..##.', '........', '........', '........', '##..##..', '........', '........'],
    // 公園: 小さな草むら
    park: ['........', '..#.....', '.###....', '........', '........', '.....#..', '....###.', '........'],
    // 水: さざ波
    water: ['........', '.##.....', '#..#....', '........', '........', '.....##.', '....#..#', '........']
  };
  const DARKER = { farm: '#B9C47E', park: '#A8C47E', water: '#C4DDF2' };
  const scratch = document.createElement('canvas').getContext('2d');
  const cache = {};
  function pattern(kind) {
    if (!retro() || !PATTERN[kind]) return null;
    const base = css('--map-' + kind), key = kind + base;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 8, 8);
    g.fillStyle = DARKER[kind];
    PATTERN[kind].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') g.fillRect(x, y, 1, 1); }));
    return (cache[key] = scratch.createPattern(c, 'repeat'));
  }

  // ---------- ドット絵（木と家） ----------
  const PAL = { K: '#3A2A1A', G: '#4F9A3A', L: '#7CC05A', B: '#7C4A1E', R: '#C8382E', W: '#FFFDF5', U: '#4A6FA8', Y: '#E8B84A' };
  const SPR = {
    tree: ['..KKKK..', '.KLLGGK.', 'KLLGGGGK', 'KLGGGGGK', 'KGGGGGGK', '.KGGGGK.', '..KBBK..', '...BB...'],
    house: ['....KK....', '...KRRK...', '..KRRRRK..', '.KRRRRRRK.', 'KKKKKKKKKK', '.KWWKWWWK.', '.KWWKWYWK.', '.KWWKWWWK.', '.KKKKKKKK.'],
    house2: ['....KK....', '...KUUK...', '..KUUUUK..', '.KUUUUUUK.', 'KKKKKKKKKK', '.KWWWKWWK.', '.KWYWKWWK.', '.KWWWKWWK.', '.KKKKKKKK.']
  };
  const img = {};
  for (const [k, rows] of Object.entries(SPR)) {
    const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } }));
    img[k] = c;
  }

  // 公園の中に木を置く場所を決める（毎回同じ場所になるよう、決まった乱数で）
  function treesIn(rings) {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pts = [];
    for (const r of rings) {
      if (r.length < 4) continue;
      const lats = r.map(p => p[0]), lngs = r.map(p => p[1]);
      const s = Math.min(...lats), n = Math.max(...lats), w = Math.min(...lngs), e = Math.max(...lngs);
      const area = (n - s) * 111000 * (e - w) * 90000;
      const want = Math.min(8, Math.max(area > 250 ? 1 : 0, Math.floor(area / 900)));
      for (let i = 0, tries = 0; i < want && tries < want * 8; tries++) {
        const p = [s + (n - s) * rnd(), w + (e - w) * rnd()];
        if (inside(p, r)) { pts.push(p); i++; }
      }
    }
    return pts;
  }
  function inside(p, ring) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i], [yj, xj] = ring[j];
      if ((yi > p[0]) !== (yj > p[0]) && p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  // 木と家をまとめて1枚のキャンバスに描くレイヤー（DOM を増やさないので軽い）
  const SpriteLayer = L.Layer.extend({
    initialize(items) { this.items = items; },
    onAdd(map) {
      this._map = map;
      this.c = L.DomUtil.create('canvas', 'decor-canvas');
      map.getPane('decor').appendChild(this.c);
      map.on('moveend zoomend resize', this.draw, this);
      map.on('zoomstart', this.hide, this);
      this.draw();
    },
    onRemove(map) { this.c.remove(); map.off('moveend zoomend resize', this.draw, this); map.off('zoomstart', this.hide, this); },
    hide() { this.c.style.visibility = 'hidden'; },
    draw() {
      const map = this._map, size = map.getSize(), z = map.getZoom();
      const c = this.c, g = c.getContext('2d');
      c.width = size.x; c.height = size.y;
      c.style.width = size.x + 'px'; c.style.height = size.y + 'px';
      L.DomUtil.setPosition(c, map.containerPointToLayerPoint([0, 0]));
      c.style.visibility = 'visible';
      g.imageSmoothingEnabled = false;
      const b = map.getBounds().pad(0.05), s = z >= 17 ? 2 : 1.5;
      for (const it of this.items) {
        if (z < it.z || !b.contains(it.p)) continue;
        const pt = map.latLngToContainerPoint(it.p), im = img[it.k];
        const w = im.width * s, h = im.height * s;
        g.drawImage(im, Math.round(pt.x - w / 2), Math.round(pt.y - h + (it.dy || 0)), w, h);
      }
    }
  });

  async function attach(map, D, opts) {
    // 細い道は、地面の模様より上・車道より下に描く
    map.createPane('small').style.zIndex = 245;
    map.createPane('decor').style.zIndex = 255;
    const canvas = L.canvas({ pane: 'small', padding: 0.3 });
    const zw = () => Math.max(0, map.getZoom() - 16);
    const v = window.APP_V || '';
    const S = await (await fetch(`${window.APP_BASE || ''}data/small.json?v=${v}`)).json();
    const lane = L.polyline(S.lane, { renderer: canvas, interactive: false, lineCap: 'round', lineJoin: 'round' });
    const path = L.polyline(S.path, { renderer: canvas, interactive: false, dashArray: '2 3' });
    const restyle = () => {
      lane.setStyle({ color: css('--map-road'), weight: 1.2 + zw() * 1.5 });
      path.setStyle({ color: css('--map-road-casing'), weight: 1 + zw() * 0.5 });
    };
    const sync = () => {
      const show = map.getZoom() >= SMALL_Z;
      for (const l of [lane, path]) show ? (map.hasLayer(l) || l.addTo(map)) : l.remove();
      if (show) restyle();
    };
    map.on('zoomend', sync);
    sync();
    opts.onRestyle?.(restyle);

    if (!retro()) return;
    const items = treesIn(D.park).map(p => ({ k: 'tree', p, z: TREE_Z }));
    try {
      const Lr = await (await fetch(`${window.APP_BASE || ''}data/layers.json?v=${v}`)).json();
      // 番地の点の少し下に家を置く（番地の文字と重ならないように）
      Lr.blocks.forEach(([lat, lng], i) => items.push({ k: i % 3 ? 'house' : 'house2', p: [lat, lng], z: HOUSE_Z, dy: 26 }));
    } catch (e) {}
    new SpriteLayer(items).addTo(map);
  }

  return { pattern, attach };
})();
