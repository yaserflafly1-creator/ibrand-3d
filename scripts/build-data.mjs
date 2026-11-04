// Pulls live products for each pharmacy section from iBrand's public Salla storefront API,
// cuts each product photo out of its white background, and packs them into one texture atlas per section.
// Output: data/products.json + atlas/<section>.webp  (run by .github/workflows/refresh.yml)
import fs from 'node:fs/promises';
import sharp from 'sharp';

const STORE_ID = '1972477543';
const API = 'https://api.salla.dev/store/v1/products';
const TILE = 256, COLS = 8, ROWS = 6, MAX = COLS * ROWS;

// key -> how to query the storefront API
const SECTIONS = {
  offers: { cat: 875118918 },
  milk:   { cat: 725967892 },
  excl:   { cat: 155323060 },
  trend:  { cat: 878276543 },
  meds:   { cat: 1199189212 },
  skin:   { cat: 26418371 },
  hair:   { cat: 2050932461 },
  makeup: { cat: 539644644 },
  daily:  { cat: 527058090 },
  baby:   { cat: 745675715 },
  vit:    { cat: 884496587 },
  devices:{ cat: 1237042837 },
  pets:   { cat: 155896758 },
  import: { cat: 270592768 },
  best:   { ids: ['1012406569','396663321','278321967','698566588','2009074357','1659003050','789878611','2075898590','370092566','692610913','1796046235'] }
};

const headers = { 'Store-Identifier': STORE_ID, 'Accept-Language': 'ar', 'Accept': 'application/json', 'User-Agent': 'ibrand-3d-pharmacy/1.0' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = v => typeof v === 'number' ? v : (v && typeof v.amount === 'number' ? v.amount : null);

async function getJSON(url, tries = 3){
  for (let i = 0; i < tries; i++){
    try {
      const r = await fetch(url, { headers });
      if (r.ok) return await r.json();
      console.warn('HTTP', r.status, url);
    } catch (e){ console.warn('fetch error', e.message); }
    await sleep(800 * (i + 1));
  }
  return null;
}

async function listProducts(def){
  let url;
  if (def.ids){
    const q = new URLSearchParams({ source: 'selected' });
    [...new Set(def.ids)].forEach(id => q.append('source_value[]', id));
    url = `${API}?${q}`;
  } else {
    url = `${API}?source=categories&source_value[]=${def.cat}&per_page=50`;
  }
  const out = [], seen = new Set();
  for (let page = 0; url && page < 10 && out.length < MAX; page++){
    const j = await getJSON(url);
    if (!j) break;
    for (const p of j.data || []){
      if (out.length >= MAX) break;
      const img = p.image && p.image.url;
      if (!img || seen.has(p.id) || p.is_available === false) continue;
      seen.add(p.id);
      out.push({
        id: String(p.id), name: p.name, url: p.url, img,
        price: num(p.sale_price) ?? num(p.price), regular: num(p.regular_price) ?? num(p.price),
        onSale: !!p.is_on_sale
      });
    }
    url = j.cursor && j.cursor.next;
    await sleep(250);
  }
  return out;
}

// Flood-fill the near-white background from the image border and make it transparent.
function cutout(data, w, h){
  const near = i => data[i] > 236 && data[i+1] > 236 && data[i+2] > 236;
  const mark = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++){ stack.push(x, (h-1)*w + x); }
  for (let y = 0; y < h; y++){ stack.push(y*w, y*w + w - 1); }
  while (stack.length){
    const p = stack.pop();
    if (mark[p]) continue;
    if (!near(p*4)) continue;
    mark[p] = 1;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p-1); if (x < w-1) stack.push(p+1);
    if (y > 0) stack.push(p-w); if (y < h-1) stack.push(p+w);
  }
  let minX = w, minY = h, maxX = -1, maxY = -1, kept = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const p = y*w + x;
    if (mark[p]) { data[p*4+3] = 0; continue; }
    // soften the edge: pixels touching background get partial alpha
    const edge = (x>0 && mark[p-1]) || (x<w-1 && mark[p+1]) || (y>0 && mark[p-w]) || (y<h-1 && mark[p+w]);
    if (edge) data[p*4+3] = 150;
    kept++; if (x<minX) minX=x; if (x>maxX) maxX=x; if (y<minY) minY=y; if (y>maxY) maxY=y;
  }
  return { kept: kept / (w*h), box: maxX < 0 ? null : { left:minX, top:minY, width:maxX-minX+1, height:maxY-minY+1 } };
}

async function tileFor(imgUrl){
  const r = await fetch(imgUrl, { headers: { 'User-Agent': headers['User-Agent'] } });
  if (!r.ok) throw new Error('img ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const S = 420;
  const { data, info } = await sharp(buf).rotate().flatten({ background: '#ffffff' }).resize(S, S, { fit: 'contain', background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const res = cutout(data, info.width, info.height);
  let img, card = false;
  if (!res.box || res.kept < 0.04 || res.kept > 0.97){
    // background isn't plain white (or nothing left): use the photo as a flat card
    card = true;
    img = sharp(buf).rotate().flatten({ background:'#ffffff' }).resize(TILE, TILE, { fit:'cover' });
    return { png: await img.png().toBuffer(), aspect: 1, card };
  }
  const cropped = sharp(data, { raw: info }).extract(res.box);
  const aspect = res.box.width / res.box.height;
  const png = await cropped.resize(TILE, TILE, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } }).png().toBuffer();
  return { png, aspect, card };
}

async function main(){
  await fs.mkdir('atlas', { recursive: true });
  await fs.mkdir('data', { recursive: true });
  const result = { generated: new Date().toISOString(), tile: TILE, cols: COLS, rows: ROWS, sections: {} };
  for (const [key, def] of Object.entries(SECTIONS)){
    const items = await listProducts(def);
    const comps = [], products = [];
    for (const it of items){
      try {
        const t = await tileFor(it.img);
        const i = products.length;
        comps.push({ input: t.png, left: (i % COLS) * TILE, top: Math.floor(i / COLS) * TILE });
        products.push({ ...it, tile: i, aspect: +t.aspect.toFixed(3), card: t.card });
      } catch (e){ console.warn(key, it.id, e.message); }
      await sleep(60);
    }
    if (!products.length){ console.warn('no products for', key); continue; }
    await sharp({ create: { width: COLS*TILE, height: ROWS*TILE, channels: 4, background: { r:0, g:0, b:0, alpha:0 } } })
      .composite(comps).webp({ quality: 82, alphaQuality: 90 }).toFile(`atlas/${key}.webp`);
    result.sections[key] = { atlas: `atlas/${key}.webp`, products };
    console.log(key, products.length, 'products');
  }
  if (!Object.keys(result.sections).length) throw new Error('No products fetched — storefront API unreachable?');
  await fs.writeFile('data/products.json', JSON.stringify(result));
}

export { tileFor };
if (process.argv[1] && process.argv[1].endsWith('build-data.mjs')) main().catch(e => { console.error(e); process.exit(1); });
