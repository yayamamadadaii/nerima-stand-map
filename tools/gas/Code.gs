// 道のマルシェMAP 台帳（Googleスプレッドシート）の Apps Script
// - doGet: 地図が読む。「表示」に ✓ がある行の、見せてよい列だけを JSON で返す（自分用メモは出さない）
// - doPost: [発見] ボタンからの登録・取り消し・「なくなっていた」。鍵（スクリプト プロパティ ADMIN_KEY）が合うときだけ
// 置き方: スプレッドシートの「拡張機能 > Apps Script」にこのファイルの中身を貼る。手順は CLAUDE.md の「台帳」

const SHEET = '販売所';
const COL = { id: 0, show: 1, name: 2, address: 3, lat: 4, lng: 5, kind: 6, items: 7, harvest: 8, note: 9, status: 10, source: 11, date: 12, memo: 13 };
const FIRST_NEW_ID = 2001;   // 自分で登録した所の番号はここから
const RANGE_M = 50;          // 登録できるのは自分の位置からこの距離まで（2026-10-29 だいき）
const UNDO_MIN = 10;         // 登録してからこの分数までは取り消せる（2026-10-29 だいき）

function doGet() {
  const rows = SpreadsheetApp.getActive().getSheetByName(SHEET).getDataRange().getValues().slice(1);
  const stands = rows
    .filter(r => r[COL.show] === true && r[COL.lat] !== '' && r[COL.lng] !== '')
    .map(r => ({
      id: Number(r[COL.id]), name: String(r[COL.name]), address: String(r[COL.address]),
      lat: Number(r[COL.lat]), lng: Number(r[COL.lng]), kind: String(r[COL.kind]),
      items: String(r[COL.items]), harvest: String(r[COL.harvest]), note: String(r[COL.note]),
      status: String(r[COL.status]), source: String(r[COL.source])
    }));
  return json({ ok: true, updated: new Date().toISOString(), stands });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad json' }); }
  const key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!key || body.key !== key) return json({ ok: false, error: 'forbidden' });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET);
    const action = body.action || 'add';
    if (action === 'add') return json(addStand(sheet, body));
    if (action === 'cancel' || action === 'gone') return json(hideStand(sheet, Number(body.id), action));
    return json({ ok: false, error: 'bad action' });
  } finally {
    lock.releaseLock();
  }
}

// [発見] からの登録。自分の位置から RANGE_M 以内の所だけ（GPS のずれを見て少し余裕を持たせる）
function addStand(sheet, body) {
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!(lat > 35.6 && lat < 35.9 && lng > 139.4 && lng < 139.8)) return { ok: false, error: 'bad position' };
  const me = body.me || {};
  if (!(distM(lat, lng, Number(me.lat), Number(me.lng)) <= RANGE_M + 20)) return { ok: false, error: 'too far' };
  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues().map(r => Number(r[0]) || 0);
  const id = Math.max(FIRST_NEW_ID - 1, ...ids) + 1;
  // 「表示」のチェックボックスが下の空き行まで入っているので appendRow だと 1000 行目より下に行く。ID が空の最初の行に書く
  let row = ids.findIndex(v => v === 0) + 2;
  if (row < 2) row = sheet.getLastRow() + 1;
  const town = townName(lat, lng);
  const kind = ['無人', 'お店の人がいる'].includes(body.kind) ? body.kind : '無人';
  const items = Array.isArray(body.items) ? body.items.map(String).slice(0, 10).join('・') : '';
  const name = String(body.name || '').slice(0, 40) || `${kind === '無人' ? '無人販売所' : '直売所'}（${town.chome || '場所不明'}）`;
  sheet.getRange(row, 1, 1, 14).setValues([[id, true, name, town.address, lat, lng, kind, items, '', String(body.note || '').slice(0, 200), '確認済み', '自分で登録', new Date(), '']]);
  sheet.getRange(row, COL.date + 1).setNumberFormat('yyyy-mm-dd hh:mm');   // 取り消せる時間を判断するので時刻まで残す
  return { ok: true, id, name, address: town.address };
}

// 地図から外す。行は消さずに「表示」の ✓ を外し、状態を変える（あとで戻せるように）
//   cancel = 登録してから UNDO_MIN 分以内の取り消し（自分で登録した所だけ）、gone = 行ってみたらなくなっていた
function hideStand(sheet, id, action) {
  const rows = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 14).getValues();
  const i = rows.findIndex(r => Number(r[COL.id]) === id);
  if (i < 0) return { ok: false, error: 'not found' };
  const r = rows[i], row = i + 2;
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  if (action === 'cancel') {
    const at = r[COL.date];
    if (r[COL.source] !== '自分で登録' || !(at instanceof Date) || Date.now() - at.getTime() > (UNDO_MIN + 1) * 60000) return { ok: false, error: 'expired' };
    sheet.getRange(row, COL.status + 1).setValue('取り消し');
  } else {
    sheet.getRange(row, COL.status + 1).setValue('なくなった');
    sheet.getRange(row, COL.memo + 1).setValue([r[COL.memo], `${today} 行ってみたらなくなっていた`].filter(String).join(' / '));
  }
  sheet.getRange(row, COL.show + 1).setValue(false);
  return { ok: true, id };
}

function distM(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
}

// 国土地理院の逆ジオコーダーで、緯度経度から町丁目を出す（例: 大泉学園町三丁目）
function townName(lat, lng) {
  try {
    const res = UrlFetchApp.fetch(`https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`, { muteHttpExceptions: true });
    const r = JSON.parse(res.getContentText()).results;
    if (r && r.lv01Nm) return { chome: r.lv01Nm, address: '練馬区' + r.lv01Nm };
  } catch (err) {}
  return { chome: '', address: '' };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
