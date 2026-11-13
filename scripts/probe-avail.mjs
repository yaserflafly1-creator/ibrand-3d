const API='https://api.salla.dev/store/v1', H={'Store-Identifier':'1972477543','Accept':'application/json','Accept-Language':'ar'};
const A='&scope=1979508938&allocation_id=975966624&allocation_type=branch';
const D='&scope=1979508938&allocation_id=1759719263&allocation_type=address';
const ids=['1687118948','1377812839'];
const j=async u=>{const r=await fetch(u,{headers:H});let b=null;try{b=await r.json()}catch(e){}return [r.status,b]};
const q='source=selected&per_page=50&'+ids.map(i=>'source_value[]='+i).join('&');
let [s,b]=await j(`${API}/products?${q}${A}`);
for(const p of b.data||[]) console.log('P+alloc',p.id,JSON.stringify({scope_id:p.scope_id,quantity:p.quantity,unlimited:p.unlimited_quantity,branches:p.branches,branches_v2:p.branches_v2,cats:(p.categories||[]).map(c=>c.id||c)}).slice(0,1800));
[s,b]=await j(`${API}/products?${q}`);
for(const p of b.data||[]) console.log('P plain',p.id,JSON.stringify({scope_id:p.scope_id,branches:p.branches,branches_v2:p.branches_v2}).slice(0,900));
[s,b]=await j(`${API}/products?${q}${D}`);
for(const p of b.data||[]) console.log('P addr',p.id,JSON.stringify({scope_id:p.scope_id,branches:p.branches,branches_v2:p.branches_v2}).slice(0,900));
// a common product for contrast: first product of the whole store with alloc
[s,b]=await j(`${API}/products?per_page=3${A}`);
for(const p of b.data||[]) console.log('ANY+alloc',p.id,(p.name||'').slice(0,25),JSON.stringify({branches:p.branches,branches_v2:p.branches_v2}).slice(0,900));
// category listing counts with/without alloc for each category of the exclusive product
[s,b]=await j(`${API}/products?${q}`);const cats=[...new Set((b.data||[]).flatMap(p=>(p.categories||[]).map(c=>c.id||c)))];console.log('CATS',JSON.stringify(cats));
for(const c of cats.slice(0,3)){for(const [n,x] of [['plain',''],['branch',A],['addr',D]]){const [s2,b2]=await j(`${API}/products?source=categories&source_value[]=${c}&per_page=50${x}`);console.log('CAT',c,n,s2,(b2&&b2.data||[]).length,b2&&b2.cursor&&!!b2.cursor.next, (b2&&b2.data||[]).some(p=>ids.includes(String(p.id))))}}
