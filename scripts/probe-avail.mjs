const API='https://api.salla.dev/store/v1', H={'Store-Identifier':'1972477543','Accept':'application/json','Accept-Language':'ar'};
const A='&scope=1979508938&allocation_id=975966624&allocation_type=branch';
const ids=['1687118948','1377812839','1826670959','1053681768','878458219'];
const j=async u=>{const r=await fetch(u,{headers:H});let b=null;try{b=await r.json()}catch(e){}return [r.status,b]};
const pick=p=>p&&({id:p.id,name:(p.name||'').slice(0,30),is_available:p.is_available,is_out_of_stock:p.is_out_of_stock,quantity:p.quantity,status:p.status,sold_quantity:p.sold_quantity,keys:Object.keys(p).filter(k=>/avail|stock|quant|branch|alloc|scope|notify/i.test(k))});
for(const id of ids.slice(0,3)){
  let [s,b]=await j(`${API}/products/${id}?x=1${A}`);console.log('DETAIL+alloc',id,s,JSON.stringify(b&&b.data?pick(b.data):b).slice(0,400));
  [s,b]=await j(`${API}/products/${id}`);console.log('DETAIL plain',id,s,JSON.stringify(b&&b.data?pick(b.data):b).slice(0,400));
}
const q='source=selected&per_page=50&'+ids.map(i=>'source_value[]='+i).join('&');
let [s,b]=await j(`${API}/products?${q}${A}`);console.log('LIST selected+alloc',s,JSON.stringify((b&&b.data||[]).map(pick)).slice(0,1500));
[s,b]=await j(`${API}/products?${q}`);console.log('LIST selected plain',s,JSON.stringify((b&&b.data||[]).map(pick)).slice(0,1500));
// header-style allocation
const r=await fetch(`${API}/products?${q}`,{headers:{...H,'s-scope':'1979508938','Scope':'1979508938','s-allocation-id':'975966624','s-allocation-type':'branch'}});console.log('LIST headers',r.status,JSON.stringify(((await r.json()).data||[]).map(p=>p.id)));
// which category is 'excl'? list first page of a category with alloc for comparison: search by keyword
[s,b]=await j(`${API}/products?source=search&source_value[]=${encodeURIComponent('اكوا دي بارما')}&per_page=20${A}`);console.log('SEARCH+alloc',s,(b&&b.data||[]).length,JSON.stringify((b&&b.data||[]).slice(0,3).map(pick)).slice(0,600));
[s,b]=await j(`${API}/products?source=search&source_value[]=${encodeURIComponent('اكوا دي بارما')}&per_page=20`);console.log('SEARCH plain',s,(b&&b.data||[]).length);
