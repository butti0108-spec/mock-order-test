/* 編集モード実験：共通の内容ストア
   GAS_URL が空の間は、このブラウザの localStorage に保存する実験モード。
   GASをデプロイしたら、下の GAS_URL にウェブアプリのURLを貼ると、
   読み込み・保存がスプレッドシート側に切り替わる。 */
const GAS_URL = '';
const EXPERIMENT_PASSCODE = 'jikken';
const LS_KEY = 'editmode-experiment-content-v1';

const DEFAULT_CONTENT = {
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
  images: { hero: 'preset1', about: 'preset2' },
  align: {},
  sections: []
};

/* 追加セクションの「型」。形は用意した型だけ、文章と写真は自由に直せる。
   新しい型を増やす時はここに1つ足す。 */
const SECTION_TYPES = {
  notice: { label: 'お知らせ型（見出し＋文章）', title: '新しいお知らせ', body: 'ここにお知らせの文章が入ります。' },
  photo:  { label: '写真と文章型', title: '新しい見出し', body: 'ここに文章が入ります。', img: 'preset3' },
  text:   { label: '文章だけ型', body: 'ここに文章が入ります。' },
  contact:{ label: '住所・連絡先型', title: 'アクセス・連絡先', body: '住所：横浜市〇〇区〇〇 1-2-3\n電話：000-0000-0000' },
  photos: { label: '写真複数枚型（最大3枚）', title: '新しい見出し', body: 'ここに文章が入ります。', img: 'preset3' }
};

const TEXT_LABELS = {
  shopName: '店名', heroTitle: '見出し', heroSub: '見出しの下の文章',
  noticeTitle: 'お知らせの見出し', noticeText: 'お知らせの本文',
  menu1Name: 'メニュー1の名前', menu1Price: 'メニュー1の値段',
  menu2Name: 'メニュー2の名前', menu2Price: 'メニュー2の値段',
  menu3Name: 'メニュー3の名前', menu3Price: 'メニュー3の値段',
  aboutTitle: '店主からの見出し', aboutText: '店主からの本文',
  footerText: 'フッターの文字'
};

function svgPreset(n, label, c1, c2) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>` +
    `<rect width='800' height='500' fill='url(#g)'/>` +
    `<text x='400' y='245' font-size='56' fill='#ffffff' text-anchor='middle' font-family='sans-serif'>${label}</text>` +
    `<text x='400' y='305' font-size='28' fill='#ffffff' text-anchor='middle' font-family='sans-serif'>ダミー画像 ${n}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const PRESET_IMAGES = {
  preset1: () => svgPreset(1, '焼きたてパン', '#c97b4a', '#8a4b21'),
  preset2: () => svgPreset(2, 'お店の様子', '#5b7f95', '#31594f'),
  preset3: () => svgPreset(3, '季節のおすすめ', '#b3543f', '#7e4a5e')
};
function imageSrc(value) {
  if (!value) return PRESET_IMAGES.preset1();
  if (PRESET_IMAGES[value]) return PRESET_IMAGES[value]();
  return value; /* URL or data URI */
}

function mergeDefaults(c) {
  const out = JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  if (c && typeof c === 'object') {
    /* 既定のキーも、追加セクション等の動的キーも、保存側にあるものは全部引き継ぐ */
    if (c.texts) for (const k of Object.keys(c.texts)) if (c.texts[k] != null) out.texts[k] = c.texts[k];
    if (c.colors) for (const k of Object.keys(c.colors)) if (c.colors[k] != null) out.colors[k] = c.colors[k];
    if (c.images) for (const k of Object.keys(c.images)) if (c.images[k] != null) out.images[k] = c.images[k];
    if (c.align) for (const k of Object.keys(c.align)) if (['left','center','right'].includes(c.align[k])) out.align[k] = c.align[k];
    if (Array.isArray(c.sections)) {
      out.sections = c.sections.filter(x => x && typeof x.id === 'string' && SECTION_TYPES[x.type])
        .map(x => ({ id: x.id, type: x.type }));
    }
  }
  return out;
}

/* ファイルを選ぶと、最大1200pxに縮小してJPEGのdata URIにする（保存先の容量節約） */
function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* 画像の保存先を決める。GAS接続時はドライブへ上げてURLを受け取り、
   未接続（実験のローカル保存）ではデータのまま返す。 */
async function storeImage(dataUri) {
  if (!GAS_URL) return dataUri;
  const r = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'uploadImage', passcode: EXPERIMENT_PASSCODE, data: dataUri })
  });
  const j = await r.json();
  if (j && j.ok && j.url) return j.url;
  throw new Error('upload failed');
}

async function loadContent() {
  if (GAS_URL) {
    try {
      const r = await fetch(GAS_URL + '?action=content', { method: 'GET' });
      const j = await r.json();
      if (j && j.ok && j.content) return mergeDefaults(j.content);
    } catch (e) { /* 取れなければ下の保存分・初期値で続ける */ }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return mergeDefaults(JSON.parse(raw));
  } catch (e) {}
  return mergeDefaults(null);
}

async function saveContent(content, passcode) {
  if (GAS_URL) {
    const r = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ passcode: passcode || EXPERIMENT_PASSCODE, content: content })
    });
    const j = await r.json();
    if (!j || !j.ok) throw new Error((j && j.error) || 'save failed');
    return 'gas';
  }
  localStorage.setItem(LS_KEY, JSON.stringify(content));
  return 'local';
}
