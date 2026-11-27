// Finds better pictures for the products whose picture the audit marked as weak (scripts/photo-audit.mjs), best sellers
// first, and leaves them for a person to review in the control panel (admin/photos.html). Nothing is sent to the store
// from here: a picture reaches Salla only when someone approves it on that page.
//
// For each product: an image search (Firecrawl) by the product's barcode, then by its name when the barcode found too
// little; every result is downloaded and judged the same way the audit judges the store's own pictures (white background,
// no watermark or badge, not cropped, large enough), compared with the product's name (words and sizes) and with the
// picture the store has now (same pack, same colours), then trimmed, squared on white and saved as a JPEG.
//   env: FIRECRAWL_API_KEY, COUNT (products this run, default 100), OUT (folder with earlier results, default photo-fix),
//        SITE (the published pharmacy), RETRY=1 (search again for products an earlier run found nothing for), IDS (only these)
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { look } from './photo-audit.mjs';

const SITE = (process.env.SITE || 'https://yaserflafly1-creator.github.io/ibrand-3d').replace(/\/+$/, ''), OUT = process.env.OUT || 'photo-fix';
const KEY = process.env.FIRECRAWL_API_KEY || '', COUNT = Math.max(1, +process.env.COUNT || 100), RETRY = /^(1|yes|true)$/i.test(process.env.RETRY || '');
const BUDGET = (+process.env.MINUTES || 45) * 60000, T0 = Date.now();   // a run stops taking new products after this long and saves what it has
const ONLY = (process.env.IDS || '').split(/[\s,]+/).filter(Boolean), PAR = 3, UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const OWN = /(^|\.)ibrand\.com\.sa$/i, OWN_CDN = /cdn\.salla\.sa\/yKErG\//i;           // never the store's own pictures
const TRUSTED = /(nahdionline|al-dawaa|aldawaa|unitedpharmacy|dawi\.sa|boots|lifepharmacy|whites\.sa|kunooz|adamonline|beautytocare|sidalih|pharmazone|myaster|iherb|amazon\.|noon\.com|carrefour|danube|panda|lulu)/i;

// ---------- names: the same letters and digits however they were typed ----------
const norm = s => String(s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/(\d)[٫,](\d)/g, '$1.$2');
const STOP = new Set(['من', 'مع', 'الي', 'علي', 'في', 'و', 'او', 'لل', 'ل', 'مل', 'جم', 'غم', 'جرام', 'غرام', 'حبه', 'قطعه', 'عدد', 'for', 'with', 'and', 'the', 'of', 'ml', 'g', 'gm', 'mg', 'pcs', 'x']);
const words = s => norm(s).split(/[^a-z0-9ء-ي.]+/).map(w => w.replace(/^ال(?=.{3,})/, '').replace(/^\.+|\.+$/g, '')).filter(w => w && !STOP.has(w) && !/^\d+(\.\d+)?$/.test(w));
const nums = s => (norm(s).match(/\d+(\.\d+)?/g) || []).map(Number).filter(n => n > 0);
export function nameMatch(name, title){
  const a = [...new Set(words(name))], b = new Set(words(title)), bl = [...b];
  const hit = a.filter(w => b.has(w) || (w.length >= 4 && bl.some(x => x.length >= 4 && (x.startsWith(w) || w.startsWith(x))))).length;
  const na = [...new Set(nums(name))], nb = new Set(nums(title)), nhit = na.filter(n => nb.has(n)).length;
  const sameScript = /[ء-ي]/.test(name) === /[ء-ي]/.test(title);
  return { words: a.length ? hit / a.length : 0, nums: na.length ? nhit / na.length : null, sameScript };
}

// ---------- pictures ----------
// what the product itself looks like, apart from where it sits in the frame: a small grey copy of the product's own box,
// its colours, and the box's shape
async function shape(buf){
  const { data, info } = await sharp(buf).rotate().flatten({ background: '#ffffff' }).resize(96, 96, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x1 = W, y1 = H, x2 = -1, y2 = -1, n = 0; const hist = new Float32Array(64);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){ const i = (y * W + x) * 3; if (data[i] >= 238 && data[i+1] >= 238 && data[i+2] >= 238) continue;
    n++; if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; hist[(data[i] >> 6) * 16 + (data[i+1] >> 6) * 4 + (data[i+2] >> 6)]++; }
  if (n < W * H * .01){ x1 = 0; y1 = 0; x2 = W - 1; y2 = H - 1; }
  for (let i = 0; i < 64; i++) hist[i] /= Math.max(1, n);
  const bw = x2 - x1 + 1, bh = y2 - y1 + 1, g = new Float32Array(256);
  for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++){ const sx = Math.min(W - 1, x1 + Math.floor((u + .5) * bw / 16)), sy = Math.min(H - 1, y1 + Math.floor((v + .5) * bh / 16)), i = (sy * W + sx) * 3; g[v * 16 + u] = (data[i] * 299 + data[i+1] * 587 + data[i+2] * 114) / 1000; }
  let m = 0; for (const v of g) m += v; m /= 256; let sd = 0; for (let i = 0; i < 256; i++){ g[i] -= m; sd += g[i] * g[i]; } sd = Math.sqrt(sd) || 1; for (let i = 0; i < 256; i++) g[i] /= sd;
  return { g, hist, ar: bw / bh };
}
// the product runs into an edge of the frame (a close-up, or a pack cut by the frame): colour on the outermost lines,
// or, where the picture carries a thin white border of its own, colour running along a side of the product's box that
// sits right at that border
export async function cutAtEdge(buf){
  const { data, info } = await sharp(buf).rotate().flatten({ background: '#ffffff' }).resize(240, 240, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ink = (x, y) => { const i = (y * W + x) * 3; return data[i] < 232 || data[i+1] < 232 || data[i+2] < 232 ? 1 : 0; };
  let t = 0, b = 0, l = 0, r = 0;
  for (let x = 0; x < W; x++){ t += ink(x, 0) + ink(x, 1); b += ink(x, H - 1) + ink(x, H - 2); }
  for (let y = 0; y < H; y++){ l += ink(0, y) + ink(1, y); r += ink(W - 1, y) + ink(W - 2, y); }
  if (Math.max(t / (2 * W), b / (2 * W), l / (2 * H), r / (2 * H)) > .05) return true;
  let x1 = W, y1 = H, x2 = -1, y2 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(x, y)){ if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
  if (x2 < 0) return false;
  const row = y => { let n = 0; for (let x = x1; x <= x2; x++) n += ink(x, y); return n / W; }, col = x => { let n = 0; for (let y = y1; y <= y2; y++) n += ink(x, y); return n / H; }, NEAR = 6, RUN = .2;
  return (y1 <= NEAR && Math.max(row(y1), row(Math.min(H - 1, y1 + 1))) >= RUN) || (H - 1 - y2 <= NEAR && Math.max(row(y2), row(Math.max(0, y2 - 1))) >= RUN)
      || (x1 <= NEAR && Math.max(col(x1), col(Math.min(W - 1, x1 + 1))) >= RUN) || (W - 1 - x2 <= NEAR && Math.max(col(x2), col(Math.max(0, x2 - 1))) >= RUN);
}
export function alike(a, b){
  let c = 0, h = 0; for (let i = 0; i < 256; i++) c += a.g[i] * b.g[i]; for (let i = 0; i < 64; i++) h += Math.min(a.hist[i], b.hist[i]);
  const ar = Math.min(a.ar, b.ar) / Math.max(a.ar, b.ar);
  return { grey: Math.max(0, c), colour: h, shape: ar, all: .45 * Math.max(0, c) + .35 * h + .2 * ar };
}
// the picture as the store should get it: the product trimmed of its empty border, centred on a white square with a
// little air around it, at most 1000 px, as a JPEG
export async function square(buf){
  const flat = await sharp(buf).rotate().flatten({ background: '#ffffff' }).removeAlpha().png().toBuffer();
  let cut = flat; try { cut = await sharp(flat).trim({ background: '#ffffff', threshold: 14 }).png().toBuffer(); } catch (e){}
  const m = await sharp(cut).metadata(), side = Math.round(Math.max(m.width, m.height) * 1.12), px = Math.floor((side - m.width) / 2), py = Math.floor((side - m.height) / 2);
  const out = sharp(cut).extend({ top: py, bottom: side - m.height - py, left: px, right: side - m.width - px, background: '#ffffff' });
  return { buf: await (side > 1000 ? out.resize(1000, 1000) : out).jpeg({ quality: 88, mozjpeg: true }).toBuffer(), product: Math.max(m.width, m.height) };
}

const get = async (u, ms = 15000) => { const r = await fetch(u, { signal: AbortSignal.timeout(ms), headers: { 'User-Agent': UA, accept: 'image/avif,image/webp,image/png,image/jpeg,*/*' } }); if (!r.ok) throw new Error('http ' + r.status); return r; };
const getJ = async u => (await get(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), 30000)).json();
let credits = 0, stopped = '', failing = 0;
async function imageSearch(q, again = 0){
  const r = await fetch('https://api.firecrawl.dev/v2/search', { method: 'POST', signal: AbortSignal.timeout(60000), headers: { authorization: 'Bearer ' + KEY, 'content-type': 'application/json' }, body: JSON.stringify({ query: q, limit: 10, sources: [{ type: 'images' }] }) });
  if (r.status === 402 || r.status === 401){ stopped = r.status === 402 ? 'رصيد فايركرول انتهى' : 'مفتاح فايركرول غير صحيح'; return []; }
  if (r.status === 429 && again < 4){ await new Promise(s => setTimeout(s, 8000 * (again + 1))); return imageSearch(q, again + 1); }
  const d = await r.json().catch(() => null); if (!r.ok || !d) throw new Error('search ' + r.status + ' ' + JSON.stringify(d || '').slice(0, 160));
  credits += d.creditsUsed || 2; failing = 0; return (d.data && d.data.images) || [];
}

async function candidatesFor(p, oldShape, oldFlags){
  // the barcode first (the international number says exactly which pack), the name after it when the barcode found too little
  const kept = [], seenUrl = new Set(), tries = [];
  if (/^\d{8,14}$/.test(p.sku || '')) tries.push(p.sku);
  tries.push(p.name);
  for (const q of tries){
    if (stopped || kept.some(k => k.conf === 'high')) break;   // a sure find: no second search
    let res = []; try { res = await imageSearch(q); p.searched = 1; } catch (e){ console.warn('search failed', p.id, e.message); if (++failing >= 8) stopped = 'تعذّر الوصول إلى فايركرول'; continue; }
    const pre = [];
    for (const r of res){
      const iu = r.imageUrl || '', pu = r.url || ''; if (!/^https?:\/\//.test(iu) || seenUrl.has(iu) || /\.(svg|gif)(\?|$)/i.test(iu) || OWN_CDN.test(iu)) continue;
      let host = ''; try { host = new URL(pu || iu).hostname.replace(/^www\./, ''); } catch (e){ continue; }
      if (OWN.test(host)) continue;
      if (r.imageWidth && r.imageHeight && Math.min(r.imageWidth, r.imageHeight) < 600) continue;
      seenUrl.add(iu);
      const nm = nameMatch(p.name + ' ' + (p.brand || ''), r.title || ''), byCode = q === p.sku;
      const tw = words(r.title || ''); nm.brand = words(p.brand || '').some(w => w.length >= 3 && tw.some(x => x.startsWith(w) || w.startsWith(x) && x.length >= 4));
      if (!byCode && nm.nums === 0 && nm.sameScript) continue;                                  // another size of the same thing
      pre.push({ iu, pu, host, nm, byCode, rank: (byCode ? .75 : nm.words) + (nm.nums || 0) * .3 + (TRUSTED.test(host) ? .1 : 0) - (r.position || 9) * .01 });
    }
    pre.sort((a, b) => b.rank - a.rank);
    for (const c of pre.slice(0, 6)){
      if (kept.length >= 4) break;
      try {
        const buf = Buffer.from(await (await get(c.iu)).arrayBuffer()); if (buf.length < 8000 || buf.length > 9e6) continue;
        const meta = await sharp(buf).metadata(); if (Math.min(meta.width || 0, meta.height || 0) < 600) continue;
        const fl = await look(buf); if (/[gwlb]/.test(fl) || await cutAtEdge(buf)) continue;      // not white, a watermark, too small, cropped
        const sq = await square(buf); if (sq.product < 480) continue;                             // the product itself is tiny in a big frame
        const sh = await shape(sq.buf); if (kept.some(k => alike(k.sh, sh).grey > .985)) continue; // the same photo from another shop
        const vis = oldShape ? alike(oldShape, sh) : null, visW = !vis ? 0 : /g/.test(oldFlags) ? .15 : .4;
        const otherSize = c.nm.nums === 0 && c.nm.sameScript;                                     // found by barcode, yet its title names another size
        // a barcode can also turn up on a page that has nothing to do with the product (the same digits in another shop's
        // catalogue): a find by barcode counts as sure only when something else agrees, the brand or words of the name in
        // the page's title, or the pack looking like the one in the store's picture; one that looks nothing like it is dropped
        const oldG = /g/.test(oldFlags), backed = c.nm.brand || c.nm.words >= .34 || (vis && !oldG && vis.all >= .58);
        if (c.byCode && !backed && vis && !oldG && vis.all < .4) continue;
        const text = c.byCode ? (otherSize ? .5 : backed ? .88 : .5) : (c.nm.nums === null ? c.nm.words : .65 * c.nm.words + .35 * c.nm.nums) * (c.nm.sameScript ? 1 : 1.6);
        const s = Math.min(1, (1 - visW) * Math.min(1, text) + visW * (vis ? vis.all : 0)) * .9 + (TRUSTED.test(c.host) ? .04 : 0) + Math.min(.06, sq.product / 20000);
        const sure = (c.byCode ? backed && !otherSize : c.nm.nums === null || c.nm.nums === 1) && (!vis || /g/.test(oldFlags) || vis.all > .5);
        kept.push({ buf: sq.buf, sh, w: meta.width, h: meta.height, from: c.pu || c.iu, host: c.host, s: Math.round(s * 100), conf: s >= .62 && sure ? 'high' : s >= .42 ? 'mid' : 'low', byCode: c.byCode, v: vis ? Math.round(vis.all * 100) : -1, t: Math.round(c.nm.words * 100), br: c.nm.brand ? 1 : 0 });
      } catch (e){}
    }
  }
  const order = { high: 2, mid: 1, low: 0 };
  return kept.filter(k => k.conf !== 'low' || kept.length === 1).sort((a, b) => (order[b.conf] - order[a.conf]) || (b.s - a.s)).slice(0, 3);   // up to three: several can be published for one product, the first chosen as its main picture
}

export async function main(){
  if (!KEY){ console.error('FIRECRAWL_API_KEY is not set (repository secret)'); process.exit(1); }
  await fs.mkdir(OUT, { recursive: true });
  const priv = async f => { try { return JSON.parse(await fs.readFile((process.env.PRIVATE || '.private') + '/' + f, 'utf8')); } catch (e){ return null; } };
  const [prod, audit, skus0, sales] = await Promise.all([getJ(SITE + '/data/products.json'), getJ(SITE + '/data/photo-audit.json'), priv('sku.json'), priv('sales.json')]);
  const skus = skus0 || {}, soldOf = id => (sales && sales[id]) || 0;   // barcodes and units sold come from the build's private files (never published)
  const base = prod.imgBase || 'https://cdn.salla.sa/yKErG/', P = new Map();
  for (const s of Object.values(prod.sections || {})) for (const p of s.products || []) if (!P.has(String(p.id))) P.set(String(p.id), p);
  const readJ = async (f, d) => { try { return JSON.parse(await fs.readFile(`${OUT}/${f}`, 'utf8')); } catch (e){ return d; } };
  const prev = await readJ('list.json', { items: [] }), tried = await readJ('tried.json', {}), bad = audit.bad || {};
  // earlier finds for products whose picture is no longer weak (replaced since) are dropped, with their files
  const items = [];
  // (and for the products named in IDS: those are searched again from nothing)
  for (const it of prev.items || []){ if (bad[it.id] && P.has(it.id) && !ONLY.includes(it.id)) items.push(it); else for (const c of it.c || []) await fs.rm(`${OUT}/${c.f}`, { force: true }); }
  const have = new Set(items.map(i => i.id));
  let todo = Object.keys(bad).filter(id => P.has(id) && !have.has(id) && (RETRY || ONLY.length || !tried[id]) && (!ONLY.length || ONLY.includes(id)));
  todo.sort((a, b) => soldOf(b) - soldOf(a) || (P.get(b).pop || 0) - (P.get(a).pop || 0)); todo = todo.slice(0, ONLY.length ? ONLY.length : COUNT);
  console.log('weak pictures', Object.keys(bad).length, '| waiting for review', items.length, '| searching now', todo.length);
  let i = 0, found = 0, none = 0;
  const work = async () => { while (i < todo.length && !stopped && Date.now() - T0 < BUDGET){
    const id = todo[i++], p = P.get(id), oldUrl = /^https?:/.test(p.img) ? p.img : base + p.img, flags = bad[id][0], sku = skus[id] || '';
    let oldShape = null; try { oldShape = await shape(Buffer.from(await (await get(oldUrl)).arrayBuffer())); } catch (e){}
    const q = { id, name: p.name, brand: p.brand || '', sku }, c = await candidatesFor(q, oldShape, flags);
    if ((stopped || !q.searched) && !c.length) continue;                 // not really searched (no credit left, or the search failed): it stays for the next run
    tried[id] = new Date().toISOString().slice(0, 10);
    if (!c.length){ none++; continue; }
    const out = []; for (let n = 0; n < c.length; n++){ const f = `${id}-${n + 1}.jpg`; await fs.writeFile(`${OUT}/${f}`, c[n].buf); out.push({ f, w: c[n].w, h: c[n].h, from: c[n].from, host: c[n].host, s: c[n].s, conf: c[n].conf, code: c[n].byCode ? 1 : 0, v: c[n].v, t: c[n].t, br: c[n].br }); }
    items.push({ id, name: p.name, brand: p.brand || '', pop: p.pop || 0, fl: flags, old: oldUrl, c: out }); found++;
  } };
  await Promise.all(Array.from({ length: PAR }, work));
  items.forEach(it => { delete it.sku; delete it.sold; if (it.pop == null && P.has(it.id)) it.pop = P.get(it.id).pop || 0; });
  items.sort((a, b) => soldOf(b.id) - soldOf(a.id) || (b.pop || 0) - (a.pop || 0));
  const noPic = Object.keys(tried).filter(id => bad[id] && P.has(id) && !items.some(x => x.id === id)).sort((a, b) => soldOf(b) - soldOf(a)).map(id => ({ id, name: P.get(id).name, pop: P.get(id).pop || 0 }));
  for (const id of Object.keys(tried)) if (!bad[id]) delete tried[id];
  const inList = new Set(items.map(x => x.id)), left = Object.keys(bad).filter(id => P.has(id) && !inList.has(id) && !tried[id]).length;
  await fs.writeFile(`${OUT}/tried.json`, JSON.stringify(tried));
  await fs.writeFile(`${OUT}/list.json`, JSON.stringify({ v: 1, at: new Date().toISOString(), weak: Object.keys(bad).length, run: { searched: found + none, found, none, credits, stopped, left }, items, none: noPic }));
  const line = `searched ${found + none} products: better picture found for ${found}, nothing suitable for ${none}; Firecrawl credits used ${credits}${stopped ? '; stopped early: ' + stopped : ''}; waiting for review ${items.length}; still to search ${left}`;
  console.log('PHOTO FIX', line);
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `### Better product pictures\n${line}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error('photo fix failed:', e); process.exit(1); });
