// One-off probe 3: how does the storefront API describe offers (1+1, bundles, discounts) on a product?
const API = 'https://api.salla.dev/store/v1', H = { 'Store-Identifier': '1972477543', Accept: 'application/json', 'Accept-Language': 'ar' };
const titles = new Map(); let n = 0, sale = 0, url = `${API}/products?per_page=50`, sample = null;
for (let pg = 0; url && pg < 40; pg++){
  const j = await (await fetch(url, { headers: H })).json(); if (!j || !j.data) break;
  for (const p of j.data){ n++; if (p.is_on_sale) sale++;
    const pr = p.promotion || {}; const t = [pr.title, pr.sub_title].filter(Boolean).join(' / ');
    if (t){ titles.set(t, (titles.get(t) || 0) + 1); if (!sample) sample = p; } }
  url = j.cursor && j.cursor.next; await new Promise(r => setTimeout(r, 120));
}
console.log('scanned', n, 'on sale', sale, 'with promotion text', [...titles.values()].reduce((a, b) => a + b, 0));
[...titles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([t, c]) => console.log('PROMO', c, '|', t));
if (sample) console.log('SAMPLE', JSON.stringify(Object.fromEntries(Object.entries(sample).filter(([k]) => /promo|offer|sale|price|discount|tag|badge/i.test(k)))).slice(0, 900));
for (const u of ['/offers', '/offers?per_page=20', '/products?source=offers&per_page=5', '/products?source=sales&per_page=5', '/special-offers']){
  const r = await fetch(API + u, { headers: H }); const t = await r.text();
  console.log('GET', u, r.status, t.slice(0, 500).replace(/\s+/g, ' '));
}
