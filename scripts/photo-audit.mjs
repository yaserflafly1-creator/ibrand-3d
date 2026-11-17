// Looks at every product photo the store shows and notes the ones worth replacing, for the editor's
// "pictures to fix" list. Reads site/data/products.json (written by build-data.mjs just before), writes
// site/data/photo-audit.json. A photo is looked at once: the verdicts are kept in .cache/audit1 between runs,
// and a run stops by itself after its time budget, so the list fills over a few builds.
//   s  the product is small inside the picture      b  the product runs edge to edge (no margin, maybe cropped)
//   l  the picture itself is small (blurry on screen)   g  the background is not white
//   w  something small stands apart in a corner (a logo, a watermark, a badge)
import fs from 'node:fs/promises';
import sharp from 'sharp';

const OUT = process.env.OUT || 'site', CACHE = process.env.AUDIT_CACHE || '.cache/audit1', BUDGET = (+process.env.AUDIT_MINUTES || 6) * 60000, PAR = 12, T0 = Date.now();

export async function look(buf){
  const meta = await sharp(buf).metadata(), big = Math.max(meta.width || 0, meta.height || 0);
  const { data, info } = await sharp(buf).rotate().flatten({ background: '#ffffff' }).resize(240, 240, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H, fg = new Uint8Array(N);
  let ring = 0, ringWhite = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const i = (y * W + x) * 3, white = data[i] >= 238 && data[i+1] >= 238 && data[i+2] >= 238;
    if (!white) fg[y * W + x] = 1;
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2){ ring++; if (white) ringWhite++; }
  }
  let f = '';
  if (big < 450) f += 'l';
  if (ringWhite / ring < .75) return f + 'g';
  // the separate things in the picture (pixels within two steps of each other belong together)
  const id = new Int32Array(N).fill(-1), parts = [], stack = [];
  for (let p0 = 0; p0 < N; p0++){
    if (!fg[p0] || id[p0] >= 0) continue;
    const c = { n: 0, x1: W, y1: H, x2: -1, y2: -1, r: 0, g: 0, b: 0 }, k = parts.length; parts.push(c); stack.push(p0); id[p0] = k;
    while (stack.length){
      const p = stack.pop(), x = p % W, y = (p / W) | 0, i = p * 3;
      c.n++; c.r += data[i]; c.g += data[i+1]; c.b += data[i+2];
      if (x < c.x1) c.x1 = x; if (x > c.x2) c.x2 = x; if (y < c.y1) c.y1 = y; if (y > c.y2) c.y2 = y;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++){
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx; if (fg[q] && id[q] < 0){ id[q] = k; stack.push(q); }
      }
    }
  }
  if (!parts.length) return f + 's';
  parts.sort((a, b) => b.n - a.n);
  const m = parts[0], mw = m.x2 - m.x1 + 1, mh = m.y2 - m.y1 + 1;
  if (Math.max(mw / W, mh / H) < .5) f += 's';
  let x1 = W, y1 = H, x2 = -1, y2 = -1;
  for (const c of parts){ if (c.n < N * .0008) continue; x1 = Math.min(x1, c.x1); y1 = Math.min(y1, c.y1); x2 = Math.max(x2, c.x2); y2 = Math.max(y2, c.y2); }
  if ((x1 <= 1 && x2 >= W - 2) || (y1 <= 1 && y2 >= H - 2)) f += 'b';
  for (const c of parts.slice(1)){
    if (c.n < N * .0015 || c.n > N * .05) continue;
    const cx = (c.x1 + c.x2) / 2 / W, cy = (c.y1 + c.y2) / 2 / H, corner = (cx < .3 || cx > .7) && (cy < .3 || cy > .7);
    const apart = c.x2 < m.x1 - 2 || c.x1 > m.x2 + 2 || c.y2 < m.y1 - 2 || c.y1 > m.y2 + 2;
    const r = c.r / c.n, g = c.g / c.n, b = c.b / c.n, pink = r > 170 && r - g > 45 && b >= g - 15;
    if ((corner && apart) || (pink && apart)){ f += 'w'; break; }
  }
  return f;
}

async function main(){
  const d = JSON.parse(await fs.readFile(`${OUT}/data/products.json`, 'utf8')), base = d.imgBase || '', list = new Map();
  for (const s of Object.values(d.sections || {})) for (const p of s.products || []) if (p.img && !list.has(String(p.id))) list.set(String(p.id), p.img);
  await fs.mkdir(CACHE, { recursive: true });
  let seen = {}; try { seen = JSON.parse(await fs.readFile(`${CACHE}/seen.json`, 'utf8')); } catch (e){}
  const todo = [...new Set([...list.values()].filter(u => !(u in seen)))];
  let done = 0, failed = 0, i = 0;
  const work = async () => { while (i < todo.length && Date.now() - T0 < BUDGET){
    const u = todo[i++];
    try { const r = await fetch(/^https?:/.test(u) ? u : base + u, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ibrand-3d photo audit)' } }); if (!r.ok) throw new Error('img ' + r.status);
      seen[u] = await look(Buffer.from(await r.arrayBuffer())); done++; }
    catch (e){ failed++; }
  } };
  await Promise.all(Array.from({ length: PAR }, work));
  // forget photos the store no longer uses, so the cache does not grow for ever
  const live = new Set(list.values()); for (const u of Object.keys(seen)) if (!live.has(u)) delete seen[u];
  await fs.writeFile(`${CACHE}/seen.json`, JSON.stringify(seen));
  const bad = {}; let checked = 0;
  for (const [pid, u] of list){ if (!(u in seen)) continue; checked++; if (seen[u]) bad[pid] = [seen[u], u.slice(-24)]; }
  await fs.writeFile(`${OUT}/data/photo-audit.json`, JSON.stringify({ v: 1, at: new Date().toISOString(), total: list.size, checked, bad }));
  console.log('PHOTO AUDIT looked at', done, 'new photos, failed', failed, '; checked', checked, 'of', list.size, '; worth replacing', Object.keys(bad).length);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error('photo audit failed:', e.message); process.exit(1); });
