// cuts the background of audit/in/N.png into audit/cut/N.png (own process: see photo-audit.mjs)
import fs from 'fs/promises';
import { removeBackground } from '@imgly/background-removal-node';
const files = (await fs.readdir('audit/in')).filter(f => f.endsWith('.png'));
for (const f of files){ const t = Date.now();
  try { const out = await removeBackground(new Blob([await fs.readFile('audit/in/' + f)], { type: 'image/png' }), { model: 'medium', output: { format: 'image/png' } });
    await fs.writeFile('audit/cut/' + f, Buffer.from(await out.arrayBuffer())); console.log('cut', f, Date.now() - t, 'ms'); }
  catch (e){ console.log('cut failed', f, e.message); } }
