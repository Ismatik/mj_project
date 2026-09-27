/* MJ effects: nail loader, toast, gold sparkles, count-up, skeleton, blur-up. Respects prefers-reduced-motion. */
(function () {
  if (window.MJ) return;
  var INK = '#26221D', CREAM = '#F2EDE3', GOLD = '#B8A06A', LINE = '#DDD3BF';
  var reduced = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var css = document.createElement('style');
  css.textContent =
    '@keyframes mjShimmer{from{background-position:-400px 0}to{background-position:400px 0}}' +
    '.mj-sk{background:#E4DCC9 linear-gradient(90deg,#E4DCC9 0,#EFE8DA 50%,#E4DCC9 100%) no-repeat;background-size:400px 100%;animation:mjShimmer 1.2s linear infinite}' +
    '@media (prefers-reduced-motion: reduce){.mj-sk{animation:none}}';
  document.head.appendChild(css);

  // Nail loader variants. Each returns {vb, svg, targets}; [data-fill=i] paints, [data-glint=i] shines, brush visits targets[i]
  var uidN = 0;
  function almond(w, h) {
    return 'M0 ' + (-h / 2) + ' C' + (.56 * w) + ' ' + (-.42 * h) + ' ' + (.5 * w) + ' ' + (.26 * h) + ' ' + (.42 * w) + ' ' + (.42 * h) +
      ' Q0 ' + (.56 * h) + ' ' + (-.42 * w) + ' ' + (.42 * h) + ' C' + (-.5 * w) + ' ' + (.26 * h) + ' ' + (-.56 * w) + ' ' + (-.42 * h) + ' 0 ' + (-h / 2) + ' Z';
  }
  function nail(u, i, w, h, fillBase) {
    var p = almond(w, h);
    return '<clipPath id="' + u + 'n' + i + '"><path d="' + p + '"></path></clipPath>' +
      '<path d="' + p + '" fill="' + (fillBase || CREAM) + '" stroke="' + INK + '" stroke-width="1.3"></path>' +
      '<g clip-path="url(#' + u + 'n' + i + ')"><rect data-fill="' + i + '" x="' + (-w / 2 - 1) + '" y="' + (-h / 2 - 1) + '" width="' + (w + 2) + '" height="' + (h + 2) + '" fill="' + INK + '" style="transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(0);transition:transform .34s cubic-bezier(.22,1,.36,1)"></rect></g>' +
      '<path data-glint="' + i + '" d="M' + (-w * .2) + ' ' + (-h * .28) + ' Q' + (-w * .3) + ' 0 ' + (-w * .18) + ' ' + (h * .2) + '" fill="none" stroke="' + GOLD + '" stroke-width="1.6" stroke-linecap="round" style="opacity:0;transition:opacity .3s"></path>';
  }
  var VARIANTS = {
    fan: function (u) {
      var s = '', t = [], px = 85, py = 162, R = 98;
      [-36, -18, 0, 18, 36].forEach(function (d, i) {
        var r = d * Math.PI / 180, x = px + R * Math.sin(r), y = py - R * Math.cos(r);
        s += '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + d + ')">' + nail(u, i, 19, 40) + '</g>';
        t.push({ x: x, y: y - 6 });
      });
      return { vb: '0 0 170 150', svg: s, targets: t };
    },
    tips: function (u) {
      var F = [{ x: 30, top: 86, r: -24, w: 27 }, { x: 62, top: 40, r: -6, w: 25 }, { x: 90, top: 26, r: 0, w: 25 }, { x: 117, top: 38, r: 5, w: 24 }, { x: 142, top: 62, r: 11, w: 21 }];
      var s = '<defs><linearGradient id="' + u + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset=".62" stop-color="#fff"></stop><stop offset="1" stop-color="#000"></stop></linearGradient><mask id="' + u + 'm" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="150"><rect width="170" height="150" fill="url(#' + u + 'g)"></rect></mask></defs><g mask="url(#' + u + 'm)">', t = [];
      F.forEach(function (f, i) {
        var nw = f.w * .64, nh = f.w * 1.02, cy = f.top - 150 + 4 + nh / 2, rr = f.r * Math.PI / 180;
        s += '<g transform="translate(' + f.x + ' 150) rotate(' + f.r + ')"><rect x="' + (-f.w / 2) + '" y="' + (f.top - 150) + '" width="' + f.w + '" height="220" rx="' + (f.w / 2) + '" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="1.3"></rect>' +
          '<g transform="translate(0 ' + cy + ')">' + nail(u, i, nw, nh) + '</g></g>';
        t.push({ x: f.x - cy * Math.sin(rr), y: 150 + cy * Math.cos(rr) - 4 });
      });
      return { vb: '0 0 170 150', svg: s + '</g>', targets: t };
    },
    bottle: function (u) {
      var w = 56, hh = 80, s = '';
      var p = 'M0 ' + (-hh / 2) + ' C' + (.64 * w) + ' ' + (-hh / 2) + ' ' + (.5 * w) + ' ' + (.3 * hh) + ' ' + (.42 * w) + ' ' + (.42 * hh) + ' Q0 ' + (.58 * hh) + ' ' + (-.42 * w) + ' ' + (.42 * hh) + ' C' + (-.5 * w) + ' ' + (.3 * hh) + ' ' + (-.64 * w) + ' ' + (-hh / 2) + ' 0 ' + (-hh / 2) + ' Z';
      s += '<rect x="36" y="34" width="24" height="34" fill="' + INK + '"></rect><rect x="36" y="62" width="24" height="4" fill="' + GOLD + '"></rect>' +
        '<rect x="22" y="68" width="52" height="66" fill="' + INK + '"></rect>' +
        '<rect x="31" y="80" width="34" height="30" fill="none" stroke="' + GOLD + '" stroke-width="1.2"></rect>' +
        '<text x="48" y="100" text-anchor="middle" font-family="Zen Old Mincho,serif" font-size="13" font-weight="600" fill="' + GOLD + '">MJ</text>' +
        '<text x="48" y="124" text-anchor="middle" font-family="Jost,sans-serif" font-size="4.6" letter-spacing="1.2" fill="' + GOLD + '">NOIR LACQUER</text>';
      s += '<g transform="translate(122 84) rotate(8)"><clipPath id="' + u + 'b"><path d="' + p + '"></path></clipPath><path d="' + p + '" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="1.4"></path><g clip-path="url(#' + u + 'b)">';
      for (var i = 0; i < 3; i++) s += '<rect data-fill="' + i + '" x="' + (-w / 2 + i * w / 3 - .5) + '" y="' + (-hh / 2 - 1) + '" width="' + (w / 3 + 1) + '" height="' + (hh + 2) + '" fill="' + INK + '" style="transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(0);transition:transform .4s cubic-bezier(.22,1,.36,1)"></rect>';
      s += '</g><path data-glint="2" d="M' + (-w * .2) + ' ' + (-hh * .3) + ' Q' + (-w * .3) + ' 0 ' + (-w * .18) + ' ' + (hh * .22) + '" fill="none" stroke="' + GOLD + '" stroke-width="2" stroke-linecap="round" style="opacity:0;transition:opacity .4s"></path></g>';
      return { vb: '0 0 170 150', svg: s, targets: [{ x: 106, y: 78 }, { x: 122, y: 74 }, { x: 138, y: 80 }] };
    },
    mono: function (u) {
      var s = '<rect x="55" y="12" width="60" height="54" fill="none" stroke="' + INK + '" stroke-width="2.2"></rect>' +
        '<text x="85" y="50" text-anchor="middle" font-family="Zen Old Mincho,serif" font-size="26" font-weight="600" fill="' + INK + '">MJ</text>' +
        '<text x="85" y="84" text-anchor="middle" font-family="Jost,sans-serif" font-size="7.5" letter-spacing="2.6" fill="' + INK + '">MAVZUNAI JOVID</text>';
      for (var i = 0; i < 5; i++) s += '<g transform="translate(' + (49 + i * 18) + ' 116)">' + nail(u, i, 12, 22) + '</g>';
      return { vb: '0 0 170 150', svg: s, targets: null };
    }
  };
  var BRUSH = '<g data-brush style="transition:transform .28s cubic-bezier(.22,1,.36,1)"><g transform="rotate(28)">' +
    '<path d="M0 0 C-2.6 -4 -3 -9 -2.2 -13 L2.2 -13 C3 -9 2.6 -4 0 0 Z" fill="' + INK + '"></path>' +
    '<rect x="-2.6" y="-19" width="5.2" height="6" fill="' + GOLD + '"></rect>' +
    '<path d="M-2.2 -19 L-1.4 -58 L1.4 -58 L2.2 -19 Z" fill="' + INK + '"></path></g></g>';
  function mountNails(box, variant, opts) {
    opts = opts || {};
    var u = 'mj' + (uidN++), v = (VARIANTS[variant] || VARIANTS.fan)(u);
    box.innerHTML = '<svg viewBox="' + v.vb + '" width="' + (opts.width || 170) + '" height="' + Math.round((opts.width || 170) * 150 / 170) + '" style="overflow:visible;display:block">' + v.svg + (v.targets ? BRUSH : '') + '</svg>';
    var fills = box.querySelectorAll('[data-fill]'), brush = box.querySelector('[data-brush]'), n = fills.length, step = 0, timer = null, alive = true;
    var glint = function (i) { return box.querySelector('[data-glint="' + i + '"]'); };
    var move = function (i) { if (brush && v.targets) { var p = v.targets[i]; brush.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)'; } };
    if (reduced()) { for (var k = 0; k < n; k++) { fills[k].style.transform = 'scaleY(1)'; var g = glint(k); if (g) g.style.opacity = 1; } if (brush) brush.style.display = 'none'; return function () {}; }
    move(0);
    var tick = function () {
      if (!alive) return;
      if (step < n) {
        fills[step].style.transform = 'scaleY(1)';
        var g = glint(step); if (g) setTimeout(function () { g.style.opacity = 1; }, 300);
        step++;
        if (step < n) setTimeout(function () { move(step); }, 260);
        timer = setTimeout(tick, 440);
      } else {
        if (brush) brush.style.transform += ' translate(20px,-24px)';
        timer = setTimeout(function () {
          for (var j = 0; j < n; j++) { fills[j].style.transform = 'scaleY(0)'; var gg = glint(j); if (gg) gg.style.opacity = 0; }
          step = 0; move(0); timer = setTimeout(tick, 480);
        }, 700);
      }
    };
    timer = setTimeout(tick, 250);
    return function () { alive = false; clearTimeout(timer); };
  }
  var loaderEl = null, loaderStop = null;
  function showLoader(label, variant) {
    hideLoader(true);
    variant = variant || window.MJ_LOADER || 'mono';
    var el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:' + CREAM + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;transition:opacity .5s ease;font-family:Jost,sans-serif;color:' + INK;
    el.innerHTML = '<div data-art></div>' + (variant === 'mono' ? '' : '<div style="font-family:\'Zen Old Mincho\',serif;font-size:15px;font-weight:600;letter-spacing:.3em;text-transform:uppercase">Mavzunai Jovid</div>') +
      '<div style="font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:#8F7A4B">' + (label || 'Минутку красоты…') + '</div>';
    document.body.appendChild(el);
    loaderEl = el;
    loaderStop = mountNails(el.querySelector('[data-art]'), variant, { width: 160 });
  }
  function hideLoader(instant) {
    if (loaderStop) loaderStop(); loaderStop = null;
    var el = loaderEl; loaderEl = null;
    if (!el) return;
    if (instant) { el.remove(); return; }
    el.style.opacity = '0'; el.style.pointerEvents = 'none';
    setTimeout(function () { el.remove(); }, 520);
  }
  function runLoader(ms, label, variant) {
    showLoader(label, variant);
    return new Promise(function (res) { setTimeout(function () { hideLoader(); res(); }, reduced() ? Math.min(ms, 500) : ms); });
  }

  // Toast
  var stack = null;
  function toast(msg, kicker) {
    if (!stack) {
      stack = document.createElement('div');
      stack.setAttribute('aria-live', 'polite');
      stack.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:99998;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none';
      document.body.appendChild(stack);
    }
    var t = document.createElement('div');
    t.style.cssText = 'background:' + INK + ';color:' + CREAM + ';padding:14px 20px;font-family:Jost,sans-serif;font-size:13px;font-weight:300;letter-spacing:.03em;display:flex;gap:14px;align-items:baseline;max-width:360px;box-shadow:0 10px 30px rgba(38,34,29,.22);opacity:0;transform:translateY(12px);transition:opacity .35s ease,transform .35s cubic-bezier(.22,1,.36,1)';
    t.innerHTML = '<span style="font-size:9.5px;letter-spacing:.26em;text-transform:uppercase;color:' + GOLD + ';font-weight:500;flex-shrink:0">' + (kicker || 'MJ') + '</span><span></span>';
    t.lastChild.textContent = msg;
    stack.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = 1; t.style.transform = 'none'; });
    setTimeout(function () { t.style.opacity = 0; t.style.transform = 'translateY(8px)'; setTimeout(function () { t.remove(); }, 400); }, 3200);
  }

  // Gold sparkles from a point (or element center)
  function sparkle(x, y) {
    if (x && x.getBoundingClientRect) { var r = x.getBoundingClientRect(); y = r.top + r.height / 2; x = r.left + r.width / 2; }
    if (reduced()) return;
    for (var i = 0; i < 16; i++) {
      var s = document.createElement('div');
      var size = 6 + Math.random() * 8;
      s.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size + 'px;margin:-' + size / 2 + 'px 0 0 -' + size / 2 + 'px;pointer-events:none;z-index:99997;background:' + GOLD + ';clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)';
      document.body.appendChild(s);
      var a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
      var anim = s.animate([
        { transform: 'translate(0,0) scale(.3) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + Math.cos(a) * d + 'px,' + (Math.sin(a) * d - 20) + 'px) scale(1) rotate(90deg)', opacity: 1, offset: .6 },
        { transform: 'translate(' + Math.cos(a) * d * 1.15 + 'px,' + (Math.sin(a) * d + 10) + 'px) scale(.2) rotate(140deg)', opacity: 0 }
      ], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.22,1,.36,1)' });
      (function (el) { anim.onfinish = function () { el.remove(); }; })(s);
    }
  }

  // Count-up: animates the number inside [data-countup] text, keeping prefix/suffix and separators
  function countUp(sel, dur) {
    document.querySelectorAll(sel || '[data-countup]').forEach(function (el) {
      var node = el.firstChild; if (!node || node.nodeType !== 3) return;
      var text = el.getAttribute('data-countup-final') || node.nodeValue;
      el.setAttribute('data-countup-final', text);
      var m = text.match(/^([^\d]*)([\d][\d,.\s]*)(.*)$/); if (!m) return;
      var raw = m[2].trim(), comma = raw.indexOf(',') > -1, dec = /\.\d+$/.test(raw) ? raw.split('.').pop().length : 0;
      var target = parseFloat(raw.replace(/[,\s]/g, '')); if (isNaN(target)) return;
      if (reduced()) { node.nodeValue = text; return; }
      var t0 = performance.now(), D = dur || 1100;
      var fmt = function (v) { var s = v.toFixed(dec); if (comma) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: dec }); return m[1] + s + m[3]; };
      (function frame(now) {
        var p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
        if (el.firstChild !== node) return;
        node.nodeValue = p < 1 ? fmt(target * e) : text;
        if (p < 1) requestAnimationFrame(frame);
      })(t0);
    });
  }

  // Skeleton overlay over an area, then fades to real content
  function skeleton(target, ms) {
    var box = typeof target === 'string' ? document.querySelector(target) : target; if (!box) return Promise.resolve();
    var r = box.getBoundingClientRect(), top = Math.max(0, r.top);
    var el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + top + 'px;width:' + r.width + 'px;height:' + (window.innerHeight - top) + 'px;background:' + CREAM + ';z-index:9000;padding:32px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px;overflow:hidden;transition:opacity .35s ease';
    var row = function (w, h) { return '<div class="mj-sk" style="width:' + w + ';height:' + h + 'px"></div>'; };
    var cards = ''; for (var i = 0; i < 4; i++) cards += '<div class="mj-sk" style="height:96px"></div>';
    var list = ''; for (var j = 0; j < 5; j++) list += '<div style="display:flex;gap:14px;align-items:center;padding:6px 0;border-bottom:1px solid ' + LINE + '"><div class="mj-sk" style="width:36px;height:36px;border-radius:50%"></div><div style="flex:1;display:flex;flex-direction:column;gap:7px">' + row((50 + j * 7) + '%', 11) + row('28%', 9) + '</div>' + row('80px', 22) + '</div>';
    el.innerHTML = row('14%', 10) + row('42%', 30) + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-top:8px">' + cards + '</div><div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">' + list + '</div>';
    document.body.appendChild(el);
    return new Promise(function (res) {
      setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 380); res(); }, reduced() ? 150 : (ms || 520));
    });
  }

  // Blur-up for <image-slot> and <img data-blurup>: blurred until the real image has loaded
  function blurUp(sel) {
    document.querySelectorAll(sel || 'image-slot, img[data-blurup]').forEach(function (el) {
      if (el.__mjBlur) return; el.__mjBlur = true;
      if (reduced()) return;
      el.style.filter = 'blur(18px)'; el.style.transform = 'scale(1.03)';
      el.style.transition = 'filter 1s cubic-bezier(.22,1,.36,1), transform 1s cubic-bezier(.22,1,.36,1)';
      var done = function () { el.style.filter = 'none'; el.style.transform = 'none'; };
      var t0 = Date.now();
      (function check() {
        var img = el.tagName === 'IMG' ? el : (el.shadowRoot && el.shadowRoot.querySelector('img'));
        var src = img && (img.currentSrc || img.getAttribute('src'));
        if ((src && img.complete && img.naturalWidth > 0) || (!src && Date.now() - t0 > 1500) || Date.now() - t0 > 6000) return setTimeout(done, 120);
        setTimeout(check, 120);
      })();
    });
  }

  window.MJ = { mountNails: mountNails, loader: { show: showLoader, hide: hideLoader, run: runLoader }, toast: toast, sparkle: sparkle, countUp: countUp, skeleton: skeleton, blurUp: blurUp, reduced: reduced };
})();
