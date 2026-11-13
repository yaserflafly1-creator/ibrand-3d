const API='https://api.salla.dev/store/v1', H={'Store-Identifier':'1972477543','Accept':'application/json','Accept-Language':'ar'};
const j=async u=>{const r=await fetch(u,{headers:H});let b=null;try{b=await r.json()}catch(e){}return [r.status,b]};
const ids=['1687118948','1210933938'];
const q='source=selected&per_page=50&'+ids.map(i=>'source_value[]='+i).join('&');
let [s,b]=await j(`${API}/products?${q}`);
for(const p of b.data||[]){const v=p.branches_v2||[];const c={};v.forEach(x=>{const k=x.visibility+'/'+x.sale_status;c[k]=(c[k]||0)+1});
 console.log('PV',p.id,(p.name||'').slice(0,20),'branches',(p.branches||[]).length,'v2',v.length,JSON.stringify(c));
 console.log('PT',p.id,JSON.stringify(v.filter(x=>/الطائف|الطايف/.test(x.branch_name)).map(x=>[x.branch_name,x.branch_id,x.visibility,x.sale_status])));
 console.log('PK',p.id,JSON.stringify(Object.keys(v[0]||{})), JSON.stringify(v[0]));}
[s,b]=await j(`${API}/branches?per_page=100`);
console.log('BR',JSON.stringify((b.data||[]).filter(x=>/الطائف|الطايف/.test(x.name)).map(x=>[x.id,x.name,Object.keys(x).join(',')])).slice(0,1500));
