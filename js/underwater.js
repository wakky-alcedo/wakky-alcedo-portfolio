(function () {
  'use strict';

  // ── Performance budget ────────────────────────────────────────────────────
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile      = navigator.maxTouchPoints > 0;

  function getAnimLevel() {
    if (reducedMotion) return 0;
    if (navigator.hardwareConcurrency <= 2) return 1;
    // getBattery is async; check later in init
    if (isMobile) return 2;
    return 3;
  }

  let animLevel = getAnimLevel();

  // Check battery status asynchronously and downgrade if low
  if (navigator.getBattery) {
    navigator.getBattery().then(bat => {
      if (!bat.charging && bat.level < 0.2) animLevel = Math.min(animLevel, 1);
    });
  }

  if (animLevel === 0) return; // prefers-reduced-motion: do nothing

  const FISH_COUNT   = animLevel >= 3 ? 12 : (animLevel === 2 ? 6 : 3);
  const BUBBLE_COUNT = animLevel >= 3 ? 60 : (animLevel === 2 ? 30 : 0);
  const FLEE_RADIUS  = 150;
  const FLEE_SPEED   = 3.5;

  // ── Canvas setup ──────────────────────────────────────────────────────────
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  const canvas = document.getElementById('uwCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;

  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    W   = mainContent.offsetWidth;
    H   = mainContent.scrollHeight;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    rebuildCardZones();
  }

  const ro = new ResizeObserver(() => resizeCanvas());
  ro.observe(mainContent);

  // ── Card dead-zones (fish don't flee near cards) ──────────────────────────
  let cardZones = [];

  function rebuildCardZones() {
    cardZones = [];
    const cards = mainContent.querySelectorAll('.portfolio-card, .blog-item');
    const mainTop = mainContent.getBoundingClientRect().top + window.scrollY;
    cards.forEach(card => {
      const r = card.getBoundingClientRect();
      cardZones.push({
        x: r.left,
        y: r.top + window.scrollY - mainTop,
        w: r.width,
        h: r.height,
      });
    });
  }

  function inCardZone(mx, my) {
    for (const z of cardZones) {
      if (mx >= z.x - 10 && mx <= z.x + z.w + 10 &&
          my >= z.y - 10 && my <= z.y + z.h + 10) return true;
    }
    return false;
  }

  // ── Fish ──────────────────────────────────────────────────────────────────
  const FISH_COLORS = [
    { body: 'rgba(0,180,216,0.65)',   tail: 'rgba(0,150,185,0.55)' },
    { body: 'rgba(255,107,53,0.55)',  tail: 'rgba(220,80,30,0.48)' },
    { body: 'rgba(80,200,200,0.55)',  tail: 'rgba(60,170,170,0.45)' },
  ];

  function makeFish() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return {
      x:          Math.random() * W,
      y:          Math.random() * H,
      vx:         dir * (0.4 + Math.random() * 1.0),
      vy:         (Math.random() - 0.5) * 0.4,
      size:       9 + Math.random() * 14,
      color:      FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)],
      turnTimer:  200 + Math.random() * 400,
      fleeing:    false,
    };
  }

  const fish = Array.from({ length: FISH_COUNT }, makeFish);

  // ── Bubbles ───────────────────────────────────────────────────────────────
  const bubbles = Array.from({ length: BUBBLE_COUNT }, () => ({
    x:       Math.random() * W,
    y:       Math.random() * H,
    r:       1.5 + Math.random() * 3.5,
    vx:      (Math.random() - 0.5) * 0.3,
    vy:      -(0.3 + Math.random() * 0.5),
    wobble:  Math.random() * Math.PI * 2,
    wobbleS: 0.018 + Math.random() * 0.018,
    a:       0.12 + Math.random() * 0.28,
  }));

  // ── Mouse tracking ────────────────────────────────────────────────────────
  let mouseX = -999, mouseY = -999;
  let lastMoveTime = 0;
  const isTopPage = !document.body.dataset.page || document.body.dataset.page !== 'article';

  if (isTopPage) {
    document.addEventListener('mousemove', e => {
      const now = Date.now();
      if (now - lastMoveTime < 16) return; // ~60fps throttle
      lastMoveTime = now;
      const mainRect = mainContent.getBoundingClientRect();
      mouseX = e.clientX - mainRect.left;
      mouseY = e.clientY - mainRect.top + window.scrollY - (mainContent.offsetTop || 0);
    }, { passive: true });

    mainContent.addEventListener('click', e => {
      const mainRect = mainContent.getBoundingClientRect();
      const cx = e.clientX - mainRect.left;
      const cy = e.clientY - mainRect.top + window.scrollY - (mainContent.offsetTop || 0);
      // Scatter all fish within 250px
      fish.forEach(f => {
        const dx = f.x - cx, dy = f.y - cy;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < 250) {
          const nd  = d || 1;
          f.vx = (dx / nd) * FLEE_SPEED * 1.4;
          f.vy = (dy / nd) * FLEE_SPEED * 1.4;
          f.fleeing = true;
        }
      });
      // Bubble burst at click
      addBurstBubbles(cx, cy, 8);
    });
  }

  // ── Burst bubbles on click ────────────────────────────────────────────────
  let burstBubbles = [];

  function addBurstBubbles(x, y, n) {
    for (let i = 0; i < n; i++) {
      const ang = (Math.random() * Math.PI * 2);
      const spd = 1 + Math.random() * 2.5;
      burstBubbles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1.5,
        r:  1.5 + Math.random() * 3,
        a:  0.8,
      });
    }
  }

  // ── Device orientation (tilt) ─────────────────────────────────────────────
  let tiltGamma = 0;

  function enableTilt() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(state => {
          if (state === 'granted') setupTiltListener();
        })
        .catch(() => {});
    } else {
      setupTiltListener();
    }
  }

  function setupTiltListener() {
    window.addEventListener('deviceorientation', e => {
      tiltGamma = (e.gamma || 0) / 90; // normalise to -1..1
    }, { passive: true });
    localStorage.setItem('alcedoTiltEnabled', '1');
    const toggle = document.getElementById('enableTilt');
    if (toggle) toggle.checked = true;
  }

  // Wire up footer toggle (injected by index.html)
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('enableTilt');
    if (!toggle) return;
    if (localStorage.getItem('alcedoTiltEnabled') === '1') {
      toggle.checked = true;
      setupTiltListener();
    }
    toggle.addEventListener('change', () => {
      if (toggle.checked) enableTilt();
      else {
        tiltGamma = 0;
        localStorage.removeItem('alcedoTiltEnabled');
      }
    });
  });

  // ── Update ────────────────────────────────────────────────────────────────
  function update() {
    // Bubbles
    bubbles.forEach(b => {
      b.x += b.vx + Math.sin(b.wobble) * 0.35;
      b.y += b.vy;
      b.wobble += b.wobbleS;
      if (b.y < -b.r * 2) { b.y = H + b.r; b.x = Math.random() * W; }
    });

    // Burst bubbles
    burstBubbles.forEach(b => {
      b.x += b.vx; b.y += b.vy; b.vy -= 0.05; b.a -= 0.03;
    });
    burstBubbles = burstBubbles.filter(b => b.a > 0);

    // Fish
    fish.forEach(f => {
      const canFlee = isTopPage && !inCardZone(mouseX, mouseY);
      const dx = f.x - mouseX;
      const dy = f.y - mouseY;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (canFlee && dist < FLEE_RADIUS) {
        f.fleeing = true;
        const nd = dist || 1;
        f.vx = (dx / nd) * FLEE_SPEED;
        f.vy = (dy / nd) * FLEE_SPEED;
      } else if (f.fleeing && dist > FLEE_RADIUS * 1.5) {
        f.fleeing = false;
      }

      if (!f.fleeing) {
        // Tilt gravity
        if (Math.abs(tiltGamma) > 0.02) f.vx += tiltGamma * 0.12;

        f.turnTimer--;
        if (f.turnTimer <= 0) {
          f.vy += (Math.random() - 0.5) * 0.5;
          f.vy  = Math.max(-1.2, Math.min(1.2, f.vy));
          f.turnTimer = 200 + Math.random() * 400;
        }

        // Soft edge repulsion
        if (f.x < 80)  f.vx += 0.06;
        if (f.x > W-80) f.vx -= 0.06;
        if (f.y < 60)  f.vy += 0.04;
        if (f.y > H-60) f.vy -= 0.04;
      }

      f.x  += f.vx;
      f.y  += f.vy;
      f.vx *= 0.98;
      f.vy *= 0.98;
    });
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function drawFish(f) {
    const facing = f.vx >= 0 ? 1 : -1;
    const s = f.size;
    ctx.save();
    ctx.translate(f.x, f.y);
    if (facing < 0) ctx.scale(-1, 1);

    // Body
    ctx.beginPath();
    if (ctx.ellipse) {
      ctx.ellipse(0, 0, s, s * 0.38, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
    }
    ctx.fillStyle = f.color.body;
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, 0);
    ctx.lineTo(-s * 1.4, -s * 0.45);
    ctx.lineTo(-s * 1.4,  s * 0.45);
    ctx.closePath();
    ctx.fillStyle = f.color.tail;
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(s * 0.5, -s * 0.1, s * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    ctx.restore();
  }

  function drawBubble(b) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(100,200,255,${b.a})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    bubbles.forEach(drawBubble);
    burstBubbles.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(120,210,255,${b.a})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });
    fish.forEach(drawFish);
  }

  // ── RAF loop ──────────────────────────────────────────────────────────────
  let running = true;

  function loop() {
    if (!running) return;
    const raf = window.alcedoRAF;
    if (!raf || raf.uwActive) {
      update();
      draw();
    }
    requestAnimationFrame(loop);
  }

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(loop);
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  resizeCanvas();
  requestAnimationFrame(loop);

})();
