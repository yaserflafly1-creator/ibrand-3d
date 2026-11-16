// iBrand 3D pharmacy — control-panel backend (Cloudflare Worker).
// Keeps the store's settings and its planogram in a KV namespace, lets signed-in team members change them,
// and serves both publicly to the 3D store.
//
// Bindings (Worker → Settings → Variables / Bindings):
//   KV              KV namespace
//   ADMIN_PASSWORD  secret: password of the built-in user "admin"
//   TOKEN_SECRET    secret: any long random text (signs the sign-in tokens)
const CORS = {'access-control-allow-origin':'*', 'access-control-allow-headers':'authorization,content-type', 'access-control-allow-methods':'GET,PUT,POST,DELETE,OPTIONS', 'access-control-max-age':'86400'};
const json = (d, status = 200, h = {}) => new Response(JSON.stringify(d), {status, headers:{'content-type':'application/json; charset=utf-8', ...CORS, ...h}});
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret, text){ const k = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']); return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(text))); }
async function passHash(salt, pass){ let h = enc.encode(salt + ':' + pass); for (let i = 0; i < 2000; i++) h = new Uint8Array(await crypto.subtle.digest('SHA-256', h)); return hex(h); }
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
async function makeToken(env, user, role){ const p = b64u(enc.encode(JSON.stringify({u:user, r:role, exp:Date.now() + 12*3600e3}))); return p + '.' + await hmac(env.TOKEN_SECRET, p); }
async function readToken(env, req){
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || ''); if (!m) return null;
  const [p, sig] = m[1].split('.'); if (!p || !sig || !same(sig, await hmac(env.TOKEN_SECRET, p))) return null;
  try { const d = JSON.parse(new TextDecoder().decode(unb64u(p))); return d.exp > Date.now() ? d : null; } catch(e){ return null; }
}
const getJ = async (env, key, dflt) => { const v = await env.KV.get(key); if (!v) return dflt; try { return JSON.parse(v); } catch(e){ return dflt; } };
async function log(env, who, what){ const l = await getJ(env, 'log', []); l.unshift({t:new Date().toISOString(), who, what}); await env.KV.put('log', JSON.stringify(l.slice(0, 200))); }

export default {
  async fetch(req, env){
    if (req.method === 'OPTIONS') return new Response(null, {status:204, headers:CORS});
    if (!env.KV || !env.TOKEN_SECRET || !env.ADMIN_PASSWORD) return json({error:'الخادم غير مهيأ: KV و TOKEN_SECRET و ADMIN_PASSWORD مطلوبة'}, 500);
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/', M = req.method;
    try {
      // ---- public: what the 3D store reads ----
      if (M === 'GET' && path === '/public/config') return json(await getJ(env, 'config', {}), 200, {'cache-control':'public, max-age=60'});
      if (M === 'GET' && path === '/public/pg'){ const v = await env.KV.get('pg'); return v ? new Response(v, {headers:{'content-type':'application/json; charset=utf-8', 'cache-control':'public, max-age=60', ...CORS}}) : json({error:'no planogram saved'}, 404); }
      if (M === 'GET' && path === '/') return json({ok:true, service:'ibrand-3d control panel'});
      // ---- sign in ----
      if (M === 'POST' && path === '/login'){
        const ip = req.headers.get('cf-connecting-ip') || 'x', fk = 'fail:' + ip, fails = +(await env.KV.get(fk)) || 0;
        if (fails >= 8) return json({error:'محاولات كثيرة. حاول بعد 10 دقائق'}, 429);
        const b = await req.json().catch(() => ({})), user = String(b.user || '').trim().toLowerCase(), pass = String(b.pass || '');
        let role = null;
        if (user === 'admin'){ if (same(await passHash('admin', pass), await passHash('admin', env.ADMIN_PASSWORD))) role = 'admin'; }
        else { const us = await getJ(env, 'users', {}), u = us[user]; if (u && same(await passHash(u.salt, pass), u.hash)) role = u.role || 'editor'; }
        if (!role){ await env.KV.put(fk, String(fails + 1), {expirationTtl:600}); return json({error:'اسم المستخدم أو كلمة المرور غير صحيحة'}, 401); }
        return json({token:await makeToken(env, user, role), user, role});
      }
      // ---- everything below needs a signed-in user ----
      const me = await readToken(env, req); if (!me) return json({error:'سجّل الدخول أولاً'}, 401);
      if (M === 'GET' && path === '/me') return json({user:me.u, role:me.r});
      if (M === 'GET' && path === '/log') return json(await getJ(env, 'log', []));
      if (M === 'PUT' && path === '/config'){
        const t = await req.text(); if (t.length > 300000) return json({error:'الإعدادات أكبر من المسموح'}, 413);
        const c = JSON.parse(t); if (!c || typeof c !== 'object' || Array.isArray(c)) return json({error:'صيغة غير صحيحة'}, 400);
        delete c.api; await env.KV.put('config', JSON.stringify(c)); await log(env, me.u, 'حفظ الإعدادات'); return json({ok:true});
      }
      if (M === 'PUT' && path === '/pg'){
        const t = await req.text(); if (t.length > 6000000) return json({error:'المخطط أكبر من المسموح'}, 413);
        const p = JSON.parse(t); if (!p || !Array.isArray(p.f) || !p.f.length || !p.f.every(f => f && f.c && Array.isArray(f.r) && Array.isArray(f.it))) return json({error:'مخطط غير صالح'}, 400);
        const old = await env.KV.get('pg'); if (old) await env.KV.put('pg:prev', old);            // one step of undo
        await env.KV.put('pg', JSON.stringify(p)); await log(env, me.u, 'حفظ المخطط (' + p.f.length + ' وحدة)' + (url.searchParams.get('note') ? ': ' + url.searchParams.get('note').slice(0, 120) : '')); return json({ok:true});
      }
      if (M === 'POST' && path === '/pg/undo'){ const prev = await env.KV.get('pg:prev'); if (!prev) return json({error:'لا توجد نسخة سابقة'}, 404); const cur = await env.KV.get('pg'); await env.KV.put('pg', prev); if (cur) await env.KV.put('pg:prev', cur); await log(env, me.u, 'تراجع عن آخر حفظ للمخطط'); return json({ok:true}); }
      // ---- admin only ----
      if (me.r !== 'admin') return json({error:'هذه العملية للمدير فقط'}, 403);
      if (M === 'DELETE' && path === '/pg'){ await env.KV.delete('pg'); await log(env, me.u, 'رجوع للمخطط الأصلي'); return json({ok:true}); }
      if (M === 'GET' && path === '/users'){ const us = await getJ(env, 'users', {}); return json(Object.keys(us).map(u => ({user:u, role:us[u].role || 'editor'}))); }
      if (M === 'POST' && path === '/users'){
        const b = await req.json().catch(() => ({})), user = String(b.user || '').trim().toLowerCase(), pass = String(b.pass || '');
        if (!/^[a-z0-9._-]{3,30}$/.test(user) || user === 'admin') return json({error:'اسم المستخدم: 3 إلى 30 حرفاً إنجليزياً أو رقماً'}, 400);
        if (pass.length < 8) return json({error:'كلمة المرور 8 أحرف على الأقل'}, 400);
        const us = await getJ(env, 'users', {}), salt = b64u(crypto.getRandomValues(new Uint8Array(12)));
        us[user] = {salt, hash:await passHash(salt, pass), role:b.role === 'admin' ? 'admin' : 'editor'}; await env.KV.put('users', JSON.stringify(us)); await log(env, me.u, 'إضافة/تحديث مستخدم: ' + user); return json({ok:true});
      }
      if (M === 'DELETE' && path.startsWith('/users/')){ const user = decodeURIComponent(path.slice(7)).toLowerCase(), us = await getJ(env, 'users', {}); delete us[user]; await env.KV.put('users', JSON.stringify(us)); await log(env, me.u, 'حذف مستخدم: ' + user); return json({ok:true}); }
      return json({error:'غير موجود'}, 404);
    } catch(e){ return json({error:'خطأ في الخادم: ' + (e && e.message || e)}, 500); }
  }
};
