// 細い道（私道・路地・歩道）。拡大したときだけ、あとから読み込んで描く
window.SmallRoads = (() => {
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const SMALL_Z = 15.5;

  async function attach(map, opts) {
    // 細い道は、畑や公園の面より上・車道より下に描く
    map.createPane('small').style.zIndex = 245;
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
  }

  return { attach };
})();
