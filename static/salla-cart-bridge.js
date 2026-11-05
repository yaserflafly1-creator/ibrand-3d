/* iBrand 3D pharmacy → Salla cart bridge.
   Paste this into Salla: Store design → (active theme) → Custom JS.
   When a visitor arrives from the 3D pharmacy with a link like
   https://ibrand.com.sa/ar/cart#ib3d=123:2,456:1
   the listed products are added to their cart, then the cart page opens. */
(function () {
  var m = location.hash.match(/ib3d=([0-9:,]+)/);
  if (!m) return;
  var items = m[1].split(',').slice(0, 60).map(function (s) {
    var a = s.split(':'); return { id: parseInt(a[0], 10), quantity: Math.min(10, Math.max(1, parseInt(a[1], 10) || 1)) };
  }).filter(function (i) { return i.id > 0; });
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  if (!items.length) return;
  var box = document.createElement('div');
  box.setAttribute('style', 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.92);font:700 18px Tahoma,sans-serif;color:#c9518b;direction:rtl');
  box.textContent = 'جاري إضافة منتجاتك من صيدلية اي براند 3D…';
  (document.body || document.documentElement).appendChild(box);
  var tries = 0;
  (function wait() {
    if (window.salla && salla.cart && salla.cart.api && salla.cart.api.addItem) return run();
    if (++tries > 80) { box.remove(); return; }
    setTimeout(wait, 150);
  })();
  function run() {
    var chain = Promise.resolve(), ok = 0;
    items.forEach(function (it) {
      chain = chain.then(function () { return salla.cart.api.addItem({ id: it.id, quantity: it.quantity }).then(function () { ok++; }).catch(function () {}); });
    });
    chain.then(function () {
      box.textContent = ok ? 'تمت إضافة ' + ok + ' منتج إلى سلتك' : 'تعذرت إضافة المنتجات، جرّب مرة ثانية';
      setTimeout(function () { location.replace('/ar/cart'); }, 700);
    });
  }
})();
