/***** 編集モード実験：GAS受け口 *****
  役割：ページの内容（文字・色・画像）をスプレッドシートに保存し、読み出す。
  置き場所：実験用のスプレッドシートに紐づく Apps Script。
  手順：
    1. 実験用スプレッドシートを作り、そのIDを CONFIG.SPREADSHEET_ID に貼る
       （シートに紐づけたプロジェクトなら ID は空でも動く）
    2. CONFIG.PASSCODE を合言葉に合わせる（実験用は jikken）
    3. setupContentSheet() を1回実行する（シート「コンテンツ」に初期値が入る）
    4. ウェブアプリとしてデプロイ（実行ユーザー＝自分／アクセス＝全員）
    5. 発行されたURLを、ページ側 content.js の GAS_URL に貼る
**************************************/
const CONFIG = {
  SPREADSHEET_ID: '', // 実験用シートのID（紐づけプロジェクトなら空でよい）
  PASSCODE: 'jikken',
  SHEET_NAME: 'コンテンツ',
  IMAGE_FOLDER_NAME: '工房サイト画像（実験）' // 画像の置き場（ドライブ内に自動作成）
};

const DEFAULT_CONTENT_GAS = {
  texts: {
    shopName: '実験ベーカリー まるみ',
    heroTitle: '実験ページです',
    heroSub: 'これは編集モードの実験用ダミー文章です。実在のお店ではありません。',
    noticeTitle: 'お知らせ（ダミー）',
    noticeText: '今週の焼き上がり時間は10時と15時です、という形のダミー文章です。',
    menu1Name: 'ダミー食パン', menu1Price: '¥300',
    menu2Name: 'ダミークロワッサン', menu2Price: '¥250',
    menu3Name: 'ダミーあんパン', menu3Price: '¥200',
    aboutTitle: '店主から（ダミー）',
    aboutText: '実験用に用意した文章です。文字の書き換え、色の変更、画像の差し替えが保存されるかを確かめます。',
    footerText: '実験ベーカリー まるみ（架空のお店）'
  },
  colors: { main: '#a44a2a', accent: '#31594f' },
  images: { hero: 'preset1', about: 'preset2' }
};

function spreadsheet_() {
  if (CONFIG.SPREADSHEET_ID) return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}
function sheet_() {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(CONFIG.SHEET_NAME); sh.appendRow(['key', 'value']); }
  return sh;
}

/* 初期化：シートに初期値を書き込む（既にある行は上書きしない） */
function setupContentSheet() {
  const sh = sheet_();
  const existing = {};
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) existing[values[i][0]] = true;
  const flat = flatten_(DEFAULT_CONTENT_GAS);
  Object.keys(flat).forEach(k => {
    if (!existing[k]) sh.appendRow([k, JSON.stringify(flat[k])]);
  });
}

function flatten_(content) {
  const out = {};
  Object.keys(content.texts || {}).forEach(k => out['texts.' + k] = content.texts[k]);
  Object.keys(content.colors || {}).forEach(k => out['colors.' + k] = content.colors[k]);
  Object.keys(content.images || {}).forEach(k => out['images.' + k] = content.images[k]);
  Object.keys(content.align || {}).forEach(k => out['align.' + k] = content.align[k]);
  return out;
}
function unflatten_(flat) {
  const content = { texts: {}, colors: {}, images: {}, align: {} };
  Object.keys(flat).forEach(k => {
    const dot = k.indexOf('.');
    if (dot < 0) return;
    const group = k.slice(0, dot), key = k.slice(dot + 1);
    if (content[group]) content[group][key] = flat[k];
  });
  return content;
}
function readContent_() {
  const sh = sheet_();
  const values = sh.getDataRange().getValues();
  const flat = {};
  for (let i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    try { flat[values[i][0]] = JSON.parse(values[i][1]); }
    catch (e) { flat[values[i][0]] = values[i][1]; }
  }
  return unflatten_(flat);
}
function writeContent_(content) {
  const sh = sheet_();
  const flat = flatten_(content);
  const values = sh.getDataRange().getValues();
  const rowOf = {};
  for (let i = 1; i < values.length; i++) rowOf[values[i][0]] = i + 1;
  Object.keys(flat).forEach(k => {
    if (rowOf[k]) sh.getRange(rowOf[k], 2).setValue(JSON.stringify(flat[k]));
    else sh.appendRow([k, JSON.stringify(flat[k])]);
  });
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return jsonOut_({ ok: true, content: readContent_() });
}

/* 画像アップロード：実物はドライブに置き、表示用の住所（URL）だけを返す。
   シートにはこのURL（数十文字）だけが入るので、セルの文字数上限に触れない。 */
function imageFolder_() {
  const it = DriveApp.getFoldersByName(CONFIG.IMAGE_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(CONFIG.IMAGE_FOLDER_NAME);
}
function uploadImage_(dataUri) {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUri || '');
  if (!m) return { ok: false, error: 'not an image data uri' };
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1],
    'kobo-img-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss') + '.jpg');
  const file = imageFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const id = file.getId();
  return { ok: true, fileId: id, url: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600' };
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {
    return jsonOut_({ ok: false, error: 'bad json' });
  }
  if (body.passcode !== CONFIG.PASSCODE) {
    return jsonOut_({ ok: false, error: 'passcode mismatch' });
  }
  if (body.action === 'uploadImage') return jsonOut_(uploadImage_(body.data));
  if (!body.content) return jsonOut_({ ok: false, error: 'no content' });
  writeContent_(body.content);
  return jsonOut_({ ok: true });
}
