/**
 * オクトーバーフェスト 会場MAP（LINEミニアプリ）データAPI
 * ------------------------------------------------------------
 * スプレッドシートの各シートを JSON で配信する Web アプリ。
 *   venues   : 会場（会場を増やす時はここに1行追加 → active=TRUE）
 *   booths   : ブース（ブルワリー）
 *   menus    : メニュー（後から追加・価格変更OK。visible=FALSEで非表示）
 *   spots    : MAP上のピン（x,y は画像左上からの％）
 *   schedule : 日別スケジュール（ステージ・企画）
 *   days     : 日ごとの「今日の見どころ」
 *   copy     : アプリ内の文言（key/value）
 *   photos   : ブース写真（syncDrivePhotos() がDriveフォルダから自動生成）
 *
 * 使い方
 *   1. setupSheets() を1回実行 → シート作成＆豊洲の初期データ投入
 *   2. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *      実行ユーザー：自分 / アクセス：全員
 *   3. 発行された URL を GitHub 側 config.js の GAS_URL に設定
 *   シート編集後は反映まで最大5分（キャッシュ）。すぐ反映したい時は clearCache() を実行。
 */

const SHEETS = {
  venues:   ['venue_id','name','short_name','start_date','end_date','hours','fee','place','access','map_image','notes','drive_folder_id','active'],
  booths:   ['venue_id','booth_id','no','name_ja','name_en','catch','copy','description','tips','logo_url'],
  menus:    ['venue_id','booth_id','sort','category','name','price','description','image_url','start_date','end_date','visible'],
  spots:    ['venue_id','spot_id','type','label','x','y','booth_id','description','visible'],
  schedule: ['venue_id','date','time','type','title','description','visible'],
  days:     ['venue_id','date','highlight'],
  copy:     ['venue_id','key','value'],
  photos:   ['venue_id','booth_id','file_id','name','url','sort','visible']
};
const CACHE_KEY = 'okf_map_json_v1';
// 初期データ（GitHubリポジトリの data/fallback.json）。setupSheets() で読み込み
const SEED_URL = 'https://kakerushirasawa.github.io/okf-venue-map/data/fallback.json';

function doGet(e) {
  const venue = (e && e.parameter && e.parameter.venue) || '';
  const cache = CacheService.getScriptCache();
  let json = cache.get(CACHE_KEY);
  if (!json) {
    json = JSON.stringify(buildData_());
    try { cache.put(CACHE_KEY, json, 300); } catch (err) { /* 100KB超はキャッシュしない */ }
  }
  let out = json;
  if (venue) {
    const all = JSON.parse(json);
    Object.keys(all).forEach(k => {
      if (Array.isArray(all[k])) all[k] = all[k].filter(r => !r.venue_id || r.venue_id === venue);
    });
    out = JSON.stringify(all);
  }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function buildData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = { updated_at: new Date().toISOString() };
  Object.keys(SHEETS).forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) { data[name] = []; return; }
    const values = sh.getDataRange().getDisplayValues();
    const head = values.shift();
    data[name] = values
      .filter(r => r.some(c => c !== ''))
      .map(r => { const o = {}; head.forEach((h, i) => { if (h) o[h] = r[i]; }); return o; })
      .filter(o => String(o.visible || 'TRUE').toUpperCase() !== 'FALSE');
  });
  data.venues = data.venues.filter(v => String(v.active).toUpperCase() === 'TRUE');
  return data;
}

function clearCache() {
  CacheService.getScriptCache().remove(CACHE_KEY);
}

/** 編集時に自動でキャッシュを消す（インストール不要のシンプルトリガー） */
function onEdit() { clearCache(); }

/** 初回セットアップ：シート作成＋初期データ投入（既存データがあるシートは上書きしない） */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const seed = JSON.parse(UrlFetchApp.fetch(SEED_URL).getContentText());
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() > 1) return;
    const head = SHEETS[name];
    const rows = (seed[name] || []).map(o => head.map(h => (o[h] === undefined ? '' : o[h])));
    sh.clear();
    sh.getRange(1, 1, 1, head.length).setValues([head])
      .setFontWeight('bold').setBackground('#1f4e8c').setFontColor('#ffffff');
    if (rows.length) {
      sh.getRange(2, 1, rows.length, head.length).setNumberFormat('@').setValues(rows);
    }
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, head.length);
  });
  const def = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  clearCache();
}

/**
 * Driveの画像フォルダ → photos シートへ同期
 *   venues.drive_folder_id のフォルダ直下に「ブース名のサブフォルダ」を置き、写真を入れる運用。
 *   例）2026豊洲/カーメリテンさん/xxx.jpg → booth_id=karmeliten
 *   フォルダ名は booths.name_ja / name_en を含んでいればOK（「さん」「・」「スペース」は無視）。
 *   ※LINE上で表示するため、各画像を「リンクを知っている全員が閲覧可」に設定します。
 *   画像を追加したらこの関数を実行（または時間主導トリガーで1時間ごと等に設定）。
 */
function syncDrivePhotos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = buildData_();
  const norm = s => String(s || '').replace(/さん|様|[・\s　\-]/g, '').toLowerCase();
  const rows = [];
  data.venues.forEach(v => {
    if (!v.drive_folder_id) return;
    const booths = data.booths.filter(b => b.venue_id === v.venue_id);
    const subs = DriveApp.getFolderById(v.drive_folder_id).getFolders();
    while (subs.hasNext()) {
      const f = subs.next();
      const fn = norm(f.getName());
      const b = booths.find(b => fn.indexOf(norm(b.name_ja)) >= 0 || norm(b.name_ja).indexOf(fn) >= 0 ||
                                 (b.name_en && fn.indexOf(norm(b.name_en)) >= 0));
      if (!b) { Logger.log('ブース未一致のフォルダ: ' + f.getName()); continue; }
      const files = [];
      const it = f.getFiles();
      while (it.hasNext()) {
        const file = it.next();
        if (!/^image\//.test(file.getMimeType())) continue;
        files.push(file);
      }
      files.sort((a, c) => a.getName().localeCompare(c.getName()));
      files.forEach((file, i) => {
        try {
          if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          }
        } catch (err) { Logger.log('共有設定できませんでした: ' + file.getName() + ' ' + err); }
        const id = file.getId();
        rows.push([v.venue_id, b.booth_id, id, file.getName(),
                   'https://lh3.googleusercontent.com/d/' + id + '=w1000', String(i + 1), 'TRUE']);
      });
    }
  });
  let sh = ss.getSheetByName('photos') || ss.insertSheet('photos');
  const head = SHEETS.photos;
  // 手動で visible=FALSE にした写真は維持
  const hidden = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues()
      .forEach(r => { if (String(r[6]).toUpperCase() === 'FALSE') hidden[r[2]] = true; });
  }
  rows.forEach(r => { if (hidden[r[2]]) r[6] = 'FALSE'; });
  sh.clear();
  sh.getRange(1, 1, 1, head.length).setValues([head])
    .setFontWeight('bold').setBackground('#1f4e8c').setFontColor('#ffffff');
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setNumberFormat('@').setValues(rows);
  sh.setFrozenRows(1);
  clearCache();
  Logger.log(rows.length + '枚を同期しました');
}
