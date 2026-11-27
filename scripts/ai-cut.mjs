// AI background cut for the photos listed in ai-todo.json → .cache/aicut/<hash>.webp (or <hash>.bad when it cannot be cut).
// Runs in its own job and process: its image library cannot share a process with the one the build uses.
import fs from 'fs/promises';
import { removeBackground } from '@imgly/background-removal-node';
const DIR = '.cache/aicut', BUDGET = (+process.env.CUT_MINUTES || 40) * 60000, t0 = Date.now();
await fs.mkdir(DIR, { recursive: true });
const todo = JSON.parse(await fs.readFile('ai-todo.json', 'utf8').catch(() => '[]'));
const have = new Set(await fs.readdir(DIR));
let done = 0, bad = 0, left = 0;
for (const { h, url } of todo){
  if (have.has(h + '.webp') || have.has(h + '.bad')) continue;
  if (Date.now() - t0 > BUDGET){ left++; continue; }
  try {
    const r = await fetch(url); if (!r.ok) throw new Error('http ' + r.status);
    const out = await removeBackground(new Blob([await r.arrayBuffer()], { type: r.headers.get('content-type') || 'image/png' }), { model: 'medium', output: { format: 'image/webp', quality: .9 } });
    await fs.writeFile(`${DIR}/${h}.webp`, Buffer.from(await out.arrayBuffer())); done++;
  } catch (e){ await fs.writeFile(`${DIR}/${h}.bad`, String(e.message || e)); bad++; }
}
console.log('ai cut: done', done, 'failed', bad, 'left for the next run', left, 'of', todo.length, 'in', Math.round((Date.now() - t0) / 1000), 's');
