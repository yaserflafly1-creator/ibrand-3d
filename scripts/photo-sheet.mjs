// before / after sheet of the sample
import fs from 'fs/promises';
import sharp from 'sharp';
const n = JSON.parse(await fs.readFile('audit/sample.json', 'utf8')).length, C = 256, cells = [];
for (let k = 0; k < n; k++){ try {
  const before = await sharp(`audit/in/${k}.png`).flatten({ background: '#ffffff' }).resize(C, C, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
  const after = await sharp(`audit/cut/${k}.png`).resize(C, C, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).flatten({ background: '#ec78aa' }).png().toBuffer();
  cells.push({ before, after, k }); } catch (e){ console.log('skip', k, e.message); } }
const cols = 5, rows = Math.ceil(cells.length / cols);
await sharp({ create: { width: cols * C * 2, height: rows * C, channels: 3, background: '#ffffff' } }).composite(cells.flatMap((c, i) => [
  { input: c.before, left: (i % cols) * C * 2, top: Math.floor(i / cols) * C }, { input: c.after, left: (i % cols) * C * 2 + C, top: Math.floor(i / cols) * C }])).jpeg({ quality: 82 }).toFile('audit/sample.jpg');
await fs.writeFile('audit/order.json', JSON.stringify(cells.map(c => c.k)));
console.log('done', cells.length);
