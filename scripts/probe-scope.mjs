// One-off probe 4: the store's offer categories (each running offer has its own category) and what a product in one looks like
const API = 'https://api.salla.dev/store/v1', H = { 'Store-Identifier': '1972477543', Accept: 'application/json', 'Accept-Language': 'ar' };
const tree = (await (await fetch(`${API}/categories`, { headers: H })).json()).data || [];
const rows = []; const walk = (n, path) => { const p = path.concat(n.name); rows.push({ id: n.id_, name: n.name, path: p.join(' > '), kids: (n.sub_categories || []).length }); (n.sub_categories || []).forEach(c => walk(c, p)); };
tree.forEach(n => walk(n, []));
console.log('categories', rows.length, 'top', tree.map(n => n.name + '#' + n.id_).join(' | '));
const off = rows.filter(r => /عرض|عروض|خصم|مجان|\+|احصل|اشتر|بندل|bundle|offer|%/i.test(r.path));
off.forEach(r => console.log('OFFCAT', r.id, '|', r.path, '| kids', r.kids));
// count products in each leaf offer category and show how one product carries the offer
for (const r of off.filter(r => !r.kids).slice(0, 40)){
  const j = await (await fetch(`${API}/products?source=categories&source_value[]=${r.id}&per_page=3`, { headers: H })).json();
  const d = (j && j.data) || [];
  console.log('LEAF', r.id, r.name, '| first', d.map(p => p.id + ' ' + (p.name || '').slice(0, 28) + ' price ' + JSON.stringify(p.price && p.price.amount) + ' sale ' + JSON.stringify(p.sale_price && p.sale_price.amount) + ' onSale ' + p.is_on_sale + ' promo ' + JSON.stringify(p.promotion)).join(' || '));
  await new Promise(r => setTimeout(r, 150));
}
const one = off.find(r => !r.kids);
if (one){ const j = await (await fetch(`${API}/products?source=categories&source_value[]=${one.id}&per_page=1`, { headers: H })).json(); const p = j.data && j.data[0];
  if (p){ const d = await (await fetch(`${API}/products/${p.id}/details`, { headers: H })).json(); console.log('DETAILKEYS', Object.keys(d.data || {}).join(','));
    console.log('DETAIL', JSON.stringify(Object.fromEntries(Object.entries(d.data || {}).filter(([k]) => /promo|offer|sale|discount|tag|badge|notify|subtitle/i.test(k)))).slice(0, 1200)); } }
