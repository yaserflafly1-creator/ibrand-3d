const API='https://api.salla.dev/store/v1', H={'Store-Identifier':'1972477543','Accept':'application/json','Accept-Language':'ar'};
const A='scope=1979508938&allocation_id=975966624&allocation_type=branch';
const HH={...H,'s-scope-id':'1979508938','s-scope-type':'scope','s-scope-allocation-type':'branch','s-scope-allocation-id':'975966624'};
let u=`${API}/products?per_page=50`,ps=[];for(let i=0;i<6&&u;i++){const b=await (await fetch(u,{headers:H})).json();ps.push(...b.data);u=b.cursor&&b.cursor.next}
// spread: take every 3rd
const pick=ps.filter((_,i)=>i%3===0).slice(0,90);
const st=async(id,q,h)=>{const r=await fetch(`${API}/products/${id}/details${q?'?'+q:''}`,{headers:h});let b=null;try{b=await r.json()}catch(e){}return [r.status,b&&b.data&&b.data.quantity]};
const res=[];for(let i=0;i<pick.length;i+=10){res.push(...await Promise.all(pick.slice(i,i+10).map(async p=>{const a=await st(p.id,A,H),h=await st(p.id,'',HH),pl=await st(p.id,'',H);return {id:p.id,n:(p.name||'').slice(0,22),inList:(p.branches||[]).some(x=>String(x.id)==='975966624'),q:a,h,pl}})))}
const c={};res.forEach(r=>{const k=`query:${r.q[0]} hdr:${r.h[0]} plain:${r.pl[0]} inBranches:${r.inList}`;c[k]=(c[k]||0)+1});
console.log('COUNTS',JSON.stringify(c));
res.filter(r=>r.q[0]===200||r.h[0]===200).slice(0,8).forEach(r=>console.log('OK',JSON.stringify(r)));
res.slice(0,5).forEach(r=>console.log('ROW',JSON.stringify(r)));
