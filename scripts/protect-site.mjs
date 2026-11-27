// Shrinks and scrambles the code of the published site (site/), so what visitors' browsers receive is hard to read
// and reuse. Runs in the build after the site is assembled. A block that fails to shrink is kept as it was, so the
// deploy never breaks on it. Usage: node scripts/protect-site.mjs [site]
import fs from 'node:fs'; import path from 'node:path'; import { minify } from 'terser';
const root = process.argv[2] || 'site', NOTE = '/*! © iBrand Pharmacies (ibrand.com.sa) — all rights reserved. جميع الحقوق محفوظة لصيدليات اي براند */';
const opts = {ecma:2020, compress:{passes:1, keep_fargs:true, unsafe:false}, mangle:{toplevel:false}, format:{comments:false, preamble:NOTE}, toplevel:false};
let shrunk = 0, kept = 0, before = 0, after = 0;
async function js(code, where){ try { const r = await minify(code, opts); if (!r.code) throw new Error('empty'); shrunk++; return r.code; } catch(e){ kept++; console.warn('kept as it was:', where, String(e.message || e).slice(0, 160)); return code; } }
const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(root)){
  const rel = path.relative(root, f);
  if (/(^|\/)(data|atlas|plan|assets)\//.test(rel)) continue;   // product data and pictures: nothing to shrink
  if (f.endsWith('.js')){ const s = fs.readFileSync(f, 'utf8'); before += s.length; const o = await js(s, rel); after += o.length; fs.writeFileSync(f, o); continue; }
  if (!f.endsWith('.html')) continue;
  let s = fs.readFileSync(f, 'utf8'), out = '', i = 0; const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(s))){ const attrs = m[1] || '', body = m[2];
    out += s.slice(i, m.index); i = re.lastIndex;
    if (/\bsrc=|type=["']?(application\/json|text\/plain|module)/i.test(attrs) || body.trim().length < 200){ out += m[0]; continue; }
    before += body.length; const o = await js(body, rel); after += o.length;
    out += '<script' + attrs + '>' + o.replace(/<\/script/gi, '<\\/script') + '</script>'; }
  fs.writeFileSync(f, out + s.slice(i));
}
console.log(`protect: ${shrunk} scripts shrunk, ${kept} kept as they were; ${(before/1024|0)} KB → ${(after/1024|0)} KB`);
