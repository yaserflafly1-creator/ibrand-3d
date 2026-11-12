// One-off probe: does Salla's public storefront API report availability for a chosen pickup branch / delivery address?
const API = 'https://api.salla.dev/store/v1', STORE = '1972477543';
const base = { 'Store-Identifier': STORE, 'Accept-Language': 'ar', 'Accept': 'application/json', 'User-Agent': 'ibrand-3d-pharmacy/2.0' };
const IDS = ['2054008175', '230397493', '1912964994'];           // zero stock in the Khalid bin Al-Waleed branch
const BR = '975966624', SC = '1979508938', ADDR = '1759719263';
const q = `scope=${SC}&allocation_id=${BR}&allocation_type=branch`;
const variants = [
  ['plain', '', {}],
  ['query', '?' + q, {}],
  ['hdr S-Scope-Id', '', { 'S-Scope-Id': SC, 'S-Allocation-Id': BR, 'S-Allocation-Type': 'branch' }],
  ['hdr S-Scope', '', { 'S-Scope': SC, 'S-Allocation': BR, 'S-Allocation-Type': 'branch' }],
  ['hdr Scope', '', { 'Scope': SC, 'Allocation-Id': BR, 'Allocation-Type': 'branch' }],
  ['hdr s-branch', '', { 'S-Branch-Id': BR, 'Branch-Id': BR, 'S-Scope-Id': BR }],
  ['query branch', `?branch_id=${BR}&branch=${BR}`, {}],
  ['query addr', `?scope=${SC}&allocation_id=${ADDR}&allocation_type=address`, {}],
];
const pick = p => p && ({ status: p.status, is_available: p.is_available, is_out_of_stock: p.is_out_of_stock, quantity: p.quantity, max_quantity: p.max_quantity, can_add: p.can_add_note === undefined ? undefined : p.can_add_note, keys: Object.keys(p).filter(k => /avail|stock|quant|branch|scope|alloc/i.test(k)).join(',') });
for (const id of IDS){
  for (const [name, qs, h] of variants){
    try {
      const r = await fetch(`${API}/products/${id}/details${qs}`, { headers: { ...base, ...h } });
      const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
      console.log(id, '|', name, '|', r.status, '|', j && j.data ? JSON.stringify(pick(j.data)) : t.slice(0, 160));
    } catch (e){ console.log(id, '|', name, '| error', e.message); }
    await new Promise(r => setTimeout(r, 250));
  }
}
// what does a listing say with the branch in the query?
for (const [name, qs] of [['list plain', ''], ['list query', '&' + q]]){
  const r = await fetch(`${API}/products?per_page=5${qs}`, { headers: base }); const j = await r.json().catch(() => null);
  console.log(name, r.status, j && j.data ? j.data.map(p => p.id + ':' + p.is_available + ':' + p.quantity).join(' ') : '', j && j.cursor ? JSON.stringify(j.cursor).slice(0, 200) : '');
}
// scopes endpoint, if the storefront exposes one
for (const u of ['/scopes', '/store/scopes', '/branches', `/scopes/${SC}`, '/store/info']){
  const r = await fetch(API + u, { headers: base }); const t = await r.text();
  console.log('GET', u, r.status, t.slice(0, 400).replace(/\s+/g, ' '));
}
