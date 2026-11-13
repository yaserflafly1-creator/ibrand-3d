// One-off: look at the photos of the products that do not cut out cleanly, say why, and try an AI background cut on a sample of 50.
import fs from 'fs/promises';
import sharp from 'sharp';
const SITE = 'https://yaserflafly1-creator.github.io/ibrand-3d/';
const d = await (await fetch(SITE + 'data/products.json?t=' + Date.now())).json();
const full = s => s.startsWith('http') ? s : 'https://cdn.salla.sa/yKErG/' + s;
const seen = new Set(), list = [];
for (const [k, s] of Object.entries(d.sections)) for (const p of s.products){ if (seen.has(p.id)) continue; seen.add(p.id);
  const a = p.aspect || 1, flat = !p.card && a > .6 && (p.rect || 1) < .8;
  if (p.card || flat) list.push({ id: p.id, name: p.name, url: p.url, img: full(p.img), sec: k, kind: p.card ? 'card' : 'multi' }); }
console.log('to check', list.length, 'of', seen.size);
await fs.mkdir('audit/in', { recursive: true });
let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (i < list.length){ const it = list[i++];
  try { const r = await fetch(it.img); if (!r.ok) throw new Error('http ' + r.status); const buf = Buffer.from(await r.arrayBuffer());
    const m = await sharp(buf).metadata(); it.w = m.width; it.h = m.height;
    const S = 200, { data } = await sharp(buf).rotate().flatten({ background: '#ffffff' }).resize(S, S, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    let n = 0, dark = 0; const px = (x, y) => { const o = (y * S + x) * 3; n++; if (data[o] < 235 || data[o+1] < 235 || data[o+2] < 235) dark++; };
    for (let t = 0; t < S; t++) for (const e of [0, 1, 2, S-3, S-2, S-1]){ px(t, e); px(e, t); }
    it.border = +(dark / n).toFixed(2); it.buf = buf;
  } catch (e){ it.err = e.message; } } }));
for (const it of list){
  it.reason = it.err ? 'تعذّر تحميل الصورة' : Math.min(it.w, it.h) < 450 ? 'دقة منخفضة' : it.border > .3 ? 'خلفية ملونة أو صورة إعلانية' : it.kind === 'multi' ? 'أكثر من قطعة في الصورة' : 'منتج أبيض على خلفية بيضاء';
}
const by = {}; list.forEach(it => by[it.reason] = (by[it.reason] || 0) + 1); console.log('REASONS', JSON.stringify(by));
await fs.writeFile('audit/audit.json', JSON.stringify(list.map(({ buf, ...r }) => r)));
// sample of 50, spread over the reasons
const groups = {}; list.filter(it => it.buf).forEach(it => (groups[it.reason] = groups[it.reason] || []).push(it));
const pick = []; const keys = Object.keys(groups); for (let r = 0; pick.length < 50 && r < 400; r++){ const g = groups[keys[r % keys.length]]; const it = g[Math.floor((r * 7919) % g.length)]; if (it && !pick.includes(it)) pick.push(it); }
const { removeBackground } = await import('@imgly/background-removal-node');
const C = 256, cells = [];
for (const [n, it] of pick.entries()){
  try { const png = await sharp(it.buf).rotate().resize(1024, 1024, { fit: 'inside' }).png().toBuffer(); const t = Date.now();
    const out = Buffer.from(await (await removeBackground(new Blob([png], { type: 'image/png' }), { model: 'medium', output: { format: 'image/png' } })).arrayBuffer());
    const before = await sharp(it.buf).rotate().flatten({ background: '#ffffff' }).resize(C, C, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
    const after = await sharp(out).resize(C, C, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).flatten({ background: '#ec78aa' }).png().toBuffer();
    cells.push({ before, after }); console.log('cut', n, it.reason, Date.now() - t, 'ms');
  } catch (e){ console.log('cut failed', n, e.message); } }
const cols = 5, rows = Math.ceil(cells.length / cols);
await sharp({ create: { width: cols * C * 2, height: rows * C, channels: 3, background: '#ffffff' } }).composite(cells.flatMap((c, k) => [
  { input: c.before, left: (k % cols) * C * 2, top: Math.floor(k / cols) * C }, { input: c.after, left: (k % cols) * C * 2 + C, top: Math.floor(k / cols) * C }])).jpeg({ quality: 82 }).toFile('audit/sample.jpg');
await fs.writeFile('audit/sample.json', JSON.stringify(pick.map(({ buf, ...r }) => r)));
console.log('done', cells.length);
