// Builds the 3D pharmacy data from iBrand's public Salla storefront API.
//  • every in-stock product of the store goes on a shelf (deduplicated into one main section each)
//  • prescription-only medicines (Rx) are never shown anywhere
//  • product photos are cut out of their white background, cached between runs, and packed into
//    texture pages (16×16 tiles) that the page loads lazily as the visitor walks near them
// Output: site/data/products.json, site/atlas/*.webp, site/assets/logo.png
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import sharp from 'sharp';

const STORE_ID = '1972477543';
const API = 'https://api.salla.dev/store/v1';
const OUT = process.env.OUT || 'site';
const CACHE = '.cache/tiles8';

// GPU-compressed atlas pages (.basis, ETC1S + mipmaps): same download size as webp,
// ~4x less GPU memory and no decode jank — set BASISU to the encoder binary to enable
const BCACHE = '.cache/basis6';
const BASISU = process.env.BASISU || '';
const bStats = { cached: 0, made: 0, failed: 0 };
async function toBasis(pngBuf, outPath){
  if (!BASISU) return false;
  const h = crypto.createHash('sha1').update(pngBuf).digest('hex').slice(0, 20);
  const c = `${BCACHE}/${h}.basis`;
  try{ await fs.copyFile(c, outPath); bStats.cached++; return true; }catch(e){}
  const tmp = `${BCACHE}/t-${h}.png`;
  try{
    await fs.writeFile(tmp, pngBuf);
    await new Promise((res, rej) => execFile(BASISU, ['-q', '230', '-mipmap', '-y_flip', tmp, '-output_file', c], { timeout: 600000 }, e => e ? rej(e) : res()));
    await fs.copyFile(c, outPath); bStats.made++; return true;
  }catch(e){ bStats.failed++; return false; }
  finally{ fs.unlink(tmp).catch(() => {}); }
}
// the store's pink "no photo yet" camera card, by content hash (sha1 of the file, first 16 hex)
const PLACEHOLDER_SIGS = new Set(['4925ec783dc091ec', '8ea18a9f292bfaf6', 'b4b139852ebc0ad5']);
const PLACEHOLDER_REFS = [
  'https://cdn.salla.sa/yKErG/2yhDRHn3ckxwcuCJHQ6MMdbcF2J2rsXXRdqNXwWV.jpg',
  'https://cdn.salla.sa/yKErG/Kna0U1d1PpXkkQXuRprsfKH6FfjVpUQAzE0RK4jt.jpg',
  'https://cdn.salla.sa/yKErG/WloNpmAeocCofUpIVdKFEsAelcU3FuxrGpyM8tev.jpg',
  'https://cdn.salla.sa/yKErG/WntfW7079ljQkWCWqHY8ZGpu4ydKsU7vXY7ShCYJ.jpg',
  'https://cdn.salla.sa/yKErG/dfGGyay6RVx5j0fTSNFONyFVzgx1YXrcubBzjLMS.jpg',
  'https://cdn.salla.sa/yKErG/qncTARQ1yVcArz7QnoZqDnj6pJh349NhA28h7L8d.jpg',
  'https://cdn.salla.sa/yKErG/DQJxfNTStMVIGuLzSm4yMNxX7DLC1ORh4AeOl5sm.jpg',
  'https://cdn.salla.sa/yKErG/SMgzimibyYY524qLIh6EJGCz6vvyMJlOMXTX6lQb.jpg',
  'https://cdn.salla.sa/yKErG/T4JKe3Gt1TAmlSaCeLwgfl9DSltuBJvUpsu7YH6d.jpg',
  'https://cdn.salla.sa/yKErG/qcAvBCkUX0KcKE7ipxffheLnACqPwfV1LAtvacea.jpg',
  'https://cdn.salla.sa/yKErG/3V01ZVsXRg8W9OdwEcyjrwWqg6n7stSOssbEobMh.jpg',
  'https://cdn.salla.sa/yKErG/ip8sI1tkEfyOD5UdcOEAWfwA2nJg1uvYTXQELFN7.jpg',
];
// 256-bit perceptual hash (dHash): robust to re-encoding
async function dHash(buf){
  const g = await sharp(buf).flatten({ background: '#ffffff' }).grayscale().resize(17, 16, { fit: 'fill' }).raw().toBuffer();
  let hex = '';
  for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c += 4){
    let n = 0;
    for (let k = 0; k < 4; k++) n = n * 2 + (g[r*17 + c + k] > g[r*17 + c + k + 1] ? 1 : 0);
    hex += n.toString(16);
  }
  return hex;
}
const POP = Array.from({ length: 16 }, (_, i) => (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1));
const hamming = (a, b) => { if (!a || !b || a.length !== b.length) return 999; let d = 0; for (let i = 0; i < a.length; i++) d += POP[parseInt(a[i], 16) ^ parseInt(b[i], 16)]; return d; };
const TILE = 128, TPX = 512, PC = 16, PR = 16, PER_PAGE = PC * PR, HQ = 2, HC = PC / 2;   // 2048² page (+1024² phone page); HD pieces = 2 rows × half width at 512 px (4096×1024)
const PROMO_MAX = 240;

// Main sections: each product lands in the FIRST one it belongs to (no duplicates on the shelves)
const MAIN = [
  { key:'meds',    cats:[525290526, 988973592, 1242734243] },   // OTC, children's medicines, women's creams only
  { key:'baby',    cats:[745675715] },
  { key:'vit',     cats:[884496587] },
  { key:'skin',    cats:[26418371] },
  { key:'hair',    cats:[2050932461] },
  { key:'makeup',  cats:[539644644] },
  { key:'daily',   cats:[527058090] },
  { key:'devices', cats:[1237042837] },
  { key:'pets',    cats:[155896758] },
];
// Promotion fixtures: a subset that may repeat products already on the main shelves
const PROMO = [
  { key:'offers', cats:[875118918] }, { key:'milk', cats:[725967892] }, { key:'excl', cats:[155323060] },
  { key:'trend',  cats:[878276543] }, { key:'import', cats:[270592768] },
];
// Never shown: prescription medicines and borderline women's medicines (hormones, pregnancy, period)
const RX_CATS = [1762945823, 2016706466, 1552036256, 779047073];
const BEST = ['1012406569','396663321','278321967','698566588','2009074357','1659003050','789878611','2075898590','370092566','692610913','1796046235'];
const QUICK = /مناديل|منديل|معطر|كلينكس|فاين|معقم|كمام|علك|نعناع|مرطب شفاه|ليب|زبدة الكاكاو|مزيل عرق|بخاخ فم|لصقات|بلاستر|قطن/;

const headers = { 'Store-Identifier': STORE_ID, 'Accept-Language': 'ar', 'Accept': 'application/json', 'User-Agent': 'ibrand-3d-pharmacy/2.0' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = v => typeof v === 'number' ? v : (v && typeof v.amount === 'number' ? v.amount : null);
const priceOf = p => { const sale = num(p.sale_price), base = num(p.price); const v = p.is_on_sale && sale > 0 ? sale : base; return v > 0 ? v : null; };
let skippedUnavail = 0;
const inStock = p => {
  const ok = (p.status ? p.status === 'sale' : true)         // hidden / sale-ended statuses are out
    && p.is_hidden !== true && p.is_published !== false
    && p.is_available !== false && p.is_out_of_stock !== true
    && !(typeof p.quantity === 'number' && p.quantity <= 0 && !p.unlimited_quantity);
  if (!ok) skippedUnavail++;
  return ok;
};
const short = (u, pre) => (u || '').startsWith(pre) ? u.slice(pre.length) : (u || '');

async function getJSON(url, tries = 4){
  for (let i = 0; i < tries; i++){
    try {
      const r = await fetch(url, { headers });
      if (r.ok) return await r.json();
      if (r.status === 429) { await sleep(3000 * (i + 1)); continue; }
      console.warn('HTTP', r.status, url.slice(0, 120));
    } catch (e){ console.warn('fetch error', e.message); }
    await sleep(800 * (i + 1));
  }
  return null;
}

// all in-stock products of one listing (category, selected ids, or the whole store)
async function listAll(query, cap = Infinity){
  let url = `${API}/products?${query}`;
  const out = [];
  for (let page = 0; url && out.length < cap && page < 3000; page++){
    const j = await getJSON(url);
    if (!j) break;
    for (const p of j.data || []) out.push(p);
    url = j.cursor && j.cursor.next;
    await sleep(110);
  }
  return out;
}
const catQuery = id => `source=categories&source_value[]=${id}&per_page=50`;

function toItem(p){
  return {
    id: String(p.id), name: p.name, url: short(p.url, 'https://ibrand.com.sa/ar/'),
    img: short(p.image && p.image.url, 'https://cdn.salla.sa/yKErG/'),
    brand: (p.brand && p.brand.name || '').trim(), brandId: p.brand && p.brand.id ? String(p.brand.id) : '',
    price: priceOf(p), regular: num(p.regular_price) || num(p.price) || null, onSale: !!p.is_on_sale,
    sold: num(p.sold_quantity) || 0,
  };
}
const fullImg = s => s.startsWith('http') ? s : 'https://cdn.salla.sa/yKErG/' + s;

// ---------- image cut-out (cached by image URL) ----------
function cutout(data, w, h, thr = 247){
  const near = i => data[i] >= thr && data[i+1] >= thr && data[i+2] >= thr;
  const mark = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++){ stack.push(x, (h-1)*w + x); }
  for (let y = 0; y < h; y++){ stack.push(y*w, y*w + w - 1); }
  while (stack.length){
    const p = stack.pop();
    if (mark[p] || !near(p*4)) continue;
    mark[p] = 1;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p-1); if (x < w-1) stack.push(p+1);
    if (y > 0) stack.push(p-w); if (y < h-1) stack.push(p+w);
  }
  let minX = w, minY = h, maxX = -1, maxY = -1, kept = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const p = y*w + x;
    if (mark[p]) { data[p*4+3] = 0; continue; }
    const edge = (x>0 && mark[p-1]) || (x<w-1 && mark[p+1]) || (y>0 && mark[p-w]) || (y<h-1 && mark[p+w]);
    if (edge) data[p*4+3] = 150;
    kept++; if (x<minX) minX=x; if (x>maxX) maxX=x; if (y<minY) minY=y; if (y>maxY) maxY=y;
  }
  return { kept: kept / (w*h), box: maxX < 0 ? null : { left:minX, top:minY, width:maxX-minX+1, height:maxY-minY+1 } };
}

async function makeTile(imgUrl){
  const r = await fetch(imgUrl, { headers: { 'User-Agent': headers['User-Agent'] } });
  if (!r.ok) throw new Error('img ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const S = 600;
  const { data: data0, info } = await sharp(buf).rotate().flatten({ background: '#ffffff' }).resize(S, S, { fit: 'contain', background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let data = Buffer.from(data0);
  let res = cutout(data, info.width, info.height, 247);
  if (!res.box || res.kept > 0.97){
    const d2 = Buffer.from(data0), r2 = cutout(d2, info.width, info.height, 239);
    if (r2.box && r2.kept >= 0.04 && r2.kept <= 0.97){ data = d2; res = r2; }
  }
  const sig = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
  const psig = crypto.createHash('sha1').update(data0).digest('hex').slice(0, 16);
  const ah = await dHash(buf);
  // how pink is what survived the cut-out? (identifies the store's "no photo" pink camera card)
  let pkN = 0, pkP = 0;
  for (let i = 3; i < data.length; i += 4){
    if (!data[i]) continue; pkN++;
    const r = data[i-3], g = data[i-2], bl = data[i-1];
    if (r > 180 && r - g > 45 && bl >= g - 15) pkP++;
  }
  const pk = pkN ? +(pkP / pkN).toFixed(2) : 0;
  const asCard = async () => {
    const png = await sharp(buf).rotate().flatten({ background:'#ffffff' }).resize(TPX, TPX, { fit:'cover' }).png().toBuffer();
    return { png, meta: { aspect: 1, card: true, rect: 1, c: '#eeeeee', sig, pk, psig, ah } };
  };
  if (!res.box || res.kept < 0.04 || res.kept > 0.97) return asCard();
  // the flood leaked into the product itself (white bottles, cream tubs): keep the photo on a card instead
  { const b = res.box, cx0 = b.left + (b.width*.3|0), cx1 = b.left + (b.width*.7|0), cy0 = b.top + (b.height*.3|0), cy1 = b.top + (b.height*.7|0);
    let tot = 0, hole = 0;
    for (let y = cy0; y < cy1; y += 2) for (let x = cx0; x < cx1; x += 2){ tot++; if (data[(y*info.width + x)*4 + 3] === 0) hole++; }
    if (tot && hole / tot > 0.12) return asCard(); }
  // bites eaten into the product from its sides/top (white boxes on white background):
  // inside each row, holes between the leftmost and rightmost kept pixels mean the flood ate into the body
  { const b = res.box; let span = 0, hole = 0;
    for (let y = b.top; y < b.top + b.height; y += 2){
      let x0 = -1, x1 = -1;
      for (let x = b.left; x < b.left + b.width; x++){ if (data[(y*info.width + x)*4 + 3]){ if (x0 < 0) x0 = x; x1 = x; } }
      if (x0 < 0) continue;
      for (let x = x0; x <= x1; x += 2){ span++; if (!data[(y*info.width + x)*4 + 3]) hole++; }
    }
    if (span && hole / span > 0.08){ tileStats.bitten = (tileStats.bitten || 0) + 1; return asCard(); } }
  // white/transparent products (white tubes, clear serum bottles) survive the cut-out intact but
  // dissolve visually against the white shelves: show those as framed photo cards instead
  { let op = 0, wh = 0;
    for (let i = 3; i < data.length; i += 8){
      if (!data[i]) continue; op++;
      if (data[i-3] >= 233 && data[i-2] >= 233 && data[i-1] >= 233) wh++;
    }
    if (op > 40 && wh / op > 0.62){ tileStats.white = (tileStats.white || 0) + 1; return asCard(); } }
  const b = res.box, aspect = b.width / b.height;
  let opaque = 0, er = 0, eg = 0, eb = 0, en = 0;
  const band = Math.max(2, Math.round(Math.min(b.width, b.height) * .08));
  for (let y = b.top; y < b.top + b.height; y++) for (let x = b.left; x < b.left + b.width; x++){
    const i = (y * info.width + x) * 4; if (data[i+3] === 0) continue; opaque++;
    if (x - b.left < band || b.left + b.width - x <= band || y - b.top < band || b.top + b.height - y <= band){ er += data[i]; eg += data[i+1]; eb += data[i+2]; en++; }
  }
  const hex = v => Math.round(v).toString(16).padStart(2, '0');
  const png = await sharp(data, { raw: info }).extract(b).resize(TPX, TPX, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } }).png().toBuffer();
  return { png, meta: { aspect: +aspect.toFixed(3), card: false, rect: +(opaque / (b.width*b.height)).toFixed(2), c: en ? '#' + hex(er/en) + hex(eg/en) + hex(eb/en) : '#dddddd', sig, pk, psig, ah } };
}

const tileStats = { cached: 0, made: 0, failed: 0 };
async function tileFor(img){
  const h = crypto.createHash('sha1').update(img).digest('hex').slice(0, 20);
  const pngPath = `${CACHE}/${h}.png`, metaPath = `${CACHE}/${h}.json`;
  try {
    const [png, meta] = await Promise.all([fs.readFile(pngPath), fs.readFile(metaPath, 'utf8')]);
    tileStats.cached++; return { png, meta: JSON.parse(meta) };
  } catch {}
  const t = await makeTile(fullImg(img));
  await fs.writeFile(pngPath, t.png); await fs.writeFile(metaPath, JSON.stringify(t.meta));
  tileStats.made++; return t;
}
async function pool(items, n, fn){
  let i = 0; const workers = Array.from({ length: n }, async () => { while (i < items.length){ const k = i++; await fn(items[k], k); } });
  await Promise.all(workers);
}

// pack one section into texture pages
async function packSection(key, items){
  const ok = [];
  const tiles = new Array(items.length);
  await pool(items, 8, async (it, k) => {
    try { tiles[k] = await tileFor(it.img); } catch (e){ tileStats.failed++; }
  });
  items.forEach((it, k) => { if (tiles[k]) ok.push({ it, t: tiles[k] }); });
  const pages = [], pagesM = [], products = [];
  for (let pg = 0; pg * PER_PAGE < ok.length; pg++){
    const chunk = ok.slice(pg * PER_PAGE, (pg + 1) * PER_PAGE);
    const rows = Math.ceil(chunk.length / PC);
    const big = `atlas/${key}-${pg}.webp`, small = `atlas/${key}-${pg}-m.webp`;
    // HD pieces: 2 rows x half width at 512 px per product (crisp close-ups within 4096-wide textures)
    const hd = [];
    const full = await sharp({ create: { width: PC*TPX, height: rows*TPX, channels: 4, background: { r:0, g:0, b:0, alpha:0 } } })
      .composite(chunk.map(({ t }, i) => ({ input: t.png, left: (i % PC) * TPX, top: Math.floor(i / PC) * TPX }))).png().toBuffer();
    for (let rp = 0; rp * HQ < rows; rp++){
      const qr = Math.min(HQ, rows - rp*HQ), piece = { rows: qr };
      for (const [hk, hx] of [['a', 0], ['b', 1]]){
        const src = `atlas/${key}-${pg}-h${rp}${hk}.webp`;
        await sharp(full).extract({ left: hx*HC*TPX, top: rp*HQ*TPX, width: HC*TPX, height: qr*TPX }).webp({ quality: 76, alphaQuality: 82 }).toFile(`${OUT}/${src}`);
        piece[hk] = src;
      }
      hd.push(piece);
    }
    const bigPng = await sharp(full).resize(PC*TILE, rows*TILE).png().toBuffer();
    await sharp(bigPng).webp({ quality: 76, alphaQuality: 82 }).toFile(`${OUT}/${big}`);
    await sharp(full).resize(PC*TILE/2, rows*TILE/2).webp({ quality: 72, alphaQuality: 78 }).toFile(`${OUT}/${small}`);
    const page = { src: big, rows, hd }, bigB = big.replace('.webp', '.basis');
    if (await toBasis(bigPng, `${OUT}/${bigB}`)) page.srcB = bigB;
    pages.push(page); pagesM.push(small);
    chunk.forEach(({ it, t }, i) => products.push({ ...it, pg, tile: i, ...t.meta }));
  }
  return { cols: PC, pages, pagesM, products };
}

async function main(){
  await fs.mkdir(`${OUT}/atlas`, { recursive: true });
  await fs.mkdir(BCACHE, { recursive: true });
  await fs.mkdir(`${OUT}/data`, { recursive: true });
  await fs.mkdir(`${OUT}/assets`, { recursive: true });
  await fs.mkdir(CACHE, { recursive: true });

  // logo
  try {
    const lr = await fetch('https://cdn.salla.sa/yKErG/pn5LJ3wpLeNIgU15HaDHqkSBOEversEv0QQOmwp8.png', { headers: { 'User-Agent': headers['User-Agent'] } });
    if (lr.ok) await sharp(Buffer.from(await lr.arrayBuffer())).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).png().toFile(`${OUT}/assets/logo.png`);
  } catch (e){ console.warn('logo', e.message); }

  // 1) prescription medicines to hide
  const rx = new Set();
  for (const c of RX_CATS) (await listAll(catQuery(c))).forEach(p => rx.add(String(p.id)));
  console.log('hidden prescription products:', rx.size);

  // 2) main sections, deduplicated, grouped by the store's own sub-categories (deepest level)
  const tree = ((await getJSON(`${API}/categories`)) || {}).data || [];
  const nodes = new Map();
  const walk = n => { if (n.id_ !== undefined) nodes.set(String(n.id_), n); (n.sub_categories || []).forEach(walk); };
  tree.forEach(walk);
  const leavesOf = id => {
    const n = nodes.get(String(id)); if (!n) return [{ id, name: null }];
    const out = [], rec = m => { const subs = (m.sub_categories || []).filter(c => c.id_ !== undefined); if (!subs.length) out.push({ id: m.id_, name: m.name }); else subs.forEach(rec); };
    rec(n); return out;
  };
  const seen = new Set(), main = {}, subOrder = {};
  for (const sec of MAIN){
    const list = [], order = [];
    const take = (p, sub) => {
      const id = String(p.id);
      if (seen.has(id) || rx.has(id) || !inStock(p) || !(p.image && p.image.url)) return;
      seen.add(id); list.push({ ...toItem(p), sub: sub || '' });
    };
    for (const c of sec.cats){
      for (const leaf of leavesOf(c)){
        if (leaf.name && !order.includes(leaf.name)) order.push(leaf.name);
        for (const p of await listAll(catQuery(leaf.id))) take(p, leaf.name);
      }
      for (const p of await listAll(catQuery(c))) take(p, '');   // anything filed only at the top level
    }
    main[sec.key] = list; subOrder[sec.key] = order;
    console.log(sec.key, list.length, 'sub-categories', order.length);
  }
  // 3) everything else that is in stock → "منتجات متنوعة"
  const other = [];
  for (const p of await listAll('per_page=50')){
    const id = String(p.id);
    if (seen.has(id) || rx.has(id) || !inStock(p) || !(p.image && p.image.url)) continue;
    seen.add(id); other.push(toItem(p));
  }
  main.other = other; console.log('other', other.length);

  // 4) promotion fixtures (subsets) + best sellers + quick-grab counter items
  const promo = {};
  for (const sec of PROMO){
    promo[sec.key] = (await listAll(catQuery(sec.cats[0]), PROMO_MAX * 2)).filter(p => inStock(p) && p.image && p.image.url && !rx.has(String(p.id))).slice(0, PROMO_MAX).map(toItem);
  }
  { const q = new URLSearchParams({ source: 'selected' }); BEST.forEach(id => q.append('source_value[]', id));
    promo.best = (await listAll(q.toString())).filter(p => inStock(p) && p.image && p.image.url).map(toItem); }
  const allMain = Object.values(main).flat();
  promo.quick = allMain.filter(p => QUICK.test(p.name)).slice(0, 120);
  console.log('quick-grab items:', promo.quick.length);

  // merchandiser shelf order: sub-category (store order) → strongest-selling brand blocks first
  // (front of the aisle) → inside each block best sellers first, so they land on the eye-level shelves
  for (const k of Object.keys(main)){
    const ord = subOrder[k] || [], si = p => { const i = ord.indexOf(p.sub); return i < 0 ? 9999 : i; };
    const soldSum = {}; main[k].forEach(p => { const key = p.sub + '|' + p.brand; soldSum[key] = (soldSum[key]||0) + (p.sold || 0); });
    main[k].sort((a, b) => si(a) - si(b) || (!a.brand) - (!b.brand)
      || soldSum[b.sub + '|' + b.brand] - soldSum[a.sub + '|' + a.brand]
      || a.brand.localeCompare(b.brand, 'ar')
      || (b.sold || 0) - (a.sold || 0)
      || a.name.localeCompare(b.name, 'ar'));
  }

  // 4.5) hide the pink "no photo yet" placeholder: identical image content under many different URLs
  const everything = [...Object.values(main).flat(), ...Object.values(promo).flat()];
  const uniqImgs = [...new Set(everything.map(p => p.img))];
  const metaByImg = new Map();
  await pool(uniqImgs, 8, async img => { try { metaByImg.set(img, (await tileFor(img)).meta); } catch {} });
  const bySig = new Map();
  for (const [img, m] of metaByImg){ if (!m.sig) continue; if (!bySig.has(m.sig)) bySig.set(m.sig, []); bySig.get(m.sig).push(img); }
  const ph = new Set();
  for (const imgs of bySig.values()){
    const m = metaByImg.get(imgs[0]);
    if (imgs.length >= 4 && (m.pk || 0) >= .5) imgs.forEach(u => ph.add(u));
  }
  for (const [img, m] of metaByImg) if (m.sig && PLACEHOLDER_SIGS.has(m.sig)) ph.add(img);
  const refPsig = new Set(), refAh = [];
  for (const u of PLACEHOLDER_REFS){
    try {
      const r = await fetch(u, { headers: { 'User-Agent': headers['User-Agent'] } }); if (!r.ok) continue;
      const rb = Buffer.from(await r.arrayBuffer());
      const { data: rd } = await sharp(rb).rotate().flatten({ background: '#ffffff' }).resize(600, 600, { fit: 'contain', background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      refPsig.add(crypto.createHash('sha1').update(rd).digest('hex').slice(0, 16));
      refAh.push(await dHash(rb));
    } catch (e){ console.warn('placeholder ref', u.slice(-20), e.message); }
  }
  console.log('placeholder refs loaded:', refAh.length);
  let nearest = 999;
  for (const [img, m] of metaByImg){
    const d = m.ah ? Math.min(...refAh.map(a => hamming(a, m.ah))) : 999;
    nearest = Math.min(nearest, d);
    if ((m.psig && refPsig.has(m.psig)) || d <= 10) ph.add(img);
  }
  console.log('placeholder nearest hamming across catalog:', nearest);
  for (const u of uniqImgs) if (/placeholder|no[-_]?image/i.test(u)) ph.add(u);
  let hiddenPh = 0;
  for (const k of Object.keys(main)){ const n0 = main[k].length; main[k] = main[k].filter(p => !ph.has(p.img)); hiddenPh += n0 - main[k].length; }
  for (const k of Object.keys(promo)) promo[k] = promo[k].filter(p => !ph.has(p.img));
  console.log('hidden placeholder photos:', hiddenPh);

  // 5) textures
  const result = { v: 2, build: Date.now().toString(36), generated: new Date().toISOString(), tile: TILE, storeUrl: 'https://ibrand.com.sa/ar/', imgBase: 'https://cdn.salla.sa/yKErG/', sections: {}, mainKeys: Object.keys(main), promoKeys: Object.keys(promo) };
  for (const [k, items] of [...Object.entries(main), ...Object.entries(promo)]){
    if (!items.length) continue;
    result.sections[k] = await packSection(k, items);
    console.log('packed', k, result.sections[k].products.length, 'pages', result.sections[k].pages.length);
  }
  console.log('tiles', tileStats);
  console.log('basis pages', BASISU ? bStats : 'disabled (no BASISU)');
  if (!Object.keys(result.sections).length) throw new Error('No products fetched — storefront API unreachable?');
  result.counts = { onShelves: Object.keys(main).reduce((a, k) => a + (result.sections[k] ? result.sections[k].products.length : 0), 0), hiddenRx: rx.size };

  // 6) brand logos for shelf headers (brands with 10+ products in a section)
  const want = new Map();
  for (const k of Object.keys(main)){
    const sec = result.sections[k]; if (!sec) continue;
    const n = {}; sec.products.forEach(p => { if (p.brandId) n[p.brandId] = (n[p.brandId]||0) + 1; });
    sec.products.forEach(p => { if (p.brandId && n[p.brandId] > 10) want.set(p.brandId, p.brand); });
  }
  const logoUrl = {}, logoByName = {};
  let burl = `${API}/brands?per_page=100`;
  for (let page = 0; burl && page < 30; page++){
    const j = await getJSON(burl, 2); if (!j) break;
    for (const b of j.data || []){ const u = b.logo || (b.image && (b.image.url || b.image)) || b.banner; if (b.id && typeof u === 'string' && u.startsWith('http')){ logoUrl[String(b.id)] = u; if (b.name) logoByName[String(b.name).trim()] = u; } }
    burl = (j.cursor && j.cursor.next) || null;
    await sleep(150);
  }
  const BW = 320, BH = 128, BCOLS = 10, bcomps = [], brands = {};
  for (const [id, name] of want){
    const u = logoUrl[id] || logoByName[String(name).trim()]; if (!u) continue;   // duplicate brand records: reuse the logo of a same-named brand
    try {
      const r = await fetch(u, { headers: { 'User-Agent': headers['User-Agent'] } }); if (!r.ok) continue;
      const trimmed = await sharp(Buffer.from(await r.arrayBuffer())).flatten({ background:'#ffffff' }).trim({ threshold: 18 }).toBuffer();
      const png = await sharp(trimmed).resize(BW - 24, BH - 20, { fit:'contain', background:'#ffffff' }).extend({ top:10, bottom:10, left:12, right:12, background:'#ffffff' }).png().toBuffer();
      const i = Object.keys(brands).length;
      bcomps.push({ input: png, left: (i % BCOLS) * BW, top: Math.floor(i / BCOLS) * BH });
      brands[id] = { name, tile: i };
    } catch (e){ console.warn('brand logo', id, e.message); }
  }
  if (bcomps.length){
    const brows = Math.ceil(bcomps.length / BCOLS);
    await sharp({ create: { width: BCOLS*BW, height: brows*BH, channels: 3, background: '#ffffff' } }).composite(bcomps).webp({ quality: 85 }).toFile(`${OUT}/atlas/brands.webp`);
    result.brandAtlas = { src: 'atlas/brands.webp', cols: BCOLS, rows: brows, w: BW, h: BH };
  }
  result.brands = brands;
  console.log('brand logos', Object.keys(brands).length, 'of', want.size);
  const missing = [...want].filter(([id]) => !brands[id]).map(([id, name]) => name).sort((a, b) => a.localeCompare(b, 'ar'));
  console.log('MISSING LOGOS ' + missing.length + ': ' + missing.join(' | '));
  console.log('ON SHELVES', result.counts.onShelves, 'hidden Rx', rx.size, 'skipped hidden/out-of-stock', skippedUnavail);
  await fs.writeFile(`${OUT}/data/products.json`, JSON.stringify(result));
}

main().catch(e => { console.error(e); process.exit(1); });
