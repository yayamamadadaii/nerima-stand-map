// 地図の情報レイヤー（目印・道路名・丁目と番地）。表示・非表示を切り替えられる。
// 文字が重ならないよう、優先度の高いものから置き、重なるものは出さない。
// 地図ライブラリには依らない。view = { zoom(), inView(lat, lng), project(lat, lng) → {x, y}, addLabel(el, lat, lng) → { remove() }, onMoveEnd(fn) }
window.MapLayers = (() => {
  const KEY = 'layers';
  const GROUPS = [
    { id: 'poi', label: '目印', sub: '学校・お店・銀行・郵便局・公園など' },
    { id: 'road', label: '道路名・交差点名', sub: '大泉街道・富士街道、信号の名前など' },
    { id: 'addr', label: '丁目・番地', sub: '番地は大きく拡大したときだけ' }
  ];
  // 目印の種類: [表示し始めるズーム, 優先度（小さいほど先に置く）]。種類は文字の色で見分ける（k-種類 のクラス）
  const KINDS = {
    school: [15.75, 5], kinder: [17, 8], post: [16, 6], police: [16, 6], fire: [16, 6], public: [16, 6],
    shrine: [16.5, 7], super: [16, 6], conv: [16.5, 7], park: [16.75, 8],
    drug: [16.5, 7], variety: [16.5, 7], bank: [16.5, 7], fuel: [16.5, 7], food: [17, 8]
  };
  const ICONS = {
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'
  };
  const svg = (name, cls) => `<svg class="icon ${cls || ''}" viewBox="0 0 24 24">${ICONS[name]}</svg>`;

  async function attach(view, opts) {
    let on = { poi: true, road: true, addr: true };
    try { on = { ...on, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) {}

    // ボタンとパネル
    const btn = document.getElementById('layerBtn');
    const panel = document.getElementById('layerPanel');
    btn.innerHTML = svg('layers');
    function renderPanel() {
      panel.replaceChildren(...GROUPS.map(g => {
        const row = document.createElement('label');
        row.className = 'toggle';
        row.innerHTML = `<span><span class="toggle-title"></span><span class="toggle-sub"></span></span><input type="checkbox" role="switch">`;
        row.querySelector('.toggle-title').textContent = g.label;
        row.querySelector('.toggle-sub').textContent = g.sub;
        const input = row.querySelector('input');
        input.checked = on[g.id];
        input.onchange = () => {
          on[g.id] = input.checked;
          try { localStorage.setItem(KEY, JSON.stringify(on)); } catch (e) {}
          draw();
        };
        return row;
      }), Object.assign(document.createElement('div'), { className: 'toggle-credit', textContent: '番地: 位置参照情報（国土交通省）を加工' }));
    }
    renderPanel();
    btn.onclick = (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', !panel.hidden); };
    document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });

    // データ
    const L0 = await (await fetch(`${window.APP_BASE || ''}data/layers.json?v=${window.APP_V || ''}`)).json();
    const items = [];
    L0.chome.forEach(([lat, lng, t], i) => items.push({ id: 'c' + i, g: 'addr', lat, lng, text: t, cls: 'lbl-chome', z: 15, prio: 3 }));
    L0.roads.forEach(([lat, lng, t], i) => items.push({ id: 'r' + i, g: 'road', lat, lng, text: t, cls: 'lbl-road', z: 15.5, prio: 4 }));
    (L0.cross || []).forEach(([lat, lng, t], i) => items.push({ id: 'x' + i, g: 'road', lat, lng, text: t, cls: 'lbl-cross', z: 16, prio: 4.5 }));
    L0.pois.forEach(([lat, lng, k, t], i) => {
      const [z, prio] = KINDS[k];
      items.push({ id: 'p' + i, g: 'poi', lat, lng, text: t, cls: 'lbl-poi k-' + k, z, prio });
    });
    L0.blocks.forEach(([lat, lng, t], i) => items.push({ id: 'b' + i, g: 'addr', lat, lng, text: t, cls: 'lbl-blk', z: 17.5, prio: 9 }));

    const live = new Map();   // id -> 置いた文字
    function makeLabel(it) {
      const div = document.createElement('div');
      div.className = 'lbl2 ' + it.cls;
      div.textContent = it.text;
      return view.addLabel(div, it.lat, it.lng);
    }
    // 文字の大きさの見積もり（12px の日本語 ≒ 1文字12px）
    function box(it, pt) {
      const w = it.text.length * (it.cls === 'lbl-blk' ? 7.5 : 12) + 12;
      const h = 20;
      return [pt.x - w / 2, pt.y - h / 2, pt.x + w / 2, pt.y + h / 2];
    }
    const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

    function draw() {
      const z = view.zoom();
      const placed = opts.occupied().map(p => { const c = view.project(p.lat, p.lng); return [c.x - 18, c.y - 18, c.x + 18, c.y + 18]; });
      const want = new Set();
      const cands = items.filter(it => on[it.g] && z >= it.z && view.inView(it.lat, it.lng)).sort((a, b) => a.prio - b.prio);
      for (const it of cands) {
        const b = box(it, view.project(it.lat, it.lng));
        if (placed.some(p => hit(p, b))) continue;
        placed.push(b); want.add(it.id);
      }
      for (const [id, m] of live) if (!want.has(id)) { m.remove(); live.delete(id); }
      for (const it of cands) if (want.has(it.id) && !live.has(it.id)) live.set(it.id, makeLabel(it));
    }
    view.onMoveEnd(draw);
    draw();
    return { redraw: draw };
  }
  return { attach };
})();
