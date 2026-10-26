// A/B 共通: データ読み込み、画面（見出し・シート・一覧）、現在地、近づくと反応。
// 地図ライブラリごとの違いは adapter に閉じ込める（a/index.html = Leaflet、b/index.html = MapLibre）。
window.StandApp = (() => {
  const NEAR_M = 60;          // この距離まで近づいたら「すぐ近く」を出す
  const $ = (id) => document.getElementById(id);
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const T = window.Theme;   // ファミコン風の試作（themes.js）。null なら通常の見た目

  const ICONS = {
    veg: '<path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z"/><path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z"/>',
    fruit: '<path d="M22 5V2l-5.89 5.89"/><circle cx="16.6" cy="15.89" r="3"/><circle cx="8.11" cy="7.4" r="3"/><circle cx="12.35" cy="11.65" r="3"/><circle cx="13.91" cy="5.85" r="3"/><circle cx="18.15" cy="10.09" r="3"/><circle cx="6.56" cy="13.2" r="3"/><circle cx="10.8" cy="17.44" r="3"/><circle cx="5" cy="19" r="3"/>',
    flower: '<circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/><path d="M12 7.5V9"/><path d="M7.5 12H9"/><path d="M16.5 12H15"/><path d="M12 16.5V15"/><path d="m8 8 1.88 1.88"/><path d="M14.12 9.88 16 8"/><path d="m8 16 1.88-1.88"/><path d="M14.12 14.12 16 16"/>',
    nav: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    locate: '<line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
    compass: '<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/>',
  };
  function icon(name, cls = '') {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', ('icon ' + cls).trim());
    s.innerHTML = ICONS[name];
    return s;
  }
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
    return e;
  }

  // 品目から種類を決める（ピンのアイコン用）
  const FRUIT = /ブドウ|カキ|キウイ|ブルーベリー|ミカン|クリ|イチゴ|イチジク|ブンタン|レモン|ユズ|カンキツ|スイカ/;
  const FLOWER = /花|苗|シクラメン|パンジー|ビオラ|プリムラ|ペチュニア|マリーゴールド|ハボタン|ポインセチア|インパチェンス|ベゴニア|アジサイ|マーガレット|ロベリア|コスモス|宿根草|多肉|ペンタス|ストック|ぼたん/;
  function kind(s) {
    if (s.items.every(i => FLOWER.test(i))) return 'flower';
    if (s.items.every(i => FRUIT.test(i))) return 'fruit';
    return 'veg';
  }

  function distM(a, b) {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(x));
  }
  const fmtDist = (m) => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
  const routeUrl = (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=walking`;

  function pointInRing(p, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [yi, xi] = ring[i], [yj, xj] = ring[j];
      if ((yi > p.lat) !== (yj > p.lat) && p.lng < (xj - xi) * (p.lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  async function start(adapter) {
    const D = await (await fetch(`${window.APP_BASE || ''}data/mapdata.json?v=${window.APP_V || ''}`)).json();
    const towns = D.towns.filter(t => t.name !== '西大泉町');
    const stands = D.stands.map(s => ({ ...s, kind: kind(s) }));
    const inArea = (p) => towns.some(t => pointInRing(p, t.rings[0]));

    const st = {
      selected: null, sheet: null,
      me: null,            // {lat, lng, acc}
      heading: null,       // 度。北=0
      follow: false, watching: false, nearNo: null
    };
    // 無人販売所と直売所は分けずに「販売所」として全部同じピンで出す。無人か有人かは詳細で分かる（2026-10-26 だいき）
    const visible = () => true;

    // ピン
    const pins = new Map();
    for (const s of stands) {
      const p = el('div', { class: 'pin', role: 'button', 'aria-label': s.name }, T ? T.pin(s) : icon(s.kind));
      p.addEventListener('click', (e) => { e.stopPropagation(); openDetail(s.no); });
      pins.set(s.no, p);
    }
    function renderPins() {
      for (const s of stands) {
        const p = pins.get(s.no);
        p.classList.toggle('sel', s.no === st.selected);
        p.classList.toggle('near', s.no === st.nearNo);
      }
      adapter.showPins(stands.filter(visible).map(s => s.no));
    }

    // 自分のマーカー
    const meEl = T ? T.me() : el('div', { class: 'me' }, el('div', { class: 'me-ring' }), el('div', { class: 'me-cone', hidden: true }), el('div', { class: 'me-dot' }));
    const cone = meEl.querySelector('.me-cone');

    await adapter.init({ D, towns, stands, pins, meEl, css, onMapClick: closeSheet, onUserMove: () => pauseFollow() });

    // ---------- 見出し ----------
    $('listBtn').replaceChildren(icon('list', 'icon-sm'), '一覧');
    $('listBtn').onclick = () => st.sheet === 'list' ? closeSheet() : openList();

    // ---------- シート ----------
    const sheet = $('sheet');
    function head(title, sub) {
      return el('div', { class: 'sheet-head' },
        el('div', {}, el('h2', {}, title), sub ? el('div', { class: 'sub' }, sub) : null),
        el('button', { class: 'close', type: 'button', 'aria-label': '閉じる', onclick: closeSheet }, icon('x', 'icon-sm')));
    }
    function showSheet(view, ...content) {
      st.sheet = view;
      sheet.replaceChildren(el('div', { class: 'stack' }, ...content));
      sheet.hidden = false; sheet.scrollTop = 0;
      $('nearCard').hidden = true;
    }
    function closeSheet() {
      if (sheet.hidden) return;
      sheet.hidden = true; st.sheet = null;
      if (st.selected != null) { st.selected = null; renderPins(); }
      checkNear();
    }
    function openDetail(no) {
      const s = stands.find(x => x.no === no);
      if (!s) return;
      st.selected = no; renderPins();
      const d = st.me ? distM(st.me, s) : null;
      showSheet('detail',
        head(s.name, s.address),
        el('div', { class: 'meta-line' },
          el('span', { class: s.unmanned ? 'tag' : 'tag tag-manned' }, s.unmanned ? '無人' : 'お店の人がいる'),
          d != null ? el('span', { class: 'near-dist' }, `ここから ${fmtDist(d)}`) : null,
          el('span', { class: 'sub' }, `区のガイド No.${s.no}`)),
        s.note ? el('p', { class: 'note' }, s.note) : null,
        el('div', { class: 'stack', style: 'gap:4px' },
          el('div', { class: 'sub' }, '主な品目（時期によって変わります）'),
          el('div', { class: 'tags' }, s.items.map(i => el('span', { class: 'tag tag-plain' }, i)))),
        el('a', { class: 'btn btn-primary', href: routeUrl(s), target: '_blank', rel: 'noopener' }, icon('nav'), T ? T.routeLabel : 'Googleマップで経路を見る'),
        el('div', { class: 'sub' }, '情報は2025年11月発行の区のガイドより。開いていないこともあります。'));
    }
    function openList() {
      const from = st.me && inArea(st.me) ? st.me : adapter.center();
      const rows = stands.filter(visible).map(s => ({ s, d: distM(from, s) })).sort((a, b) => a.d - b.d);
      showSheet('list',
        head(`${rows.length} か所の販売所`, st.me && inArea(st.me) ? '今いる場所から近い順' : '地図の中心から近い順'),
        el('div', { class: 'list' }, rows.map(({ s, d }) =>
          el('button', { class: 'row', type: 'button', onclick: () => { pauseFollow(); adapter.flyTo(s); openDetail(s.no); } },
            el('span', { class: 'row-icon' }, T ? T.icon(s) : icon(s.kind)),
            el('span', { class: 'row-main' },
              el('div', { class: 'row-title' }, s.name),
              el('div', { class: 'row-sub' }, `${s.address.replace('練馬区', '')}　${s.items.slice(0, 4).join('・')}`)),
            el('span', { class: 'row-dist' }, fmtDist(d))))));
    }

    // ---------- 現在地 ----------
    const locBtn = $('locBtn'), compBtn = $('compBtn');
    locBtn.replaceChildren(icon('locate'));
    compBtn.replaceChildren(icon('compass'));

    function banner(msg, action) {
      const b = $('banner');
      if (!msg) { b.hidden = true; return; }
      b.replaceChildren(el('span', {}, msg), action || '');
      b.hidden = false;
    }
    function setFollow(on) {
      st.follow = on;
      clearTimeout(resumeTimer);
      locBtn.setAttribute('aria-pressed', on);
      if (on && st.me && inArea(st.me)) adapter.follow(st.me, st.heading);
    }
    // 指で地図を動かしたら追いかけるのをやめるが、15秒さわらなければまた自分を追いかける
    const RESUME_MS = 15000;
    let resumeTimer;
    function pauseFollow() {
      if (st.follow) { st.follow = false; locBtn.setAttribute('aria-pressed', 'false'); }
      clearTimeout(resumeTimer);
      if (st.watching) resumeTimer = setTimeout(() => { if (st.me && inArea(st.me) && st.sheet == null) setFollow(true); }, RESUME_MS);
    }
    let walkTimer;
    function updateMe(p) {
      // 動いている間だけ自キャラの足踏みをする
      if (st.me && distM(st.me, p) > 1) { meEl.classList.add('walking'); clearTimeout(walkTimer); walkTimer = setTimeout(() => meEl.classList.remove('walking'), 2500); }
      const wasIn = st.me && inArea(st.me);
      st.me = p;
      adapter.setMe(p);
      if (!inArea(p)) {
        const c = adapter.areaCenter();
        banner(`今いる場所は大泉5町の外です（中心まで ${fmtDist(distM(p, c))}）`);
      } else banner('');
      // 大泉5町の外から中に入ってきたら（最初の位置も含む）、追いかけを始める
      if (!wasIn && inArea(p) && !st.follow) setFollow(true);
      else if (st.follow && inArea(p)) adapter.follow(p, st.heading);
      checkNear();
    }
    function startWatch() {
      if (!('geolocation' in navigator)) { banner('この端末では現在地が使えません'); return; }
      if (st.watching) { setFollow(true); return; }
      st.watching = true;
      banner('現在地を探しています…');
      navigator.geolocation.watchPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
          if (st.heading == null && pos.coords.heading != null && !isNaN(pos.coords.heading) && pos.coords.speed > 0.5) setHeading(pos.coords.heading, true);
          updateMe(p);
        },
        (err) => {
          st.watching = false;
          banner(err.code === 1 ? '位置情報の利用が許可されていません。設定でブラウザに位置情報を許可してください' : '現在地を取得できませんでした。屋外で試してください');
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    }
    locBtn.onclick = () => { startWatch(); setFollow(true); };

    // 向き
    let gpsHeading = false;
    function setHeading(h, fromGps) {
      gpsHeading = !!fromGps;
      st.heading = h;
      cone.hidden = h == null;
      cone.style.transform = `rotate(${(h || 0) - adapter.bearing()}deg)`;
      adapter.setHeading(h);
      if (st.follow && st.me && inArea(st.me)) adapter.follow(st.me, h);
    }
    adapter.onRotate?.(() => { if (st.heading != null) cone.style.transform = `rotate(${st.heading - adapter.bearing()}deg)`; });
    let lastH = 0;
    function onOrient(e) {
      let h = null;
      if (e.webkitCompassHeading != null) h = e.webkitCompassHeading;
      else if (e.absolute && e.alpha != null) h = 360 - e.alpha;
      if (h == null) return;
      const now = performance.now();
      if (now - lastH < 100) return;   // 1秒に10回まで
      lastH = now;
      setHeading(Math.round(h), false);
    }
    async function startCompass() {
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          const r = await DeviceOrientationEvent.requestPermission();
          if (r !== 'granted') { banner('向きの利用が許可されませんでした'); return; }
        }
        window.addEventListener('deviceorientationabsolute', onOrient);
        window.addEventListener('deviceorientation', onOrient);
        compBtn.setAttribute('aria-pressed', 'true');
        if (!st.watching) startWatch();
      } catch (e) { banner('この端末では向きが使えません'); }
    }
    function stopCompass() {
      window.removeEventListener('deviceorientationabsolute', onOrient);
      window.removeEventListener('deviceorientation', onOrient);
      compBtn.setAttribute('aria-pressed', 'false');
      setHeading(null);
    }
    compBtn.onclick = () => compBtn.getAttribute('aria-pressed') === 'true' ? stopCompass() : startCompass();

    // 近づくと反応
    function checkNear() {
      const card = $('nearCard');
      if (!st.me || !inArea(st.me)) { st.nearNo = null; card.hidden = true; renderPins(); return; }
      let best = null;
      for (const s of stands) {
        if (!visible(s)) continue;
        const d = distM(st.me, s);
        if (d <= NEAR_M && (!best || d < best.d)) best = { s, d };
      }
      const no = best ? best.s.no : null;
      if (no !== st.nearNo) { st.nearNo = no; renderPins(); if (no && navigator.vibrate) navigator.vibrate(30); }
      if (!best || st.sheet) { card.hidden = true; return; }
      card.replaceChildren(
        el('span', { class: 'row-icon' }, T ? T.icon(best.s) : icon(best.s.kind)),
        el('div', {}, el('div', { class: 'eyebrow' }, T ? T.nearEyebrow(best.s) : 'すぐ近くに販売所'), el('div', { class: 'title' }, best.s.name)),
        el('span', { class: 'near-dist' }, fmtDist(best.d)));
      card.onclick = () => openDetail(best.s.no);
      card.hidden = false;
    }

    // テーマ切り替え
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => adapter.restyle());

    // 許可済みなら最初から現在地を出す
    try {
      const perm = await navigator.permissions?.query({ name: 'geolocation' });
      if (perm && perm.state === 'granted') startWatch();
    } catch (e) {}

    // ---------- このマップについて（はじめて開いたときに1回だけ出す。下の「このマップについて」でいつでも開ける） ----------
    const ABOUT_KEY = 'about-seen-v1';
    function openAbout() {
      try { localStorage.setItem(ABOUT_KEY, '1'); } catch (e) {}
      showSheet('about',
        head(document.title, 'このマップについて'),
        el('p', { class: 'note' }, '大泉学園のまわり（大泉5町）にある、野菜や果物の販売所（無人販売所や農家さんの直売所）をまとめた地図です。散歩のついでに、とれたての野菜に出会うきっかけになればうれしいです。'),
        el('div', { class: 'stack', style: 'gap:4px' },
          el('div', { class: 'sub' }, 'ご利用の前に'),
          el('ul', { class: 'about-list' },
            el('li', {}, '個人の趣味で作っている地図です。行き届かない所や小さな不具合があるかもしれませんが、ご了承ください。'),
            el('li', {}, '販売所の情報は、練馬区「農産物ふれあいガイド」（2025年11月発行）をもとにしています。お休み・品切れ・閉店していることもあります。'),
            el('li', {}, '販売所の多くは農家さんのお宅の前です。敷地に入らない、代金はきちんと払うなど、マナーを守ってご利用ください。'))),
        el('button', { class: 'btn btn-primary', type: 'button', onclick: closeSheet }, '地図を見る'));
    }
    const credit = document.querySelector('.credit');
    if (credit) credit.prepend(el('a', { href: '#', onclick: (e) => { e.preventDefault(); openAbout(); } }, 'このマップについて'), ' ／ ');

    renderPins(); checkNear();
    let seen = false;
    try { seen = localStorage.getItem(ABOUT_KEY) === '1'; } catch (e) {}
    if (!seen) openAbout();
  }

  return { start, css, distM };
})();
