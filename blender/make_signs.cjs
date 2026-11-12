// draws the Arabic signs for the Blender model as PNG textures (a browser shapes Arabic correctly)
const { chromium } = require('playwright'); const path = require('path');
const Z = { beauty:['#c53fb4','الجمال والعناية','Beauty Care',['العناية بالبشرة','المكياج','العطور','العناية بالشعر']],
  care:['#f28c1e','العناية الشخصية','Personal Care',['العناية بالفم','الاستحمام','مزيلات العرق','الحلاقة']],
  kids:['#2a6fdb','قسم الأطفال','Kids Care',['حليب الأطفال','الحفاضات','عناية الطفل','الرضاعات']],
  well:['#27a84a','العناية بالصحة','Wellness',['الفيتامينات','المكملات الغذائية','التغذية الرياضية','الأعشاب']],
  rx:['#14a3b5','الدواء والصيدلية','Pharmacy',['الأدوية','الإسعافات الأولية','الأجهزة الطبية','مسكنات الألم']] };
const F = `font-family:'Almarai',Tahoma,sans-serif;`;
const items = [];
for (const [k,[c,ar,en,cats]] of Object.entries(Z)){
  items.push(['zone_'+k, 1024, 384, `<div style="width:1024px;height:384px;background:linear-gradient(135deg,${c},color-mix(in srgb,${c} 72%,#000));display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;${F}"><div style="font-size:128px;font-weight:800;line-height:1.25" dir="rtl">${ar}</div><div style="font-size:54px;font-weight:700;opacity:.92;font-family:Arial">${en}</div></div>`]);
  items.push(['hdr_'+k, 512, 512, `<div style="width:512px;height:512px;background:#fff;${F}">` + cats.map(t => `<div style="height:128px;box-sizing:border-box;border-bottom:14px solid ${c};display:flex;align-items:center;justify-content:center;font-size:58px;font-weight:800;color:${c}" dir="rtl">${t}</div>`).join('') + `</div>`]);
  items.push(['floor_'+k, 1024, 256, `<div style="width:1024px;height:256px;display:flex;align-items:center;justify-content:center;font-size:150px;font-weight:800;color:${c};${F}" dir="rtl">${ar}</div>`]);
}
// wall boards in the style of the real branches: a watercolour splash with a short line, or plain lettering on white
const blob = (cols) => `<div style="position:absolute;left:212px;top:76px;width:600px;height:360px;filter:blur(14px);background:` + [[30,40,cols[0]],[62,34,cols[1]],[48,62,cols[2]],[72,60,cols[0]],[24,66,cols[1]],[50,44,cols[2]]].map(([x,y,c]) => `radial-gradient(ellipse at ${x}% ${y}%, ${c} 0%, ${c}cc 24%, transparent 46%)`).join(',') + `"></div>`;
items.push(['board_1', 1024, 512, `<div style="position:relative;width:1024px;height:512px;background:#fff;${F}">${blob(['#c0669e','#8e4a8f','#d98bb0'])}<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:170px;font-weight:800" dir="rtl">لجمالك</div></div>`]);
items.push(['board_3', 1024, 512, `<div style="width:1024px;height:512px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;${F}"><div style="font-size:190px;font-weight:800;color:#8a8a8a;line-height:1.25" dir="rtl">صحتك</div><div style="font-size:110px;font-weight:800;color:#1f6b45;font-family:Arial">Health</div></div>`]);
// board_2 is the official wordmark (made from the logo file, not drawn here)
items.push(['cashier', 1024, 256, `<div style="width:1024px;height:256px;background:#3b1d36;display:flex;align-items:center;justify-content:center;color:#fff;font-size:120px;font-weight:800;${F}" dir="rtl">الكاشير</div>`]);
(async () => {
  const br = await chromium.launch(); const pg = await br.newPage({deviceScaleFactor:1});
  await pg.setContent(`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&display=swap"><style>body{margin:0;background:transparent}</style></head><body>` + items.map(([n,,,h]) => `<div id="${n}" style="display:inline-block">${h}</div>`).join('') + `</body></html>`, {waitUntil:'load'});
  try { await pg.evaluate(() => Promise.race([document.fonts.load('800 80px "Almarai"'), new Promise(r => setTimeout(r, 4000))])); } catch(e){}
  console.log('almarai:', await pg.evaluate(() => document.fonts.check('800 80px "Almarai"')));
  for (const [n] of items) await (await pg.$('#' + n)).screenshot({path: path.join(__dirname, 'tex', n + '.png'), omitBackground: true});
  await br.close();
})();
