// local stand-in for Cloudflare (testing only): runs worker.js with an in-memory KV.  node backend/dev-server.mjs [port]
import http from 'node:http'; import worker from './worker.js';
const mem = new Map(), KV = {get:async k => mem.has(k) ? mem.get(k) : null, put:async (k, v) => { mem.set(k, String(v)); }, delete:async k => { mem.delete(k); }};
const env = {KV, ADMIN_PASSWORD:process.env.ADMIN_PASSWORD || 'test-admin-pass', TOKEN_SECRET:'dev-secret'};
http.createServer(async (q, s) => { const chunks = []; for await (const c of q) chunks.push(c);
  const r = await worker.fetch(new Request('http://x' + q.url, {method:q.method, headers:q.headers, body:['GET','HEAD'].includes(q.method) ? undefined : Buffer.concat(chunks)}), env);
  s.writeHead(r.status, Object.fromEntries(r.headers)); s.end(Buffer.from(await r.arrayBuffer())); }).listen(+process.argv[2] || 8822, () => console.log('dev backend on', +process.argv[2] || 8822));
