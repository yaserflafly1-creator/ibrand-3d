const API='https://api.salla.dev/store/v1', H={'Store-Identifier':'1972477543','Accept':'application/json','Accept-Language':'ar'};
const A='scope=1979508938&allocation_id=975966624&allocation_type=branch';
const j=async u=>{const r=await fetch(u,{headers:H});let b=null;try{b=await r.json()}catch(e){}return [r.status,b]};
const all=async q=>{let u=`${API}/products?${q}`,out=[];for(let i=0;u&&i<12;i++){const [s,b]=await j(u);if(!b)break;out.push(...(b.data||[]));u=b.cursor&&b.cursor.next}return out};
const plain=await all('source=categories&source_value[]=155323060&per_page=50');
const br=await all('source=categories&source_value[]=155323060&per_page=50&'+A);
console.log('EXCL plain',plain.length,'branch',br.length,'sandalo in branch list',br.some(p=>String(p.id)==='320580206'),'in plain',plain.some(p=>String(p.id)==='320580206'));
const brIds=new Set(br.map(p=>String(p.id)));
// does the product's own branches list agree with the filtered listing?
let agree=0,dis=0;for(const p of plain){const has=(p.branches||[]).some(x=>String(x.id)==='975966624');if(has===brIds.has(String(p.id)))agree++;else dis++}
console.log('branches-field vs filtered listing agree',agree,'disagree',dis);
for(const p of br.slice(0,3)){const [s,b]=await j(`${API}/products/${p.id}/details?${A}`);console.log('D+alloc of listed',p.id,(p.name||'').slice(0,25),s,b&&b.data?JSON.stringify({q:b.data.quantity}):JSON.stringify(b).slice(0,120))}
const any=await all('per_page=5&'+A);console.log('ANY branch first page',any.length);
for(const p of any.slice(0,3)){const [s,b]=await j(`${API}/products/${p.id}/details?${A}`);console.log('D+alloc any',p.id,(p.name||'').slice(0,25),s,b&&b.data?JSON.stringify({q:b.data.quantity}):JSON.stringify(b).slice(0,120))}
// selected + categories combined? selected with alloc returned everything; try filtering selected via keyword param
const [s3,b3]=await j(`${API}/products?source=selected&source_value[]=320580206&source_value[]=${[...brIds][0]||'1'}&per_page=10&${A}`);console.log('SELECTED+alloc',s3,JSON.stringify((b3.data||[]).map(p=>p.id)));
