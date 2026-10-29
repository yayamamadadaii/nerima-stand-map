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
    L: '#A8E06A', l: '#D8F5A8', t: '#78B840', P: '#8A4AC8', N: '#D08A4A', n: '#F0B878', D: '#9A5A30',
    o: '#FFD08A', u: '#D06A10', E: '#7A4A28', e: '#A86A3A'
  };
  // 広く見たときのピンの球: ハイライトと影つき。色で種類を分ける（2026-10-26 だいき指示）
  //   販売所 = 木箱のトマトと同じ赤、収穫体験だけ = 青、販売所で収穫体験もできる = 紫
  const ball = (R, r, s) => ({ w: '#FFFFFF', K: '#4A2E2A', R, r, h: '#FFFFFF', s });
  const BALL = { sale: ball('#F0483A', '#FF9C8A', '#C02A2A'), harvest: ball('#3A7BE0', '#9CC4FF', '#2350A8'), both: ball('#9A5AD8', '#C9A6F2', '#6A34A0') };
  const AIM_PAL = { K: '#4A2E2A', w: '#FFFFFF', W: '#FFFFFF', R: '#F0483A', r: '#FF9C8A', q: '#C02A2A', h: '#FFFFFF', M: '#7A7A80', G: '#2E6B34' };
  const SPRITE_PAL = { crate: PAL_KAIRO, field: PAL_KAIRO, ball: BALL.sale, aimA: AIM_PAL, aimB: AIM_PAL, aimRing: AIM_PAL };
  const AIM = 'A';                                   // 逆三角形（2026-10-29 だいき選択。虫ピンは B）
  const AIM_LIFT = 14;                               // ピンを場所の輪から少し浮かせる（px。輪と絵が重ならないように。だいき指示）
  const AIM_TIP = { A: [7.5, 18.5], B: [5.5, 17.5] };   // 先の画素の真ん中（ドット単位）
  const SPRITES = {
    // 販売所: 木箱に果物と野菜の盛り合わせ（2026-10-26 だいき選択。カイロソフト風、まわりに白いふち）。色は PAL_KAIRO
    crate: [
      '..www...wwww..wwww......', '.wwKww.wwKKw.wwKKww.....', '.wKLKwwwKGKw.wKYYKw..www', '.wKLGKwKGGKwwwKYYKwwwwGw', '.wwKGGKKGGKwwKYYYKwKKgww',
      '..wKGGKKGGKwwKYYYKKPPPKw', '..wKGKKKGGKKgGKYYKPPPPKw', '..wKKlLLKKrrGRRKYKPPPPKw', '.wwKlLLLLKrWRRRKKPPPPKww', '.wKlLLLLKrRRRRRRKPKgKKw.',
      '.wKLLLGLKRRRRRRqKKOOOKww', '.wKLLGLGLKRRRRqKKOOOOOKw', '.wwKLLLLtKRRRqqKKOOOOOKw', 'wwwKKLLtKKKKKKKwwKOOOKww', 'wKKKKKKKKKKKKKKKKKKKKKKw',
      'wKnnnnnnnnnnnnnnnnnnnnKw', 'wKNNNNNDNNNNDNNNNDNNNNKw', 'wKDDDDDDDDDDDDDDDDDDDDKw', 'wKNNNNNDNNNNDNNNNDNNNNKw', 'wKKKKKKKKKKKKKKKKKKKKKKw',
      'wwwwwwwwwwwwwwwwwwwwwwww'],
    // 収穫体験の農園: 畑から野菜（キャベツ・にんじん・トマト）が生えている（2026-10-26）。色は PAL_KAIRO
    field: [
      '.........wwwwwww........', '........wwKwKwKwwwwww...', '........wKGKLKGKwwKKww..', '........wKGKGKGKwKGGKw..', '...wwwwwwwKGGGK.KGGGKww.', '..wwKKKwwwwKGK..KGGKRKw.', '.wwKlLLKwwwKgK.KGGKRRKw.', '.wKlLLLLKwKOOOKKKKGKKKw.', '.wKLLLLLKKOoOOuKKRKGGKw.', '.wKLLGLLKKOOOOuKRRKGKww.', '.wKLGLGtKKKOOuKKKKKGKw..', '.wwKLLtKeeeeeeeeKGGKKww.', 'wwKeKKKeeeeeeeeeeKKeeKww', 'wKEeEeEeEeEeEeEeEeEeEEKw', 'wKeeeeeeeeeeeeeeeeeeEEKw', 'wKeeeeeeeeeeeeeeeeeEEEKw', 'wwKeEeEeEeEeEeEeEeEEEKww', '.wwKKKeeeeeeeeeeeEKKKww.', '..wwwwKKKKKKKKKKKKwwww..', '.....wwwwwwwwwwwwww.....'],
    // [発見] で場所を合わせるピン（2026-10-29）: aimA = 逆三角形、aimB = 虫ピン。先の画素が登録する場所。aimRing は先の下に出す輪
    aimA: ['....wwwwwww....', '...wwKKKKKww...', '..wwKrrRRRKww..', '.wwKrrRRRRRKww.', '.wKrRRWWWRRRKw.', 'wwKrRWWWWWRRKww', 'wKRRWWWWWWWRqKw', 'wKRRWWWWWWWRqKw', 'wKRRWWWWWWWRqKw', 'wwKRRWWWWWRqKww',
      '.wKRRRWWWRRqKw.', '.wwKRRRRRRqKww.', '..wKRRRRRqqKw..', '..wwKRRRqqKww..', '...wwKRRqKww...', '....wKRqqKw....', '.....wKqKw.....', '.....wwKww.....', '......wKw......', '.......w.......'],
    aimB: ['...wwwww...', '..wwKKKww..', '.wwKrrRKww.', 'wwKrhrRRKww', 'wKrrrRRRqKw', 'wKrRRRRRqKw', 'wKRRRRRqqKw', 'wwKRRRqqKww', '.wwKKKKKww.', '..wKRRqKw..',
      '..wKKKKKw..', '...wwKww...', '....wMw....', '....wMw....', '....wMw....', '....wMw....', '....wMw....', '....wKw....', '.....w.....'],
    aimRing: ['..www..', '.wGGGw.', 'wGw.wGw', 'wG...Gw', 'wGw.wGw', '.wGGGw.', '..www..'],
    ball: ['..wwwwwww..', '.wwKKKKKww.', 'wwKrrrrRKww', 'wKrhrrRRRKw', 'wKrrrRRRRKw', 'wKrrRRRRsKw', 'wKrRRRRssKw', 'wKRRRRsssKw', 'wwKRRsssKww', '.wwKKKKKww.', '..wwwwwww..'],
    hero1: [
      '...HHHHHH...', '..HHHHHHHH..', 'HHHHHHHHHHHH', '..KSSSSSSK..', '..SSKSSKSS..', '..SSSSSSSS..', '...SSSSSS...',
      '..VVVVVVVV..', '.SVVWVVWVVS.', '.SVVVVVVVVS.', '..VVVVVVVV..', '..BBB..BBB..', '..KKK..KKK..'],
    hero2: [
      '...HHHHHH...', '..HHHHHHHH..', 'HHHHHHHHHHHH', '..KSSSSSSK..', '..SSKSSKSS..', '..SSSSSSSS..', '...SSSSSS...',
      '..VVVVVVVV..', '.SVVWVVWVVS.', '.SVVVVVVVVS.', '..VVVVVVVV..', '..BBB...BB..', '..KK....KKK.']
  };
  function sprite(key, scale = 2, pal = SPRITE_PAL[key] || PAL) {
    const rows = SPRITES[key], w = rows[0].length, h = rows.length;
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
    // 種類（s.cat）: sale = 販売所、harvest = 収穫体験だけ、both = 販売所で収穫体験もできる
    // 拡大: 販売する所は木箱、収穫体験だけの所は畑の絵（色の球は付けない。だいき指示 2026-10-26）
    pin: (s) => {
      const w = document.createElement('span');
      w.className = 'pin-art';
      w.innerHTML = sprite(s.cat === 'harvest' ? 'field' : 'crate', 1.5)
        + `<span class="pin-dot">${sprite('ball', 1.5, BALL[s.cat])}</span>`;
      return w;
    },
    icon: (s) => html(sprite(s.cat === 'harvest' ? 'field' : 'crate', 1.25)),
    // [発見] の場所合わせのピン。要素の左上が登録する場所（輪の真ん中）。ピンの先はその少し上に浮かせる
    aim: () => {
      const d = document.createElement('span');
      d.className = 'aim-art';
      const sc = 2.5, [tx, ty] = AIM_TIP[AIM];
      d.innerHTML = `<span class="aim-ring">${sprite('aimRing', 3)}</span><span class="aim-pin" style="left:${-tx * sc}px;top:${-ty * sc - AIM_LIFT}px">${sprite('aim' + AIM, sc)}</span>`;
      return d;
    },
    // 色の見方（広く見ているとき）に使う球
    ball: (cat) => sprite('ball', 1, BALL[cat]),
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
