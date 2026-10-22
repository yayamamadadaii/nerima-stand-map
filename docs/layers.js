// 地図の情報レイヤー（目印・道路名・丁目と番地）。表示・非表示を切り替えられる。
// 文字が重ならないよう、優先度の高いものから置き、重なるものは出さない。
window.MapLayers = (() => {
  const KEY = 'layers';
  const GROUPS = [
    { id: 'poi', label: '目印', sub: '学校・コンビニ・郵便局・公園など' },
    { id: 'road', label: '道路名', sub: '大泉街道・富士街道など' },
    { id: 'addr', label: '丁目・番地', sub: '番地は大きく拡大したときだけ' }
  ];
  // 目印の種類: [アイコン, 表示し始めるズーム, 優先度（小さいほど先に置く）]
  const KINDS = {
    school: ['school', 15.75, 5], kinder: ['school', 17, 8], post: ['mail', 16, 6], police: ['shield', 16, 6],
    fire: ['shield', 16, 6], public: ['landmark', 16, 6], shrine: ['landmark', 16.5, 7],
    super: ['cart', 16, 6], conv: ['store', 16.5, 7], park: ['tree', 16.75, 8]
  };
  const ICONS = {
    school: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    landmark: '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>',
    tree: '<path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"/><path d="M12 19v3"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'
  };
  const svg = (name, cls) => `<svg class="icon ${cls || ''}" viewBox="0 0 24 24">${ICONS[name]}</svg>`;

  async function attach(map, opts) {
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
    L0.pois.forEach(([lat, lng, k, t], i) => {
      const [ic, z, prio] = KINDS[k];
      items.push({ id: 'p' + i, g: 'poi', lat, lng, text: t, cls: 'lbl-poi', icon: ic, z, prio });
    });
    L0.blocks.forEach(([lat, lng, t], i) => items.push({ id: 'b' + i, g: 'addr', lat, lng, text: t, cls: 'lbl-blk', z: 17.5, prio: 9 }));

    const live = new Map();   // id -> marker
    function makeMarker(it) {
      const div = document.createElement('div');
      div.className = 'lbl2 ' + it.cls;
      div.innerHTML = it.icon ? svg(it.icon, 'icon-xs') : '';
      div.append(it.text);
      return L.marker([it.lat, it.lng], { pane: 'labels', interactive: false, keyboard: false, icon: L.divIcon({ className: '', html: div, iconSize: [0, 0] }) });
    }
    // 文字の大きさの見積もり（12px の日本語 ≒ 1文字12px）
    function box(it, pt) {
      const w = it.text.length * (it.cls === 'lbl-blk' ? 7.5 : 12) + (it.icon ? 18 : 0) + 12;
      const h = 20;
      return it.icon ? [pt.x - 9, pt.y - h / 2, pt.x - 9 + w, pt.y + h / 2] : [pt.x - w / 2, pt.y - h / 2, pt.x + w / 2, pt.y + h / 2];
    }
    const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

    function draw() {
      const z = map.getZoom(), bounds = map.getBounds().pad(0.1);
      const placed = opts.occupied().map(p => { const c = map.latLngToContainerPoint(p); return [c.x - 18, c.y - 18, c.x + 18, c.y + 18]; });
      const want = new Set();
      const cands = items.filter(it => on[it.g] && z >= it.z && bounds.contains([it.lat, it.lng])).sort((a, b) => a.prio - b.prio);
      for (const it of cands) {
        const b = box(it, map.latLngToContainerPoint([it.lat, it.lng]));
        if (placed.some(p => hit(p, b))) continue;
        placed.push(b); want.add(it.id);
      }
      for (const [id, m] of live) if (!want.has(id)) { m.remove(); live.delete(id); }
      for (const it of cands) if (want.has(it.id) && !live.has(it.id)) live.set(it.id, makeMarker(it).addTo(map));
    }
    map.on('moveend zoomend', draw);
    draw();
    return { redraw: draw };
  }
  return { attach };
})();
