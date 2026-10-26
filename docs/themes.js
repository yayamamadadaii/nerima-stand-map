// ファミコン本体風の見た目（普段の見た目）。シンプルな見た目は simple/ のページ（または ?theme=simple）。
// ドット絵は文字列で持ち、その場で小さな SVG にする（画像ファイルを増やさない）。
window.Theme = (() => {
  // simple/ のページは window.APP_THEME = "simple"。?theme=simple でも切り替えられる
  const name = window.APP_THEME || new URLSearchParams(location.search).get('theme') || 'fami';
  if (name !== 'fami') return null;

  // クラスと CSS・フォントは、表示のちらつきを防ぐため index.html の head で先に入れている
  document.documentElement.classList.add('retro', 't-' + name);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', '#F3EBDD'));

  const PAL = {
    K: '#3A2A1A', W: '#FFFDF5', R: '#E43B44', O: '#F7962F', Y: '#F8D040', G: '#4CAF3A', L: '#8FD45A', P: '#7A4FC8',
    B: '#6B3A1A', N: '#C98A4A', C: '#F6E7C4', S: '#FCD8A8', U: '#2F6FD8', E: '#9A9A9A', H: '#F8B800', V: '#0058F8', T: '#D9A55B'
  };
  // カイロソフト風のドット絵の色（2026-10-26〜。ほかのドット絵もあとでこちらにそろえる）
  const PAL_KAIRO = {
    K: '#4A2E2A', w: '#FFFFFF', W: '#FFFFFF', R: '#F0483A', r: '#FF9C8A', q: '#C02A2A', O: '#FF9A2E', Y: '#FFD43A', G: '#5CC84A', g: '#2E8A3A',
    L: '#A8E06A', l: '#D8F5A8', t: '#78B840', P: '#8A4AC8', N: '#D08A4A', n: '#F0B878', D: '#9A5A30'
  };
  // 広く見たときのピンの球: 木箱のピンのトマトと同じ赤に、ハイライトと影（だいき指示 2026-10-26。落ち着いた赤も試したが戻した）
  const PAL_BALL = { w: '#FFFFFF', K: '#4A2E2A', R: '#F0483A', r: '#FF9C8A', h: '#FFFFFF', s: '#C02A2A' };
  const SPRITE_PAL = { crate: PAL_KAIRO, ball: PAL_BALL };
  const SPRITES = {
    // 販売所: 木箱に果物と野菜の盛り合わせ（2026-10-26 だいき選択。カイロソフト風、まわりに白いふち）。色は PAL_KAIRO
    crate: [
      '..www...wwww..wwww......', '.wwKww.wwKKw.wwKKww.....', '.wKLKwwwKGKw.wKYYKw..www', '.wKLGKwKGGKwwwKYYKwwwwGw', '.wwKGGKKGGKwwKYYYKwKKgww',
      '..wKGGKKGGKwwKYYYKKPPPKw', '..wKGKKKGGKKgGKYYKPPPPKw', '..wKKlLLKKrrGRRKYKPPPPKw', '.wwKlLLLLKrWRRRKKPPPPKww', '.wKlLLLLKrRRRRRRKPKgKKw.',
      '.wKLLLGLKRRRRRRqKKOOOKww', '.wKLLGLGLKRRRRqKKOOOOOKw', '.wwKLLLLtKRRRqqKKOOOOOKw', 'wwwKKLLtKKKKKKKwwKOOOKww', 'wKKKKKKKKKKKKKKKKKKKKKKw',
      'wKnnnnnnnnnnnnnnnnnnnnKw', 'wKNNNNNDNNNNDNNNNDNNNNKw', 'wKDDDDDDDDDDDDDDDDDDDDKw', 'wKNNNNNDNNNNDNNNNDNNNNKw', 'wKKKKKKKKKKKKKKKKKKKKKKw',
      'wwwwwwwwwwwwwwwwwwwwwwww'],
    ball: ['..wwwwwww..', '.wwKKKKKww.', 'wwKrrrrRKww', 'wKrhrrRRRKw', 'wKrrrRRRRKw', 'wKrrRRRRsKw', 'wKrRRRRssKw', 'wKRRRRsssKw', 'wwKRRsssKww', '.wwKKKKKww.', '..wwwwwww..'],
    hero1: [
      '...HHHHHH...', '..HHHHHHHH..', 'HHHHHHHHHHHH', '..KSSSSSSK..', '..SSKSSKSS..', '..SSSSSSSS..', '...SSSSSS...',
      '..VVVVVVVV..', '.SVVWVVWVVS.', '.SVVVVVVVVS.', '..VVVVVVVV..', '..BBB..BBB..', '..KKK..KKK..'],
    hero2: [
      '...HHHHHH...', '..HHHHHHHH..', 'HHHHHHHHHHHH', '..KSSSSSSK..', '..SSKSSKSS..', '..SSSSSSSS..', '...SSSSSS...',
      '..VVVVVVVV..', '.SVVWVVWVVS.', '.SVVVVVVVVS.', '..VVVVVVVV..', '..BBB...BB..', '..KK....KKK.']
  };
  function sprite(key, scale = 2) {
    const rows = SPRITES[key], pal = SPRITE_PAL[key] || PAL, w = rows[0].length, h = rows.length;
    let rects = '';
    rows.forEach((r, y) => {
      // 同じ色が続く横一列は1つの四角にまとめる
      for (let x = 0; x < w;) {
        const c = r[x];
        let n = 1; while (x + n < w && r[x + n] === c) n++;
        if (c !== '.') rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${pal[c]}"/>`;
        x += n;
      }
    });
    return `<svg class="px" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }
  const html = (s) => { const t = document.createElement('template'); t.innerHTML = s; return t.content.firstChild; };

  const copy = { near: () => 'ちかくに あるよ！', route: 'Googleマップで けいろ' };

  return {
    name,
    // ピン: 拡大しているときはドット絵、広く見ているとき（html.far）は色違いの丸（themes.css で切り替え）
    pin: () => {
      const w = document.createElement('span');
      w.className = 'pin-art';
      w.innerHTML = sprite('crate', 1.5) + `<span class="pin-dot">${sprite('ball', 1.5)}</span>`;
      return w;
    },
    icon: () => html(sprite('crate', 1.25)),
    me: () => {
      const d = document.createElement('div');
      d.className = 'me me-px';
      d.innerHTML = `<div class="me-cone" hidden></div><div class="hero">${sprite('hero1', 3.25)}${sprite('hero2', 3.25)}</div>`;
      return d;
    },
    nearEyebrow: copy.near,
    routeLabel: copy.route
  };
})();
