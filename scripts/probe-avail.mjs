const API='https://api.salla.dev/store/v1', H={'Store-Identifier':'1972477543','Accept':'application/json','Accept-Language':'ar'};
const A='scope=1979508938&allocation_id=975966624&allocation_type=branch';
const j=async u=>{const t=Date.now();const r=await fetch(u,{headers:H});let b=null;try{b=await r.json()}catch(e){}return [r.status,b,Date.now()-t]};
const f=d=>d&&JSON.stringify({q:d.quantity,avail:d.is_available,oos:d.is_out_of_stock,unl:d.unlimited_quantity,status:d.status,can:d.can_add_to_cart,notify:d.notify_availability,msg:d.message});
for(const id of ['320580206','1687118948','1210933938','1526941737','887641898','1493957183']){
  let [s,b,t]=await j(`${API}/products/${id}/details?${A}`);console.log('D+alloc',id,s,t+'ms',b&&b.data?f(b.data):JSON.stringify(b).slice(0,200));
  [s,b]=await j(`${API}/products/${id}/details`);console.log('D plain',id,s,b&&b.data?f(b.data):JSON.stringify(b).slice(0,200));
}
// can several be asked at once? parallel timing for 20 detail calls
const ids='1526941737,887641898,1493957183,2084950838,1667538236,254729022,1027718205,1310913079,112555563,1687118948,1377812839,1826670959,1053681768,878458219,1861748505,137779421,793318537,2031498122,805905147,2066710916'.split(',');
const t0=Date.now();const rs=await Promise.all(ids.map(id=>fetch(`${API}/products/${id}/details?${A}`,{headers:H}).then(r=>r.status).catch(()=>0)));
console.log('PAR20',Date.now()-t0+'ms',JSON.stringify(rs));
