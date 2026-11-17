// iBrand 3D pharmacy — control-panel backend (Cloudflare Worker).
// Keeps the store's settings and its planogram in a KV namespace, lets signed-in team members change them,
// and serves both publicly to the 3D store.
//
// Bindings (Worker → Settings → Variables / Bindings):
//   KV              KV namespace
//   ADMIN_PASSWORD  secret: password of the built-in user "admin"
//   TOKEN_SECRET    secret: any long random text (signs the sign-in tokens)
// Optional, for "publish this picture to Salla" in the editor. This Worker never keeps or renews Salla tokens:
// it asks the token vault for the current one each time.
//   VAULT_KEY       secret: the key the vault asks for
//   VAULT_URL       (only if it moves) the vault's token address
//   VAULT           service binding to the vault Worker (needed when both Workers are on the same account)
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
// (the same person repeating the same thing within ten minutes — the editor's auto-save — is logged once)
async function log(env, who, what){ const l = await getJ(env, 'log', []); if (l[0] && l[0].who === who && l[0].what === what && Date.now() - Date.parse(l[0].t) < 600000) return; l.unshift({t:new Date().toISOString(), who, what}); await env.KV.put('log', JSON.stringify(l.slice(0, 200))); }

const SALLA = env => String(env.SALLA_API || 'https://api.salla.dev/admin/v2').replace(/\/+$/, '');
async function sallaToken(env){
  if (!env.VAULT_KEY) return {error:'الربط مع سلة غير مهيأ في الخادم بعد', status:503};
  // a key pasted from a right-to-left screen can carry spaces, line ends or invisible direction marks: drop them
  const key = String(env.VAULT_KEY).replace(/[\s\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '');
  if (!key || /[^\x21-\x7e]/.test(key)) return {error:'مفتاح الخزنة في الخادم فيه حروف غير إنجليزية: امسحه والصقه من جديد بزر النسخ', status:503};
  const q = new Request(env.VAULT_URL || 'https://ibrand-vault.ibrandsales.workers.dev/token?app=brand-offers', {headers:{authorization:'Bearer ' + key, accept:'application/json'}});
  let r; try { r = await (env.VAULT ? env.VAULT.fetch(q) : fetch(q)); } catch(e){ return {error:'تعذّر الوصول لخزنة المفاتيح', status:502}; }
  if (r.status === 409) return {error:'ربط سلة يحتاج إعادة تثبيت التطبيق في المتجر', status:409};
  // tell enough to compare with the saved key without showing it: its length and its two ends
  if (r.status === 401) return {error:'الخزنة رفضت المفتاح المحفوظ في VAULT_KEY. طوله ' + key.length + ' حرف، أوله «' + key[0] + '» وآخره «' + key[key.length - 1] + '». قارنه بالمفتاح في مدير كلمات المرور.', status:502};
  if (r.status === 404) return {error:'الخزنة لا تعرف التطبيق أو لم يصلها مفتاح من سلة بعد', status:502};
  if (r.status === 429 || r.status === 503) return {error:'خزنة المفاتيح مشغولة الآن، حاول بعد دقيقة', status:503};
  if (!r.ok) return {error:'خزنة المفاتيح رفضت الطلب (' + r.status + ')', status:502};
  const t = (await r.text()).trim(); let tok = t; try { const j = JSON.parse(t); tok = j.access_token || j.token || (j.data && (j.data.access_token || j.data.token)) || ''; } catch(e){}
  return /^[\w.\-~+\/=]{20,4000}$/.test(tok) ? {token:tok} : {error:'خزنة المفاتيح لم ترجع مفتاحاً صالحاً', status:502};
}

export default {
  async fetch(req, env){
    if (req.method === 'OPTIONS') return new Response(null, {status:204, headers:CORS});
    if (!env.KV || !env.TOKEN_SECRET || !env.ADMIN_PASSWORD) return json({error:'الخادم غير مهيأ: KV و TOKEN_SECRET و ADMIN_PASSWORD مطلوبة'}, 500);
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/', M = req.method;
    try {
      // ---- public: what the 3D store reads ----
      if (M === 'GET' && path === '/public/config') return json(await getJ(env, 'config', {}), 200, {'cache-control':'public, max-age=60'});
      if (M === 'GET' && path === '/public/pg'){ const v = await env.KV.get('pg'); return v ? new Response(v, {headers:{'content-type':'application/json; charset=utf-8', 'cache-control':'public, max-age=60', ...CORS}}) : json({error:'no planogram saved'}, 404); }
      if (M === 'GET' && path.startsWith('/public/img/')){ const id = path.slice(12); if (!/^[a-f0-9]{16,64}$/.test(id)) return json({error:'غير موجود'}, 404);
        const r = await env.KV.getWithMetadata('img:' + id, {type:'arrayBuffer'}); if (!r || !r.value) return json({error:'غير موجود'}, 404);
        return new Response(r.value, {headers:{'content-type':(r.metadata && r.metadata.type) || 'image/webp', 'cache-control':'public, max-age=31536000, immutable', ...CORS}}); }
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
        const quiet = url.searchParams.get('auto') === '1', lastP = +(await env.KV.get('pg:prevAt')) || 0;   // a manual save keeps one step of undo; the editor's auto-publish keeps an hourly one
        if (!quiet || Date.now() - lastP > 3600e3){ const old = await env.KV.get('pg'); if (old){ await env.KV.put('pg:prev', old); await env.KV.put('pg:prevAt', String(Date.now())); } }
        await env.KV.put('pg', JSON.stringify(p)); if (!quiet) await log(env, me.u, 'حفظ المخطط (' + p.f.length + ' وحدة)'); return json({ok:true});
      }
      // ---- the planogram editor's own full state (private: it carries sales figures) and its product pictures ----
      if (M === 'GET' && path === '/editor'){ const v = await env.KV.get('ed'); return v ? new Response(v, {headers:{'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...CORS}}) : json({error:'لا توجد نسخة محفوظة من المحرر بعد'}, 404); }
      if (M === 'PUT' && path === '/editor'){
        const t = await req.text(); if (t.length > 20000000) return json({error:'ملف المحرر أكبر من المسموح'}, 413);
        const d = JSON.parse(t); if (!d || typeof d.fx !== 'object' || !d.zones) return json({error:'ملف محرر غير صالح'}, 400);
        const at = +(await env.KV.get('ed:at')) || 0, base = +url.searchParams.get('base') || 0;
        if (at && base && at > base) return json({error:'في نسخة أحدث محفوظة', code:'conflict', savedAt:at}, 409);
        const last = +(await env.KV.get('ed:prevAt')) || 0;                       // an hourly safety copy
        if (Date.now() - last > 3600e3){ const old = await env.KV.get('ed'); if (old){ await env.KV.put('ed:prev', old); await env.KV.put('ed:prevAt', String(Date.now())); } }
        await env.KV.put('ed', t); await env.KV.put('ed:at', String(+d.savedAt || Date.now())); await log(env, me.u, 'حفظ من محرر المخطط'); return json({ok:true});
      }
      if (M === 'POST' && path === '/img'){
        const buf = await req.arrayBuffer(); if (!buf.byteLength || buf.byteLength > 2000000) return json({error:'الصورة أكبر من 2 ميغا'}, 413);
        const type = (req.headers.get('content-type') || 'image/webp').split(';')[0]; if (!/^image\/(png|jpeg|webp|gif)$/.test(type)) return json({error:'نوع الصورة غير مدعوم'}, 415);
        const id = hex(await crypto.subtle.digest('SHA-256', buf)).slice(0, 32); await env.KV.put('img:' + id, buf, {metadata:{type}}); return json({ref:'/public/img/' + id});
      }
      // ---- Salla: put a picture on a product as its main picture (the product's other pictures stay) ----
      if (M === 'GET' && path === '/salla/status'){ const t = await sallaToken(env); return json(t.token ? {linked:true} : {linked:false, why:t.error}); }
      if (M === 'POST' && path.startsWith('/salla/image/')){
        const id = path.slice(13); if (!/^\d{3,15}$/.test(id)) return json({error:'رقم منتج غير صحيح'}, 400);
        const buf = await req.arrayBuffer(); if (!buf.byteLength || buf.byteLength > 5000000) return json({error:'الصورة أكبر من 5 ميغا'}, 413);
        const type = (req.headers.get('content-type') || '').split(';')[0]; if (!/^image\/(png|jpeg)$/.test(type)) return json({error:'الصورة لازم تكون JPG أو PNG'}, 415);
        const t = await sallaToken(env); if (!t.token) return json({error:t.error}, t.status);
        const fd = new FormData(); fd.append('photo', new Blob([buf], {type}), 'product.' + (type === 'image/png' ? 'png' : 'jpg')); fd.append('default', '1');
        const r = await fetch(SALLA(env) + '/products/' + id + '/images', {method:'POST', headers:{authorization:'Bearer ' + t.token, accept:'application/json'}, body:fd});
        const d = await r.json().catch(() => null);
        if (!r.ok || !d || d.success === false){ const m = d && d.error && (d.error.message || (d.error.fields && JSON.stringify(d.error.fields))) || ''; return json({error:'سلة رفضت الصورة (' + r.status + ')' + (m ? ': ' + m : '')}, 502); }
        await log(env, me.u, 'نشر صورة في سلة للمنتج ' + id);
        const im = d.data && d.data.image || {}; return json({ok:true, url:(im.original && im.original.url) || (d.data && d.data.url) || ''});
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
