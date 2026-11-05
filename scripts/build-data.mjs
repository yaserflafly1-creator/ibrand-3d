// Builds the 3D pharmacy data from iBrand's public Salla storefront API.
//  • every in-stock product of the store goes on a shelf (deduplicated into one main section each)
//  • prescription-only medicines (Rx) are never shown anywhere
//  • product photos are cut out of their white background, cached between runs, and packed into
//    texture pages (16×16 tiles) that the page loads lazily as the visitor walks near them
// Output: site/data/products.json, site/atlas/*.webp, site/assets/logo.png
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';

const STORE_ID = '1972477543';
const API = 'https://api.salla.dev/store/v1';
const OUT = process.env.OUT || 'site';
const CACHE = '.cache/tiles';
const TILE = 128, PC = 16, PR = 16, PER_PAGE = PC * PR;   // 2048×2048 desktop page, 1024×1024 phone page
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
const inStock = p => p.is_available !== false && p.is_out_of_stock !== true && !(p.quantity === 0 && !p.unlimited_quantity);
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
  };
}
const fullImg = s => s.startsWith('http') ? s : 'https://cdn.salla.sa/yKErG/' + s;

// ---------- image cut-out (cached by image URL) ----------
function cutout(data, w, h){
  const near = i => data[i] > 236 && data[i+1] > 236 && data[i+2] > 236;
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
  const S = 360;
  const { data, info } = await sharp(buf).rotate().flatten({ background: '#ffffff' }).resize(S, S, { fit: 'contain', background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const res = cutout(data, info.width, info.height);
  if (!res.box || res.kept < 0.04 || res.kept > 0.97){
    const png = await sharp(buf).rotate().flatten({ background:'#ffffff' }).resize(TILE, TILE, { fit:'cover' }).png().toBuffer();
    return { png, meta: { aspect: 1, card: true, rect: 1, c: '#eeeeee' } };
  }
  const b = res.box, aspect = b.width / b.height;
  let opaque = 0, er = 0, eg = 0, eb = 0, en = 0;
  const band = Math.max(2, Math.round(Math.min(b.width, b.height) * .08));
  for (let y = b.top; y < b.top + b.height; y++) for (let x = b.left; x < b.left + b.width; x++){
    const i = (y * info.width + x) * 4; if (data[i+3] === 0) continue; opaque++;
    if (x - b.left < band || b.left + b.width - x <= band || y - b.top < band || b.top + b.height - y <= band){ er += data[i]; eg += data[i+1]; eb += data[i+2]; en++; }
  }
  const hex = v => Math.round(v).toString(16).padStart(2, '0');
  const png = await sharp(data, { raw: info }).extract(b).resize(TILE, TILE, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } }).png().toBuffer();
  return { png, meta: { aspect: +aspect.toFixed(3), card: false, rect: +(opaque / (b.width*b.height)).toFixed(2), c: en ? '#' + hex(er/en) + hex(eg/en) + hex(eb/en) : '#dddddd' } };
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
    const comps = chunk.map(({ t }, i) => ({ input: t.png, left: (i % PC) * TILE, top: Math.floor(i / PC) * TILE }));
    const big = `atlas/${key}-${pg}.webp`, small = `atlas/${key}-${pg}-m.webp`;
    const img = sharp({ create: { width: PC*TILE, height: rows*TILE, channels: 4, background: { r:0, g:0, b:0, alpha:0 } } }).composite(comps);
    const buf = await img.png().toBuffer();
    await sharp(buf).webp({ quality: 76, alphaQuality: 82 }).toFile(`${OUT}/${big}`);
    await sharp(buf).resize(PC*TILE/2, rows*TILE/2).webp({ quality: 72, alphaQuality: 78 }).toFile(`${OUT}/${small}`);
    pages.push({ src: big, rows }); pagesM.push(small);
    chunk.forEach(({ it, t }, i) => products.push({ ...it, pg, tile: i, ...t.meta }));
  }
  return { cols: PC, pages, pagesM, products };
}

async function main(){
  await fs.mkdir(`${OUT}/atlas`, { recursive: true });
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

  // shelf order: sub-category (store order) → brand (biggest first) → shape → name
  for (const k of Object.keys(main)){
    const ord = subOrder[k] || [], si = p => { const i = ord.indexOf(p.sub); return i < 0 ? 9999 : i; };
    const cnt = {}; main[k].forEach(p => { const key = p.sub + '|' + p.brand; cnt[key] = (cnt[key]||0) + 1; });
    main[k].sort((a, b) => si(a) - si(b) || (!a.brand) - (!b.brand) || cnt[b.sub + '|' + b.brand] - cnt[a.sub + '|' + a.brand] || a.brand.localeCompare(b.brand, 'ar') || a.name.localeCompare(b.name, 'ar'));
  }

  // 5) textures
  const result = { v: 2, generated: new Date().toISOString(), tile: TILE, storeUrl: 'https://ibrand.com.sa/ar/', imgBase: 'https://cdn.salla.sa/yKErG/', sections: {}, mainKeys: Object.keys(main), promoKeys: Object.keys(promo) };
  for (const [k, items] of [...Object.entries(main), ...Object.entries(promo)]){
    if (!items.length) continue;
    result.sections[k] = await packSection(k, items);
    console.log('packed', k, result.sections[k].products.length, 'pages', result.sections[k].pages.length);
  }
  console.log('tiles', tileStats);
  if (!Object.keys(result.sections).length) throw new Error('No products fetched — storefront API unreachable?');
  result.counts = { onShelves: Object.keys(main).reduce((a, k) => a + (result.sections[k] ? result.sections[k].products.length : 0), 0), hiddenRx: rx.size };

  // 6) brand logos for shelf headers (brands with 10+ products in a section)
  const want = new Map();
  for (const k of Object.keys(main)){
    const sec = result.sections[k]; if (!sec) continue;
    const n = {}; sec.products.forEach(p => { if (p.brandId) n[p.brandId] = (n[p.brandId]||0) + 1; });
    sec.products.forEach(p => { if (p.brandId && n[p.brandId] > 10) want.set(p.brandId, p.brand); });
  }
  const logoUrl = {};
  let burl = `${API}/brands?per_page=100`;
  for (let page = 0; burl && page < 30; page++){
    const j = await getJSON(burl, 2); if (!j) break;
    for (const b of j.data || []){ const u = b.logo || (b.image && (b.image.url || b.image)) || b.banner; if (b.id && typeof u === 'string' && u.startsWith('http')) logoUrl[String(b.id)] = u; }
    burl = (j.cursor && j.cursor.next) || null;
    await sleep(150);
  }
  const BW = 320, BH = 128, BCOLS = 10, bcomps = [], brands = {};
  for (const [id, name] of want){
    const u = logoUrl[id]; if (!u) continue;
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
  console.log('ON SHELVES', result.counts.onShelves, 'hidden Rx', rx.size);
  await fs.writeFile(`${OUT}/data/products.json`, JSON.stringify(result));
}

main().catch(e => { console.error(e); process.exit(1); });
