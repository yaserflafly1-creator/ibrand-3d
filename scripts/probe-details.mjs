// one-off: what does the public product-details call return (description, rating…)?
import fs from 'node:fs/promises';
const SF = 'https://api.salla.dev/store/v1', H = {'Store-Identifier':'1972477543', 'Accept':'application/json', 'Accept-Language':'ar'};
const j = async u => { const r = await fetch(u, {headers:H}); return {status:r.status, body: await r.json().catch(() => null)}; };
await fs.mkdir('out', {recursive:true});
const l = await j(SF + '/products?per_page=6&sort=bestSell');
const ids = ((l.body && l.body.data) || []).map(p => p.id).slice(0, 4);
await fs.writeFile('out/list.json', JSON.stringify(l, null, 1).slice(0, 60000));
for (const id of ids){
  await fs.writeFile(`out/details-${id}.json`, JSON.stringify(await j(`${SF}/products/${id}/details`), null, 1).slice(0, 120000));
  for (const path of [`/products/${id}/reviews`, `/reviews?items[]=${id}&type=products`, `/products/${id}/details?with[]=rating`])
    await fs.writeFile(`out/x-${id}-${path.replace(/[^a-z]+/gi, '_')}.json`, JSON.stringify(await j(SF + path), null, 1).slice(0, 30000));
}
console.log('ids', ids);
