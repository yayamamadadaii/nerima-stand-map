// MapLibre GL で地図を描く（Leaflet 版からの載せ替え）。真上から見て、北が上のまま。
// ズームの数字は Leaflet 版に合わせる: MapLibre のズーム + 1 = Leaflet のズーム（MapLibre は 512px タイル基準のため）
(() => {
  const css = StandApp.css;
  const LZ = 1;                       // Leaflet のズームとの差
  const FAR_Z = 15 - LZ;              // これより広く見ているときは色違いの丸のピン
  const SMALL_Z = 15.5 - LZ;          // 細い道を出し始めるズーム
  let map, area, layers, smallLoaded = false;
  const pinMarkers = new Map();
  let meMarker, stations = [];

  const ll = (p) => [p[1], p[0]];
  const lines = (list) => ({ type: 'FeatureCollection', features: list.map(c => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c.map(ll) } })) });
  const polys = (list) => ({ type: 'FeatureCollection', features: list.filter(c => c.length > 3).map(c => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [c.map(ll)] } })) });
  // 外枠と穴は逆回りにしないと穴として扱われない
  const area2 = (r) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0);
  const orient = (r, ccw) => (area2(r) > 0) === ccw ? r : r.slice().reverse();
  // 線の太さ: Leaflet 版の「ズーム15で a、ズーム19で b」と同じになるように
  const w = (a, b, from = 15) => ['interpolate', ['linear'], ['zoom'], from - LZ, a, 19 - LZ, b];

  function colors() {
    const c = {};
    for (const k of ['land', 'farm', 'park', 'water', 'road', 'road-casing', 'road-major-casing', 'rail', 'border']) c[k] = css('--map-' + k);
    return c;
  }
  // [レイヤーID, 種類, データ, 見た目]
  const LAYERS = [
    ['farm', 'fill', 'farm', c => ({ 'fill-color': c.farm })],
    ['park', 'fill', 'park', c => ({ 'fill-color': c.park })],
    ['water', 'fill', 'water', c => ({ 'fill-color': c.water })],
    ['river', 'line', 'river', c => ({ 'line-color': c.water, 'line-width': w(2, 6) })],
    ['minor-c', 'line', 'minor', c => ({ 'line-color': c['road-casing'], 'line-width': w(3, 11) })],
    ['mid-c', 'line', 'mid', c => ({ 'line-color': c['road-casing'], 'line-width': w(5, 13) })],
    ['major-c', 'line', 'major', c => ({ 'line-color': c['road-major-casing'], 'line-width': w(7, 19) })],
    ['minor', 'line', 'minor', c => ({ 'line-color': c.road, 'line-width': w(1.5, 9.5) })],
    ['mid', 'line', 'mid', c => ({ 'line-color': c.road, 'line-width': w(3.5, 11.5) })],
    ['major', 'line', 'major', c => ({ 'line-color': c.road, 'line-width': w(5, 17) })],
    ['rail', 'line', 'rail', c => ({ 'line-color': c.rail, 'line-width': w(2, 4) })],
    ['rail-dash', 'line', 'rail', c => ({ 'line-color': c.land, 'line-width': w(1, 3), 'line-dasharray': [3, 3] })],
    ['mask', 'fill', 'mask', c => ({ 'fill-color': c.land, 'fill-opacity': 0.72 })],
    ['border', 'line', 'border', c => ({ 'line-color': c.border, 'line-width': 1, 'line-dasharray': [4, 4], 'line-opacity': 0.6 })]
  ];
  const SMALL = [
    ['lane', 'line', 'lane', c => ({ 'line-color': c.road, 'line-width': w(1.2, 5.7, 16) })],
    ['path', 'line', 'path', c => ({ 'line-color': c['road-casing'], 'line-width': w(1, 2.5, 16), 'line-dasharray': [2, 3] })]
  ];
  const layerDef = ([id, type, source, paint], c) => ({ id, type, source, paint: paint(c), ...(type === 'line' && id !== 'rail-dash' && id !== 'path' && id !== 'border' ? { layout: { 'line-cap': 'round', 'line-join': 'round' } } : {}) });

  // MapLibre はマーカーの要素に位置の transform を付けるので、自前の要素は箱に入れて渡す
  function box(el, size) {
    const b = document.createElement('div');
    b.style.width = b.style.height = (size || 0) + 'px';
    b.append(el);
    return b;
  }

  async function loadSmall() {
    if (smallLoaded) return;
    smallLoaded = true;
    const S = await (await fetch(`${window.APP_BASE || ''}data/small.json?v=${window.APP_V || ''}`)).json();
    map.addSource('lane', { type: 'geojson', data: lines(S.lane) });
    map.addSource('path', { type: 'geojson', data: lines(S.path) });
    const c = colors();
    // 畑や公園の面より上・車道のふちより下
    for (const d of SMALL) map.addLayer({ ...layerDef(d, c), minzoom: SMALL_Z }, 'minor-c');
  }

  // AI で描いたドット絵の地図（art/）。今の地図に濃さ30%で重ねる。見えている所の絵だけ読み込む
  // 絵は町の境界から外へ行くほど薄くなるように作ってある（tools/fade_art.py）
  const ART_OPACITY = 0.3;
  let artTiles = null;
  const artAdded = new Set();
  async function loadArt() {
    if (!artTiles) {
      artTiles = [];
      artTiles = (await (await fetch(`${window.APP_BASE || ''}art/tiles.json?v=${window.APP_V || ''}`)).json()).tiles;
    }
    const b = map.getBounds(), mx = (b.getEast() - b.getWest()) / 2, my = (b.getNorth() - b.getSouth()) / 2;
    for (const t of artTiles) {
      if (artAdded.has(t.url)) continue;
      const [[l, top], , [r, bottom]] = t.corners;
      if (r < b.getWest() - mx || l > b.getEast() + mx || top < b.getSouth() - my || bottom > b.getNorth() + my) continue;
      artAdded.add(t.url);
      const id = 'art-' + t.url;
      map.addSource(id, { type: 'image', url: `${window.APP_BASE || ''}art/${t.url}?v=${window.APP_V || ''}`, coordinates: t.corners });
      // 道や畑の上・町の外を薄くする覆いの下
      map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': ART_OPACITY, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } }, 'mask');
    }
  }

  const adapter = {
    async init({ D, towns, stands, pins, meEl, onMapClick, onUserMove }) {
      const ring = towns.flatMap(t => t.rings[0]);
      area = new maplibregl.LngLatBounds(
        [Math.min(...ring.map(p => p[1])), Math.min(...ring.map(p => p[0]))],
        [Math.max(...ring.map(p => p[1])), Math.max(...ring.map(p => p[0]))]);
      const pad = 0.01;
      const world = orient([[139.4, 35.6], [139.8, 35.6], [139.8, 35.9], [139.4, 35.9], [139.4, 35.6]], true);
      const sources = {
        farm: polys(D.farm), park: polys(D.park), water: polys(D.water), river: lines(D.river),
        minor: lines(D.minor), mid: lines(D.mid), major: lines(D.major.concat(D.motorway)), rail: lines(D.rail),
        mask: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [world, ...towns.map(t => orient(t.rings[0].map(ll), false))] } },
        border: { type: 'FeatureCollection', features: towns.map(t => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: t.rings[0].map(ll) } })) }
      };
      const c = colors();
      map = new maplibregl.Map({
        container: 'map',
        style: {
          version: 8,
          sources: Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, { type: 'geojson', data: v }])),
          layers: [{ id: 'bg', type: 'background', paint: { 'background-color': c.land } }].concat(LAYERS.map(d => layerDef(d, c)))
        },
        bounds: area, fitBoundsOptions: { padding: 8 },
        maxBounds: [[area.getWest() - pad, area.getSouth() - pad], [area.getEast() + pad, area.getNorth() + pad]],
        maxZoom: 19 - LZ, maxPitch: 0, attributionControl: false, renderWorldCopies: false,
        dragRotate: false, pitchWithRotate: false, touchPitch: false
      });
      map.touchZoomRotate.disableRotation();   // 北が上のまま
      await new Promise(r => map.once('load', r));
      map.setMinZoom(map.getZoom() - 0.3);

      map.on('click', onMapClick);
      // 少し触れただけでは追いかけをやめない。40px 以上動かしたときだけ
      let dragFrom;
      map.on('dragstart', () => { dragFrom = map.getCenter(); });
      map.on('drag', () => {
        if (!dragFrom) return;
        const p = map.project(dragFrom), cx = map.getContainer().clientWidth / 2, cy = map.getContainer().clientHeight / 2;
        if (Math.hypot(p.x - cx, p.y - cy) > 40) { dragFrom = null; onUserMove(); }
      });
      const setFar = () => document.documentElement.classList.toggle('far', map.getZoom() < FAR_Z);
      map.on('zoom', setFar);
      setFar();
      map.on('zoomend', () => { if (map.getZoom() >= SMALL_Z - 0.5) loadSmall(); });
      map.on('moveend', loadArt);
      // 読み込みに失敗した絵は外しておき、次に地図を動かしたときに読み直す
      map.on('error', (e) => {
        const id = e.sourceId;
        if (!id || !id.startsWith('art-')) return;
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
        artAdded.delete(id.slice(4));
      });
      loadArt();

      const label = (p, text, cls) => {
        const div = document.createElement('div');
        div.className = 'lbl ' + cls; div.textContent = text;
        new maplibregl.Marker({ element: box(div) }).setLngLat(ll(p)).addTo(map);
      };
      D.stations.forEach(s => label(s.p, s.name + '駅', 'lbl-st'));
      stations = D.stations.map(s => ({ lat: s.p[0], lng: s.p[1] }));
      towns.forEach(t => label(t.c, t.name, 'lbl-town'));

      for (const s of stands) pinMarkers.set(s.no, new maplibregl.Marker({ element: box(pins.get(s.no), 36) }).setLngLat([s.lng, s.lat]));
      meMarker = new maplibregl.Marker({ element: box(meEl) });
    },
    showPins(nos) {
      const on = new Set(nos);
      for (const [no, m] of pinMarkers) {
        if (on.has(no)) { if (!m._map) m.addTo(map); } else m.remove();
        // 選んだピンを手前に
        m.getElement().style.zIndex = m.getElement().querySelector('.sel') ? 2 : 1;
      }
      layers?.redraw();
    },
    setMe(p) { meMarker.setLngLat([p.lng, p.lat]); if (!meMarker._map) { meMarker.addTo(map); meMarker.getElement().style.zIndex = 3; } },
    follow(p) {
      const z = map.getZoom() < 16.5 - LZ ? 17 - LZ : map.getZoom();
      map.easeTo({ center: [p.lng, p.lat], zoom: z, duration: 600 });
    },
    setHeading() {},
    bearing() { return 0; },
    center() { const c = map.getCenter(); return { lat: c.lat, lng: c.lng }; },
    areaCenter() { const c = area.getCenter(); return { lat: c.lat, lng: c.lng }; },
    flyTo(s) { map.easeTo({ center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), 16.5 - LZ), duration: 500 }); },
    restyle() {
      const c = colors();
      map.setPaintProperty('bg', 'background-color', c.land);
      for (const d of LAYERS.concat(smallLoaded ? SMALL : [])) {
        for (const [k, v] of Object.entries(d[3](c))) if (k.endsWith('color')) map.setPaintProperty(d[0], k, v);
      }
    }
  };

  // 文字が販売所のピン・駅名・自分のキャラに重ならないように
  const occupied = () => [
    ...[...pinMarkers.values()].filter(m => m._map).map(m => m.getLngLat()),
    ...stations, ...(meMarker && meMarker._map ? [meMarker.getLngLat()] : [])
  ].map(p => ({ lat: p.lat, lng: p.lng }));
  // layers.js に渡す、MapLibre での文字の置き方
  const view = {
    zoom: () => map.getZoom() + LZ,
    inView: (lat, lng) => {
      const b = map.getBounds(), dx = (b.getEast() - b.getWest()) * 0.1, dy = (b.getNorth() - b.getSouth()) * 0.1;
      return lng > b.getWest() - dx && lng < b.getEast() + dx && lat > b.getSouth() - dy && lat < b.getNorth() + dy;
    },
    project: (lat, lng) => map.project([lng, lat]),
    addLabel: (el, lat, lng) => new maplibregl.Marker({ element: box(el) }).setLngLat([lng, lat]).addTo(map),
    onMoveEnd: (fn) => map.on('moveend', fn)
  };

  StandApp.start(adapter).then(async () => {
    layers = await MapLayers.attach(view, { occupied });
    if (map.getZoom() >= SMALL_Z - 0.5) loadSmall();
  });
})();
