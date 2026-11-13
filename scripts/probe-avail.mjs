const API='https://api.salla.dev/store/v1', H={'Store-Identifier':'1972477543','Accept':'application/json','Accept-Language':'ar'};
const j=async u=>{const r=await fetch(u,{headers:H});let b=null;try{b=await r.json()}catch(e){}return [r.status,b]};
const ids='320580206,1526941737,887641898,1493957183,2084950838,1667538236,254729022,1027718205,1310913079,112555563,1687118948,1377812839,1826670959,1053681768,878458219,1861748505,137779421,793318537,2031498122,805905147,2066710916,590973165,1187155495,1012001570,1183474148,130897710,2070326983,1228022052,172988111,621846231,306004901,384886459,1625097604,460586865,755387309,675971456,907896538,289886704,1973228534,1199190775'.split(',');
const q='source=selected&per_page=50&'+ids.map(i=>'source_value[]='+i).join('&');
const [s,b]=await j(`${API}/products?${q}`);let inK=0,n=0;const T={};
for(const p of b.data||[]){n++;const has=(p.branches||[]).some(x=>String(x.id)==='975966624');if(has)inK++;
 (p.branches_v2||[]).filter(x=>/الطائف/.test(x.branch_name)&&x.sale_status==='1').forEach(x=>T[x.branch_name]=(T[x.branch_name]||0)+1);
 if(String(p.id)==='320580206')console.log('SANDALO',has,(p.branches||[]).length,JSON.stringify((p.branches_v2||[]).filter(x=>x.sale_status==='1').map(x=>x.branch_name)));}
console.log('EXCL returned',n,'of',ids.length,'in Khalid',inK,JSON.stringify(T));
