// 道のマルシェMAP 台帳（Googleスプレッドシート）の Apps Script
// - doGet: 地図が読む。「表示」に ✓ がある行の、見せてよい列だけを JSON で返す（自分用メモは出さない）
// - doPost: [発見] ボタンからの登録。鍵（スクリプト プロパティ ADMIN_KEY）が合うときだけ1行足す
// 置き方: スプレッドシートの「拡張機能 > Apps Script」にこのファイルの中身を貼る。手順は CLAUDE.md の「台帳」

const SHEET = '販売所';
const COL = { id: 0, show: 1, name: 2, address: 3, lat: 4, lng: 5, kind: 6, items: 7, harvest: 8, note: 9, status: 10, source: 11, date: 12, memo: 13 };
const FIRST_NEW_ID = 2001;   // 自分で登録した所の番号はここから

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
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!(lat > 35.6 && lat < 35.9 && lng > 139.4 && lng < 139.8)) return json({ ok: false, error: 'bad position' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET);
    const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues().map(r => Number(r[0]) || 0);
    const id = Math.max(FIRST_NEW_ID - 1, ...ids) + 1;
    // 「表示」のチェックボックスが下の空き行まで入っているので appendRow だと 1000 行目より下に行く。ID が空の最初の行に書く
    let row = ids.findIndex(v => v === 0) + 2;
    if (row < 2) row = sheet.getLastRow() + 1;
    const town = townName(lat, lng);
    const kind = ['無人', 'お店の人がいる'].includes(body.kind) ? body.kind : '無人';
    const items = Array.isArray(body.items) ? body.items.map(String).slice(0, 10).join('・') : '';
    const name = String(body.name || '').slice(0, 40) || `${kind === '無人' ? '無人販売所' : '直売所'}（${town.chome || '場所不明'}）`;
    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    sheet.getRange(row, 1, 1, 14).setValues([[id, true, name, town.address, lat, lng, kind, items, '', String(body.note || '').slice(0, 200), '確認済み', '自分で登録', today, '']]);
    return json({ ok: true, id, name, address: town.address });
  } finally {
    lock.releaseLock();
  }
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
