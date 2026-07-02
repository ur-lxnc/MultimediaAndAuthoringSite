/* =========================================================================
   ROBOT CIRCUIT — animated live-wallpaper background
   -------------------------------------------------------------------------
   Drop this file next to your HTML pages and add ONE line before </body>
   on every page:

       <script src="robot-bg.js" defer></script>

   It injects its own <style>, builds a full-screen <canvas> that sits
   fixed behind everything, and animates a glowing circuit-board network
   with drifting robot silhouettes. It also makes the page's big section
   backgrounds slightly translucent so the wallpaper reads through them,
   and adds a light scroll-reveal + hover "HUD corner" accent to cards.

   Respects prefers-reduced-motion and pauses when the tab is hidden.
   ========================================================================= */
(function () {
  'use strict';

  function init() {
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------- 1. INJECT STYLES ---------------- */
    var style = document.createElement('style');
    style.textContent =
      'html{background:#020b18;}' +
      'body{background:transparent !important;}' +
      '#robot-bg-canvas{position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;display:block;}' +
      /* keep every real top-level section painting above the canvas, but leave nav's own
         fixed positioning untouched */
      'body > *:not(#robot-bg-canvas):not(nav){position:relative;z-index:2;}' +
      /* let the wallpaper read through the big opaque panels */
      '.hero-bg,.page-header,.page-hero,#projects,footer{' +
        'background:rgba(6,17,32,0.82) !important;' +
        'backdrop-filter:blur(4px) saturate(1.1);' +
        '-webkit-backdrop-filter:blur(4px) saturate(1.1);' +
      '}' +
      '.hero-bg{background:' +
        'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(46,143,232,0.14) 0%, transparent 60%),' +
        'radial-gradient(ellipse 50% 40% at 80% 80%, rgba(200,169,110,0.07) 0%, transparent 50%),' +
        'rgba(4,13,26,0.78) !important;' +
      '}' +
      '@media (max-width:700px){' +
        '.hero-bg,.page-header,.page-hero,#projects,footer{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(4,12,24,0.9) !important;}' +
        '#robot-bg-canvas{opacity:0.65;}' +
      '}' +
      /* scroll reveal */
      '.robot-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease;}' +
      '.robot-reveal.robot-in{opacity:1;transform:none;}' +
      /* HUD corner accents echo the circuit-board language on hover */
      '.project-card,.module-card,.tool-card,.step-card,.planet-card{position:relative;}' +
      '.project-card::before,.module-card::before,.tool-card::before,.step-card::before,.planet-card::before,' +
      '.project-card::after,.module-card::after,.tool-card::after,.step-card::after,.planet-card::after{' +
        'content:"";position:absolute;width:14px;height:14px;opacity:0;z-index:3;pointer-events:none;' +
        'transition:opacity .3s ease;' +
      '}' +
      '.project-card::before,.module-card::before,.tool-card::before,.step-card::before,.planet-card::before{' +
        'top:8px;left:8px;border-top:2px solid var(--accent-glow,#3fa0ff);border-left:2px solid var(--accent-glow,#3fa0ff);' +
      '}' +
      '.project-card::after,.module-card::after,.tool-card::after,.step-card::after,.planet-card::after{' +
        'bottom:8px;right:8px;border-bottom:2px solid var(--accent-glow,#3fa0ff);border-right:2px solid var(--accent-glow,#3fa0ff);' +
      '}' +
      '.project-card:hover::before,.project-card:hover::after,' +
      '.module-card:hover::before,.module-card:hover::after,' +
      '.tool-card:hover::before,.tool-card:hover::after,' +
      '.step-card:hover::before,.step-card:hover::after,' +
      '.planet-card:hover::before,.planet-card:hover::after{opacity:1;}' +
      '@media (prefers-reduced-motion: reduce){' +
        '.robot-reveal{opacity:1;transform:none;transition:none;}' +
      '}';
    document.head.appendChild(style);

    /* ---------------- 2. CANVAS SETUP ---------------- */
    var canvas = document.createElement('canvas');
    canvas.id = 'robot-bg-canvas';
    document.body.insertBefore(canvas, document.body.firstChild);
    var ctx = canvas.getContext('2d');
    var W, H, DPR;

    var ACCENT = '46,143,232';
    var GLOW = '63,160,255';
    var GOLD = '200,169,110';

    var nodes = [];
    var traces = [];
    var bots = [];

    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    function pointAt(pts, t) {
      var d1 = dist(pts[0], pts[1]);
      var d2 = dist(pts[1], pts[2]);
      var total = d1 + d2;
      var target = t * total;
      if (target <= d1) {
        var k1 = d1 === 0 ? 0 : target / d1;
        return { x: pts[0].x + (pts[1].x - pts[0].x) * k1, y: pts[0].y + (pts[1].y - pts[0].y) * k1 };
      }
      var k2 = d2 === 0 ? 0 : (target - d1) / d2;
      return { x: pts[1].x + (pts[2].x - pts[1].x) * k2, y: pts[1].y + (pts[2].y - pts[1].y) * k2 };
    }

    function buildCircuit() {
      var cell = Math.max(110, Math.min(170, W / 9));
      var cols = Math.ceil(W / cell) + 2;
      var rows = Math.ceil(H / cell) + 2;
      var grid = [];
      var r, c;
      for (r = 0; r < rows; r++) {
        grid[r] = [];
        for (c = 0; c < cols; c++) {
          grid[r][c] = {
            x: c * cell + (Math.random() - 0.5) * cell * 0.35,
            y: r * cell + (Math.random() - 0.5) * cell * 0.35
          };
        }
      }
      traces = [];
      var rawNodes = [];
      var traceCount = Math.round((cols * rows) / 3.2);
      for (var i = 0; i < traceCount; i++) {
        var rr = Math.floor(Math.random() * (rows - 1));
        var cc = Math.floor(Math.random() * (cols - 1));
        var a = grid[rr][cc];
        var goRight = Math.random() > 0.5;
        var b = goRight ? grid[rr][Math.min(cc + 1, cols - 1)] : grid[Math.min(rr + 1, rows - 1)][cc];
        if (!a || !b) continue;
        var elbow = Math.random() > 0.5 ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
        var pts = [a, elbow, b];
        var len = dist(a, elbow) + dist(elbow, b);
        if (len < 20) continue;
        var hueRoll = Math.random();
        traces.push({
          points: pts,
          speed: 0.09 + Math.random() * 0.12,
          offset: Math.random(),
          hue: hueRoll > 0.85 ? GOLD : (hueRoll > 0.5 ? GLOW : ACCENT)
        });
        rawNodes.push(a, b);
      }
      nodes = rawNodes.filter(function (_, idx) { return idx % 3 === 0; }).map(function (n) {
        return { x: n.x, y: n.y, phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 0.8 };
      });
    }

    function makeBot(x, y, scale) {
      return { x: x, y: y, scale: scale, vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.5) * 0.03, blink: Math.random() * Math.PI * 2 };
    }

    function seedBots() {
      bots = [];
      var count = W < 700 ? 1 : 2;
      for (var i = 0; i < count; i++) {
        bots.push(makeBot(Math.random() * W, Math.random() * H * 0.6 + H * 0.1, 0.7 + Math.random() * 0.6));
      }
    }

    function roundRect(x, y, w, h, rad) {
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
    }

    function drawBot(b, t) {
      var s = b.scale * 34;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.globalAlpha = 0.09;
      ctx.strokeStyle = 'rgba(' + GLOW + ',1)';
      ctx.lineWidth = 1.4;
      roundRect(-s * 0.5, -s * 0.5, s, s * 0.85, s * 0.14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.lineTo(0, -s * 0.75);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -s * 0.8, s * 0.05, 0, Math.PI * 2);
      ctx.stroke();
      var eyeGlow = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.001 + b.blink));
      ctx.globalAlpha = 0.1 + eyeGlow * 0.16;
      ctx.fillStyle = 'rgba(' + GLOW + ',1)';
      ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.05, s * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.05, s * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 1.75);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildCircuit();
      seedBots();
    }

    /* ---------------- 3. RENDER LOOPS ---------------- */
    var running = true;

    function frame(t) {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);

      ctx.lineWidth = 1;
      traces.forEach(function (tr) {
        ctx.beginPath();
        ctx.moveTo(tr.points[0].x, tr.points[0].y);
        ctx.lineTo(tr.points[1].x, tr.points[1].y);
        ctx.lineTo(tr.points[2].x, tr.points[2].y);
        ctx.strokeStyle = 'rgba(' + tr.hue + ',0.10)';
        ctx.stroke();
      });

      nodes.forEach(function (n) {
        var p = 0.5 + 0.5 * Math.sin(t * 0.0006 * n.speed + n.phase);
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + GLOW + ',' + (0.06 + p * 0.22) + ')';
        ctx.arc(n.x, n.y, 1.1 + p * 1.6, 0, Math.PI * 2);
        ctx.fill();
      });

      traces.forEach(function (tr) {
        var tt = (t * 0.00006 * tr.speed + tr.offset) % 1;
        var p = pointAt(tr.points, tt);
        var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
        grad.addColorStop(0, 'rgba(' + tr.hue + ',0.55)');
        grad.addColorStop(1, 'rgba(' + tr.hue + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + tr.hue + ',0.9)';
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      });

      bots.forEach(function (b) {
        b.x += b.vx; b.y += b.vy;
        if (b.x < -60) b.x = W + 60;
        if (b.x > W + 60) b.x = -60;
        if (b.y < -60) b.y = H * 0.7 + 60;
        if (b.y > H * 0.8) b.y = -60;
        drawBot(b, t);
      });

      requestAnimationFrame(frame);
    }

    function drawStatic() {
      ctx.clearRect(0, 0, W, H);
      traces.forEach(function (tr) {
        ctx.beginPath();
        ctx.moveTo(tr.points[0].x, tr.points[0].y);
        ctx.lineTo(tr.points[1].x, tr.points[1].y);
        ctx.lineTo(tr.points[2].x, tr.points[2].y);
        ctx.strokeStyle = 'rgba(' + tr.hue + ',0.09)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      nodes.forEach(function (n) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + GLOW + ',0.15)';
        ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    /* ---------------- 4. INIT + EVENTS ---------------- */
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resize();
        if (prefersReducedMotion) drawStatic();
      }, 200);
    });

    document.addEventListener('visibilitychange', function () {
      running = !document.hidden && !prefersReducedMotion;
      if (running) requestAnimationFrame(frame);
    });

    resize();
    if (prefersReducedMotion) {
      drawStatic();
    } else {
      requestAnimationFrame(frame);
    }

    /* ---------------- 5. SCROLL REVEAL ---------------- */
    var revealTargets = document.querySelectorAll(
      '.content-block, .about-section, .project-card, .module-card, .step-card, .tool-card, .calculator-wrap'
    );
    revealTargets.forEach(function (el) { el.classList.add('robot-reveal'); });

    if ('IntersectionObserver' in window && !prefersReducedMotion) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('robot-in');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealTargets.forEach(function (el) { io.observe(el); });
    } else {
      revealTargets.forEach(function (el) { el.classList.add('robot-in'); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
