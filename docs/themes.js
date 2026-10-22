// ファミコン本体風の見た目（普段の見た目）。シンプルな見た目は simple/ のページ（または ?theme=simple）。
// ドット絵は文字列で持ち、その場で小さな SVG にする（画像ファイルを増やさない）。
window.Theme = (() => {
  // simple/ のページは window.APP_THEME = "simple"。?theme=simple でも切り替えられる
  const name = window.APP_THEME || new URLSearchParams(location.search).get('theme') || 'fami';
  if (name !== 'fami') return null;

  // クラスと CSS・フォントは、表示のちらつきを防ぐため index.html の head で先に入れている
  document.documentElement.classList.add('retro', 't-' + name);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', '#F3EBDD'));
  // 地図の線を等倍で描いて拡大する（ドットが見える。描く量も減って軽くなる）
  if (window.L) L.Browser.retina = false;

  const PAL = {
    K: '#3A2A1A', W: '#FFFDF5', R: '#E43B44', O: '#F7962F', Y: '#F8D040', G: '#4CAF3A', L: '#8FD45A', P: '#7A4FC8',
    B: '#6B3A1A', N: '#C98A4A', C: '#F6E7C4', S: '#FCD8A8', U: '#2F6FD8', E: '#9A9A9A', H: '#F8B800', V: '#0058F8'
  };
  const SPRITES = {
    // 無人販売所: 屋根つきの棚に野菜と果物
    shelf: [
      '...KKKKKKKKKK...', '..KBBBBBBBBBBK..', '.KBBBBBBBBBBBBK.', 'KKKKKKKKKKKKKKKK',
      'KNCCCCCCCCCCCCNK', 'KNCRRCOOCLLCPPNK', 'KNKRRKOOKGGKPPNK', 'KNNNNNNNNNNNNNNK',
      'KNCYYCLLCRRCEENK', 'KNKYYKGGKRRKEENK', 'KNNNNNNNNNNNNNNK', '.KN..........NK.',
      '.KN..........NK.', '.KK..........KK.'],
    // 直売所: しま模様のテントの下に、お店の人
    tent: [
      '...KKKKKKKKKK...', '..KRRWWRRWWRRK..', '.KRRWWRRWWRRWWK.', 'KRRWWRRWWRRWWRRK',
      'KKKKKKKKKKKKKKKK', '.K....BBBB....K.', '.K...BSSSSB...K.', '.K...SKSSKS...K.',
      '.K....SKKS....K.', '.KRR.UUUUUU.LL.K', 'KKKKKKKKKKKKKKKK', 'KNNNNNNNNNNNNNNK',
      'KNNNNNNNNNNNNNNK', '.KN..........NK.', '.KK..........KK.'],
    hero1: [
      '...HHHHHH...', '..HHHHHHHH..', 'HHHHHHHHHHHH', '..KSSSSSSK..', '..SSKSSKSS..', '..SSSSSSSS..', '...SSSSSS...',
      '..VVVVVVVV..', '.SVVWVVWVVS.', '.SVVVVVVVVS.', '..VVVVVVVV..', '..BBB..BBB..', '..KKK..KKK..'],
    hero2: [
      '...HHHHHH...', '..HHHHHHHH..', 'HHHHHHHHHHHH', '..KSSSSSSK..', '..SSKSSKSS..', '..SSSSSSSS..', '...SSSSSS...',
      '..VVVVVVVV..', '.SVVWVVWVVS.', '.SVVVVVVVVS.', '..VVVVVVVV..', '..BBB...BB..', '..KK....KKK.']
  };
  function sprite(key, scale = 2) {
    const rows = SPRITES[key], w = rows[0].length, h = rows.length;
    let rects = '';
    rows.forEach((r, y) => {
      // 同じ色が続く横一列は1つの四角にまとめる
      for (let x = 0; x < w;) {
        const c = r[x];
        let n = 1; while (x + n < w && r[x + n] === c) n++;
        if (c !== '.') rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${PAL[c]}"/>`;
        x += n;
      }
    });
    return `<svg class="px" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }
  const html = (s) => { const t = document.createElement('template'); t.innerHTML = s; return t.content.firstChild; };

  const copy = { near: () => 'ちかくに あるよ！', route: 'Googleマップで けいろ' };

  return {
    name,
    pin: (s) => html(sprite(s.unmanned ? 'shelf' : 'tent', 2.25)),
    icon: (s) => html(sprite(s.unmanned ? 'shelf' : 'tent', 1.75)),
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
