// One-off probe 2: can a browser on the 3D store's own address ask Salla about one product's stock (CORS)?
const API = 'https://api.salla.dev/store/v1', STORE = '1972477543', ORIGIN = 'https://yaserflafly1-creator.github.io';
const u = `${API}/products/230397493/details?scope=1979508938&allocation_id=975966624&allocation_type=branch`;
const show = (n, r) => console.log(n, r.status, JSON.stringify(Object.fromEntries([...r.headers].filter(([k]) => /access-control|vary|content-type/i.test(k)))));
show('PRE', await fetch(u, { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'store-identifier,accept-language' } }));
show('GET', await fetch(u, { headers: { Origin: ORIGIN, 'Store-Identifier': STORE, 'Accept-Language': 'ar', Accept: 'application/json' } }));
show('GET-plain', await fetch(`${API}/products/230397493/details`, { headers: { Origin: ORIGIN, 'Store-Identifier': STORE, Accept: 'application/json' } }));
// does a listing drop products the branch does not have? (these three are sold out in the Khalid branch)
for (const [n, q] of [['sel plain', ''], ['sel branch', '&scope=1979508938&allocation_id=975966624&allocation_type=branch']]){
  const r = await fetch(`${API}/products?source=selected&source_value[]=2054008175&source_value[]=230397493&source_value[]=1912964994&source_value[]=1210933938&per_page=20${q}`, { headers: { 'Store-Identifier': STORE, Accept: 'application/json', 'Accept-Language': 'ar' } });
  const j = await r.json().catch(() => null);
  console.log(n, r.status, j && j.data ? j.data.map(p => [p.id, p.is_available, p.is_out_of_stock, p.quantity, p.status].join(':')).join(' | ') : '');
}
const b = await (await fetch(`${API}/branches?per_page=100`, { headers: { 'Store-Identifier': STORE, Accept: 'application/json', 'Accept-Language': 'ar' } })).json();
console.log('branches', b.data.length, JSON.stringify(b.pagination || b.cursor || {}), b.data.slice(0, 3).map(x => [x.id, x.name, x.status, x.pickable, x.city && x.city.name].join(':')).join(' | '));
