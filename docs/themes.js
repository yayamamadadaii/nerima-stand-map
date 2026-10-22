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
    K: '#000000', W: '#FCFCFC', R: '#E40058', P: '#6844FC', L: '#B8B8F8', D: '#3C1C9C', M: '#F878F8',
    Y: '#F8B800', G: '#00A800', B: '#7C3C00', S: '#FCD8A8', U: '#0058F8', O: '#F87858'
  };
  const SPRITES = {
    veg: [
      '.......G......', '.....GKGKG....', '...KKRGGGKK...', '..KRRRRRRRRK..', '..KRWRRRRRRK..', '.KRRRRRRRRRRK.',
      '.KRRRRRRRRRRK.', '.KRRRRRRRRRRK.', '.KRRRRRRRRRRK.', '..KRRRRRRRRK..', '..KRRRRRRRRK..', '...KKRRRRKK...', '.....KKKK.....'],
    fruit: [
      '........G.....', '.......BGG....', '......B.......', '..DPD.DPD.DPD.', '..PLP.PLP.PLP.', '..DPD.DPD.DPD.',
      '....DPD.DPD...', '....PLP.PLP...', '....DPD.DPD...', '......DPD.....', '......PLP.....', '......DPD.....'],
    flower: [
      '......MM......', '.....MWMM.....', '..MMM.MM.MMM..', '.MWMMMYYMMMMM.', '.MMMMYYYYMMMM.', '..MMMMYYMMMM..',
      '..MMM.MM.MMM..', '.....MMMM.....', '......MM......', '.......G......', '...GG..G..GG..', '....GGGG.GG...', '.......G......'],
    hero1: [
      '...YYYYYY...', '..YYYYYYYY..', 'YYYYYYYYYYYY', '..KSSSSSSK..', '..SSKSSKSS..', '..SSSSSSSS..', '...SSSSSS...',
      '..UUUUUUUU..', '.SUUWUUWUUS.', '.SUUUUUUUUS.', '..UUUUUUUU..', '..BBB..BBB..', '..KKK..KKK..'],
    hero2: [
      '...YYYYYY...', '..YYYYYYYY..', 'YYYYYYYYYYYY', '..KSSSSSSK..', '..SSKSSKSS..', '..SSSSSSSS..', '...SSSSSS...',
      '..UUUUUUUU..', '.SUUWUUWUUS.', '.SUUUUUUUUS.', '..UUUUUUUU..', '..BBB...BB..', '..KK....KKK.']
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
    pin: (s) => html(sprite(s.kind, 2)),
    icon: (s) => html(sprite(s.kind, 1.5)),
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
