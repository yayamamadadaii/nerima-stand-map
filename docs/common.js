// A/B 共通: データ読み込み、画面（見出し・シート・一覧）、現在地、近づくと反応。
// 地図ライブラリごとの違いは adapter に閉じ込める（今は map.js = MapLibre GL）。
window.StandApp = (() => {
  const NEAR_M = 60;          // この距離まで近づいたら「すぐ近く」を出す
  // 何を地図に出すか（2026-10-27 だいき: いったん無人販売所に絞る。データは消さずに残し、ここを true にすれば戻る）
  const SHOW = { manned: false, harvest: false };   // manned = お店の人がいる直売所、harvest = 収穫体験の農園と情報
  // 「情報の修正・掲載の取り下げ」の連絡先（Googleフォーム。だいきが作る、2026-10-26 決定）。空のあいだはリンクを出さない
  const FORM_URL = '';        // 例: https://docs.google.com/forms/d/e/xxxx/viewform
  const FORM_ENTRY = '';      // 「対象の販売所・農園」欄の entry 番号（例: entry.123456）。あれば詳細から開いたときに名前を入れておく
  // 台帳（Googleスプレッドシート + Apps Script。2026-10-27〜）。「表示」に ✓ がある行だけが返ってくる
  const LEDGER_URL = 'https://script.google.com/macros/s/AKfycbzsscGOcvXEoDfv-dSt3CbnIboj226KaF5R_86K3gghaqlrJGb4NHzPeUEfWiG4FvRw/exec';
  const LEDGER_CACHE = 'ledger-v1';      // 前に受け取った台帳。開いたときにすぐ出し、裏で新しい分を受け取って差し替える
  const ADMIN_KEY = 'admin-key';         // [発見] で登録するための鍵。専用リンク（#key=...）を開くと、その端末に覚える
  const RANGE_M = 50;         // [発見] で登録できるのは自分の位置からこの距離まで（2026-10-29 だいき。台帳側でも確かめる）
  const DUP_M = 30;           // 登録しようとした場所のこの距離内に販売所があれば「同じ所では？」と知らせる
  const UNDO_MIN = 10;        // 登録してからこの分数までは、登録した端末から取り消せる
  const MY_ADDS = 'my-adds';  // この端末で登録した所（[{id, at}]）。取り消しの時間を数える
  const SEASON = { 'ブルーベリー': '6月下旬〜9月', 'ミカン': '冬（日にちは農園に確認）', 'カキ': '10月中旬〜11月ごろ', '野菜': '日程は「とれたてねりま」で案内' };
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  // 台帳の1行を、地図で使う形にする
  const fromLedger = (r) => ({
    no: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng, note: r.note, source: r.source,
    items: r.items ? r.items.split('・') : [], unmanned: r.kind === '無人', sale: r.kind !== '収穫体験だけ',
    harvest: r.harvest ? r.harvest.split(';').map(w => ({ what: w.replace(/\*$/, ''), reserve: w.endsWith('*'), season: Object.entries(SEASON).find(([k]) => w.includes(k))?.[1] || '' })) : undefined
  });
  async function fetchLedger(timeout) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
    try {
      const text = await (await fetch(LEDGER_URL, { signal: ctl.signal })).text();
      return JSON.parse(text).ok ? text : null;
    } catch (e) { return null; } finally { clearTimeout(t); }
  }
  const formUrl = (s) => FORM_URL + (s && FORM_ENTRY ? `?usp=pp_url&${FORM_ENTRY}=${encodeURIComponent(s.name + '（' + s.address + '）')}` : '');
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
    pinPlus: '<path d="M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738"/><circle cx="12" cy="10" r="3"/><path d="M16 18h6"/><path d="M19 15v6"/>',
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
    if (!s.items.length) return 'veg';
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
    // 専用リンク（#key=...）で開いたら、登録の鍵をこの端末に覚えて、アドレス欄からは消す
    if (location.hash.startsWith('#key=')) { store.set(ADMIN_KEY, decodeURIComponent(location.hash.slice(5))); history.replaceState(null, '', location.pathname + location.search); }
    const adminKey = store.get(ADMIN_KEY);
    // 販売所: 台帳（前に受け取った分）→ なければ台帳をその場で受け取る → それもだめなら地図データに入っている分
    // cat: sale = 販売所、harvest = 収穫体験だけ、both = 販売所で収穫体験もできる（2026-10-26）
    const prepare = (list) => list
      .map(s => SHOW.harvest ? s : { ...s, harvest: undefined })
      .map(s => ({ ...s, kind: kind(s), cat: s.sale === false ? 'harvest' : s.harvest ? 'both' : 'sale' }));
    const fallback = () => D.stands.filter(s => (s.sale !== false || SHOW.harvest) && (s.sale === false || s.unmanned || SHOW.manned));
    let ledgerText = store.get(LEDGER_CACHE);
    const usedCache = !!ledgerText;
    if (!ledgerText) { ledgerText = await fetchLedger(4000); if (ledgerText) store.set(LEDGER_CACHE, ledgerText); }
    let stands = prepare(ledgerText ? JSON.parse(ledgerText).stands.map(fromLedger) : fallback());
    const inArea = (p) => towns.some(t => pointInRing(p, t.rings[0]));

    const st = {
      selected: null, sheet: null,
      me: null,            // {lat, lng, acc}
      heading: null,       // 度。北=0
      follow: false, watching: false, nearNo: null,
      placing: false       // [発見] で場所を合わせている間
    };
    // 無人販売所と直売所は分けずに「販売所」として全部同じピンで出す。無人か有人かは詳細で分かる（2026-10-26 だいき）
    const visible = () => true;

    // ピン
    const pins = new Map();
    function buildPins() {
      pins.clear();
      for (const s of stands) {
        const p = el('div', { class: 'pin', role: 'button', 'aria-label': s.name }, T ? T.pin(s) : icon(s.kind));
        p.addEventListener('click', (e) => { e.stopPropagation(); openDetail(s.no); });
        pins.set(s.no, p);
      }
    }
    buildPins();
    // 台帳が新しくなったら、ピンを作り直す
    function setStands(list) {
      stands = prepare(list);
      buildPins();
      adapter.setPins(stands, pins);
      renderPins(); checkNear();
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

    // 広く見ているときの色の見方（ファミコン風のときだけ。球の色はピンと同じ）
    if (T && SHOW.harvest) document.querySelector('.map-wrap')?.append(el('div', { class: 'legend', 'aria-hidden': 'true' },
      [['sale', '販売所'], ['harvest', '収穫体験'], ['both', '販売所＋収穫体験']].map(([c, t]) => {
        const sp = el('span');
        sp.innerHTML = T.ball(c);
        sp.append(t);
        return sp;
      })));

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
      const inGuide = s.sale !== false && s.no < 1000;   // 区のガイド（販売所）に載っている所（番号はガイドの番号）
      const own = s.source === '自分で登録';
      showSheet('detail',
        head(s.name, s.address),
        el('div', { class: 'meta-line' },
          s.sale !== false ? el('span', { class: s.unmanned ? 'tag' : 'tag tag-manned' }, s.unmanned ? '無人' : 'お店の人がいる') : null,
          s.harvest ? el('span', { class: 'tag tag-harvest' }, '収穫体験') : null,
          d != null ? el('span', { class: 'near-dist' }, `ここから ${fmtDist(d)}`) : null,
          inGuide ? el('span', { class: 'sub' }, `区のガイド No.${s.no}`) : null),
        s.note ? el('p', { class: 'note' }, s.note) : null,
        s.harvest ? el('div', { class: 'stack', style: 'gap:4px' },
          el('div', { class: 'sub' }, 'できる収穫体験'),
          el('ul', { class: 'about-list' }, s.harvest.map(h => el('li', {}, `${h.what}（${h.season}${h.reserve ? '・予約が必要' : ''}）`)))) : null,
        s.items.length ? el('div', { class: 'stack', style: 'gap:4px' },
          el('div', { class: 'sub' }, '主な品目（時期によって変わります）'),
          el('div', { class: 'tags' }, s.items.map(i => el('span', { class: 'tag tag-plain' }, i)))) : null,
        el('a', { class: 'btn btn-primary', href: routeUrl(s), target: '_blank', rel: 'noopener' }, icon('nav'), T ? T.routeLabel : 'Googleマップで経路を見る'),
        el('div', { class: 'sub' }, [
          inGuide ? '販売所の情報は2025年11月発行の区のガイドより。開いていないこともあります。' : own ? '歩いて見つけて登録した販売所です。開いていないこともあります。' : '',
          s.harvest ? '収穫体験は区の「練馬果樹あるファーム」「ねりまベジかるファーム」（2026年）より。開く日や時間は年によって変わるので、行く前に農園に確かめてください。' : ''].join('')),
        FORM_URL ? el('a', { class: 'sub', href: formUrl(s), target: '_blank', rel: 'noopener' }, '情報のちがい・掲載の取り下げを知らせる') : null,
        adminKey ? adminTools(s) : null);
    }
    function openList() {
      const from = st.me && inArea(st.me) ? st.me : adapter.center();
      const rows = stands.filter(visible).map(s => ({ s, d: distM(from, s) })).sort((a, b) => a.d - b.d);
      showSheet('list',
        head(`${rows.length} か所`, st.me && inArea(st.me) ? '今いる場所から近い順' : '地図の中心から近い順'),
        el('div', { class: 'list' }, rows.map(({ s, d }) =>
          el('button', { class: 'row', type: 'button', onclick: () => { pauseFollow(); adapter.flyTo(s); openDetail(s.no); } },
            el('span', { class: 'row-icon' }, T ? T.icon(s) : icon(s.kind)),
            el('span', { class: 'row-main' },
              el('div', { class: 'row-title' }, s.name),
              el('div', { class: 'row-sub' }, `${s.address.replace('練馬区', '')}　${s.items.length ? s.items.slice(0, 4).join('・') : s.harvest.map(h => h.what).join('・')}`)),
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
      if (st.watching) resumeTimer = setTimeout(() => { if (st.me && inArea(st.me) && st.sheet == null && !st.placing) setFollow(true); }, RESUME_MS);
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
      onMe();
    }
    let onMe = () => {};   // [発見] で場所を合わせている間、自分が動いたら範囲の円を動かす
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
        el('div', {}, el('div', { class: 'eyebrow' }, T ? T.nearEyebrow(best.s) : best.s.cat === 'harvest' ? 'すぐ近くに収穫体験の農園' : 'すぐ近くに販売所'), el('div', { class: 'title' }, best.s.name)),
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
        el('p', { class: 'note' }, (SHOW.manned || SHOW.harvest
          ? '大泉学園のまわり（大泉5町）にある、野菜や果物の販売所（無人販売所や農家さんの直売所）' + (SHOW.harvest ? 'と、収穫体験ができる農園' : '') + 'をまとめた地図です。'
          : '大泉学園のまわり（大泉5町）にある、野菜や果物の無人販売所をまとめた地図です。') + '散歩のついでに、とれたての野菜に出会うきっかけになればうれしいです。'),
        el('div', { class: 'stack', style: 'gap:4px' },
          el('div', { class: 'sub' }, 'ご利用の前に'),
          el('ul', { class: 'about-list' },
            el('li', {}, '個人の趣味で作っている地図です。行き届かない所や小さな不具合があるかもしれませんが、ご了承ください。'),
            el('li', {}, '販売所の情報は、練馬区「農産物ふれあいガイド」（2025年11月発行）をもとにしています。お休み・品切れ・閉店していることもあります。'),
            el('li', {}, '販売所の多くは農家さんのお宅の前です。敷地に入らない、代金はきちんと払うなど、マナーを守ってご利用ください。'))),
        FORM_URL ? el('p', { class: 'note sub' }, '掲載内容のまちがいや、掲載をやめてほしいときは ', el('a', { href: formUrl(), target: '_blank', rel: 'noopener' }, 'こちらのフォーム'), ' からお知らせください。') : null,
        el('button', { class: 'btn btn-primary', type: 'button', onclick: closeSheet }, '地図を見る'));
    }
    const credit = document.querySelector('.credit');
    if (credit) credit.prepend(el('a', { href: '#', onclick: (e) => { e.preventDefault(); openAbout(); } }, 'このマップについて'), ' ／ ');

    renderPins(); checkNear();
    // 前に受け取った台帳で出したときは、裏で新しい分を受け取り、変わっていたら差し替える
    if (usedCache) fetchLedger(15000).then(text => {
      if (!text || text === store.get(LEDGER_CACHE)) return;
      store.set(LEDGER_CACHE, text);
      setStands(JSON.parse(text).stands.map(fromLedger));
    });

    // ---------- [発見]: 見つけた販売所を台帳に登録する（鍵がある端末だけ。2026-10-27、2026-10-29 直し） ----------
    async function post(body) {
      const res = await (await fetch(LEDGER_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ key: adminKey, ...body }) })).json();
      if (!res.ok) throw new Error(res.error);
      return res;
    }
    const errText = (e) => ({
      forbidden: '登録の鍵が合いません。専用リンクを開き直してください。',
      'too far': `ピンが自分の位置から ${RANGE_M} m より遠いので登録できません。`,
      expired: `取り消せる時間（${UNDO_MIN}分）を過ぎました。台帳で「表示」の ✓ を外してください。`,
      'not found': '台帳にこの販売所が見つかりませんでした。'
    })[e.message] || '送れませんでした。電波のよい所でもう一度試してください。';
    const refreshCache = () => fetchLedger(15000).then(text => { if (text) store.set(LEDGER_CACHE, text); });
    // この端末で登録した所。取り消せる時間を過ぎたものは忘れる
    const myAdds = () => { try { return JSON.parse(store.get(MY_ADDS) || '[]').filter(a => Date.now() - a.at < UNDO_MIN * 60000); } catch (e) { return []; } };

    // 詳細の下に出す、鍵がある端末だけの操作: 登録の取り消し（10分以内）、なくなっていた
    function adminTools(s) {
      const msg = el('div', { class: 'sub' });
      const drop = () => { setStands(stands.filter(x => x.no !== s.no)); closeSheet(); refreshCache(); };
      // 間違えて押さないよう、1回目は確認の文言に変わり、2回目で送る
      const twoStep = (label, again, run) => {
        const b = el('button', { class: 'btn btn-secondary', type: 'button' }, label);
        let armed = false;
        b.onclick = async () => {
          if (!armed) { armed = true; b.textContent = again; return; }
          b.disabled = true; msg.textContent = '送っています…';
          try { await run(); } catch (e) { b.disabled = false; armed = false; b.textContent = label; msg.textContent = errText(e); }
        };
        return b;
      };
      const mine = myAdds().find(a => a.id === s.no);
      const left = mine ? Math.ceil((UNDO_MIN * 60000 - (Date.now() - mine.at)) / 60000) : 0;
      return el('div', { class: 'stack admin-tools', style: 'gap:8px' },
        el('div', { class: 'sub' }, '管理用（鍵のある端末だけに出ます）'),
        left > 0 ? twoStep(`登録を取り消す（あと${left}分）`, 'もう一度押すと取り消します', async () => {
          await post({ action: 'cancel', id: s.no });
          store.set(MY_ADDS, JSON.stringify(myAdds().filter(a => a.id !== s.no)));
          drop();
        }) : null,
        twoStep('なくなっていた（地図から外す）', 'もう一度押すと地図から外します', async () => { await post({ action: 'gone', id: s.no }); drop(); }),
        msg);
    }

    if (adminKey) {
      const wrap = document.querySelector('.map-wrap');
      // 右下のボタンの列のいちばん上に置く
      const btn = el('button', { class: 'btn btn-secondary btn-round', type: 'button', 'aria-label': '見つけた販売所を登録' }, icon('pinPlus'));
      $('locBtn').parentElement.prepend(btn);
      // 場所合わせのピン: 要素の左上が地図の真ん中で、そこが登録する場所
      const aim = el('div', { class: 'discover-aim', hidden: true, 'aria-hidden': 'true' }, T ? T.aim() : el('span', { class: 'aim-dot' }));
      const status = el('div', { class: 'sub discover-status' });
      const decide = el('button', { class: 'btn btn-primary', type: 'button' }, 'ここで決定');
      const bar = el('div', { class: 'discover-bar', hidden: true },
        el('div', {}, '地図にない販売所を登録できます。地図を動かして、ピンの先を販売所に合わせてください。'),
        status,
        el('div', { class: 'discover-actions' },
          el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => endPlace() }, 'やめる'),
          decide));
      wrap.append(aim, bar);
      // 自分から RANGE_M 以内のときだけ「ここで決定」を押せる
      function updatePlace() {
        if (!st.placing) return;
        adapter.setRange(st.me, RANGE_M);
        if (!st.me) { decide.disabled = true; status.textContent = '現在地を探しています…（現在地が分かると登録できます）'; return; }
        const d = distM(st.me, adapter.center());
        decide.disabled = d > RANGE_M;
        status.textContent = d <= RANGE_M ? `自分から ${Math.round(d)} m（円の中なら登録できます）`
          : `ピンが自分から ${fmtDist(d)} 離れています。販売所の ${RANGE_M} m 以内まで近づいてください`;
      }
      adapter.onMove(updatePlace);
      onMe = updatePlace;
      const endPlace = () => { st.placing = false; adapter.setRange(null); aim.hidden = bar.hidden = true; btn.hidden = false; };
      btn.onclick = () => {
        closeSheet(); pauseFollow();
        if (!st.watching) startWatch();
        if (st.me) adapter.flyTo(st.me);
        st.placing = true; aim.hidden = bar.hidden = false; btn.hidden = true;
        updatePlace();
      };
      decide.onclick = () => { const c = adapter.center(), me = st.me; endPlace(); openForm(c, me); };

      function openForm(pos, me) {
        const pick = { kind: '無人', items: new Set() };
        // すぐ近くに地図の販売所があれば、同じ所ではないか知らせる（そのまま登録もできる）
        const dup = stands.map(s => ({ s, d: distM(pos, s) })).filter(x => x.d <= DUP_M).sort((a, b) => a.d - b.d)[0];
        const seg = el('div', { class: 'seg' }, ['無人', 'お店の人がいる'].map(k => el('button', { type: 'button', 'aria-pressed': k === pick.kind, onclick: (e) => {
          pick.kind = k; seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget));
        } }, k)));
        const chips = el('div', { class: 'tags' }, ['野菜', '果物', '花・苗', '卵', 'その他'].map(k => el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: (e) => {
          pick.items.has(k) ? pick.items.delete(k) : pick.items.add(k);
          e.currentTarget.setAttribute('aria-pressed', pick.items.has(k));
        } }, k)));
        const name = el('input', { class: 'input', type: 'text', maxlength: '40', placeholder: '空なら「無人販売所（町名）」' });
        const msg = el('div', { class: 'sub' });
        const send = el('button', { class: 'btn btn-primary', type: 'button' }, '登録する');
        send.onclick = async () => {
          send.disabled = true; msg.textContent = '登録しています…';
          try {
            const res = await post({ lat: pos.lat, lng: pos.lng, me: { lat: me.lat, lng: me.lng }, kind: pick.kind, items: [...pick.items], name: name.value.trim() });
            store.set(MY_ADDS, JSON.stringify([...myAdds(), { id: res.id, at: Date.now() }]));
            const s = { no: res.id, name: res.name, address: res.address, lat: pos.lat, lng: pos.lng, note: '', source: '自分で登録',
              items: [...pick.items], unmanned: pick.kind === '無人', sale: true };
            setStands([...stands, s]);
            openDetail(s.no);
            refreshCache();
          } catch (e) { send.disabled = false; msg.textContent = errText(e); }
        };
        showSheet('discover',
          head('見つけた販売所を登録', 'ピンの場所で登録します'),
          dup ? el('div', { class: 'notice' },
            el('div', {}, `${dup.d < 5 ? 'この場所に' : `約 ${Math.round(dup.d)} m のところに`}「${dup.s.name}」があります。同じ所なら登録しなくて大丈夫です。`),
            el('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: () => { adapter.flyTo(dup.s); openDetail(dup.s.no); } }, 'その販売所を見る')) : null,
          el('div', { class: 'stack', style: 'gap:4px' }, el('div', { class: 'sub' }, '種類'), seg),
          el('div', { class: 'stack', style: 'gap:4px' }, el('div', { class: 'sub' }, '売っているもの（いくつでも。選ばなくてもよい）'), chips),
          el('div', { class: 'stack', style: 'gap:4px' }, el('div', { class: 'sub' }, '名前（なくてもよい）'), name),
          send, msg);
      }
    }

    let seen = false;
    try { seen = localStorage.getItem(ABOUT_KEY) === '1'; } catch (e) {}
    if (!seen) openAbout();
  }

  return { start, css, distM };
})();
