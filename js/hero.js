(function () {
  'use strict';

  // ── Time-based background config ──────────────────────────────────────────
  const BG_SCHEDULE = [
    { start:  0, end:  5, src: 'images/bg_sunset.png',  night: true  },
    { start:  5, end:  8, src: 'images/bg_morning.png', night: false },
    { start:  8, end: 17, src: 'images/bg_day.png',     night: false },
    { start: 17, end: 21, src: 'images/bg_sunset.png',  night: false },
    { start: 21, end: 24, src: 'images/bg_sunset.png',  night: true  },
  ];

  function getBgForHour(h) {
    return BG_SCHEDULE.find(b => h >= b.start && h < b.end) || BG_SCHEDULE[2];
  }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const hero        = document.getElementById('hero');
  const heroSticky  = document.getElementById('heroSticky');
  const bgA         = document.getElementById('heroBgA');
  const bgB         = document.getElementById('heroBgB');
  const nightLayer  = document.getElementById('heroNightLayer');
  const canvas      = document.getElementById('heroCanvas');
  const scrollHint  = document.getElementById('scrollHint');
  const textBlock   = document.getElementById('heroTextBlock');
  const clickHint   = document.getElementById('clickHint');
  const ctx         = canvas.getContext('2d');

  // ── Images ────────────────────────────────────────────────────────────────
  const imgPerch = new Image();
  const imgFly   = new Image();
  imgPerch.src = 'images/kawasemi_perch.png';
  imgFly.src   = 'images/kawasemi_fly.png';

  // ── Layout ────────────────────────────────────────────────────────────────
  let W, H, perchX, perchY;

  function resize() {
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width  = W;
    canvas.height = H;
    perchX = W * 0.65;
    perchY = H * 0.36;
  }

  window.addEventListener('resize', resize);

  // ── Scroll progress (0 → 1 through the hero scroll range) ─────────────────
  // hero height = 200vh, so max scroll through hero = 100vh = window.innerHeight
  function heroProgress() {
    return Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
  }

  // ── Background parallax ───────────────────────────────────────────────────
  // bg images are 200vh tall. Shift them up by scrollY so waterline descends
  // through the viewport as the user scrolls.
  function updateBgParallax() {
    const shift = window.scrollY; // 0 to windowHeight (=100vh)
    bgA.style.transform = `translateY(-${shift}px)`;
    bgB.style.transform = `translateY(-${shift}px)`;
  }

  // ── Time-based background crossfade ──────────────────────────────────────
  let activeBg = bgA;
  let inactiveBg = bgB;
  let currentBgCfg = null;

  function applyBackground() {
    const cfg = getBgForHour(new Date().getHours());
    if (currentBgCfg && cfg.src === currentBgCfg.src) return;
    currentBgCfg = cfg;

    inactiveBg.src = cfg.src;
    inactiveBg.onload = () => {
      inactiveBg.style.opacity = '1';
      activeBg.style.opacity   = '0';
      [activeBg, inactiveBg]   = [inactiveBg, activeBg];
    };

    nightLayer.style.opacity = cfg.night ? '1' : '0';
  }

  applyBackground();
  setInterval(applyBackground, 60000);

  // ── Stars (night mode) ────────────────────────────────────────────────────
  const stars = Array.from({ length: 90 }, () => ({
    x:     Math.random(),
    y:     Math.random() * 0.44,
    r:     Math.random() * 1.4 + 0.4,
    base:  Math.random() * 0.5 + 0.3,
    phase: Math.random() * Math.PI * 2,
    spd:   0.0007 + Math.random() * 0.001,
  }));

  // ── Ripples ───────────────────────────────────────────────────────────────
  let ripples = [];

  function addRipples(x, y, n) {
    for (let i = 0; i < (n || 4); i++) {
      ripples.push({
        x:    x + (Math.random() - 0.5) * 50,
        y:    y + (Math.random() - 0.5) * 8,
        r:    0,
        maxR: 30 + Math.random() * 40,
        spd:  20 + Math.random() * 20,
        a:    0.9,
      });
    }
  }

  // ── Splash particles ──────────────────────────────────────────────────────
  let particles = [];

  function splash(x, y) {
    for (let i = 0; i < 25; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const spd = 2 + Math.random() * 6;
      particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: 1.5 + Math.random() * 3, a: 1 });
    }
  }

  // ── Bird ──────────────────────────────────────────────────────────────────
  const bird = {
    x: 0, y: 0,
    angle: 0,
    state: 'perched',      // perched | flyaway | flyback
    facingLeft: false,
    bobT: 0,
    nextAutoFly: randomInterval(),
    splashTriggered: false,
  };

  function randomInterval() { return 30000 + Math.random() * 30000; }

  function birdSize() { return Math.min(W, H) * 0.13; }

  function flyAway() {
    if (bird.state !== 'perched' || heroProgress() > 0.05) return;
    bird.state      = 'flyaway';
    bird.facingLeft = true;
    bird.vx = -(5 + Math.random() * 3);
    bird.vy = -(1.5 + Math.random() * 2);

    setTimeout(() => {
      bird.x = W + 160;
      bird.y = perchY - 40 + (Math.random() - 0.5) * 40;
      bird.facingLeft = true;
      bird.vx = -6;
      bird.vy =  0;
      bird.state = 'flyback';
    }, 4500);
  }

  // Click = fly away (only at top of page)
  heroSticky.addEventListener('click', flyAway);

  // ── Easing helpers ────────────────────────────────────────────────────────
  function easeInCubic(t)    { return t * t * t; }
  function easeInOutQuad(t)  { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }
  function clamp01(v, lo, hi) { return Math.max(0, Math.min(1, (v - lo) / (hi - lo))); }

  // ── Scroll-driven bird position ───────────────────────────────────────────
  // The waterline in canvas-space descends as we scroll:
  //   waterlineCanvasY = H - scrollY   (bg image shifts up by scrollY, waterline was at H)
  // Bird tracks from perch → waterline over the scroll range 0.08..0.60
  // After 0.60 the bird goes below the waterline (underwater).

  let lastSplashProgress = -1;

  function getBirdFromScroll(p) {
    // p = heroProgress() 0..1

    // Waterline descends through the viewport as we scroll
    const waterlineY = H - window.scrollY;   // px in canvas coords

    // --- Phases ---
    const DIVE_START  = 0.08;   // bird starts moving
    const WATER_HIT   = 0.55;   // bird crosses waterline
    const HIDDEN_FROM = 0.62;   // bird fully hidden (underwater)

    if (p <= DIVE_START) {
      // Perched — just bobbing, driven by time
      return {
        x:     perchX,
        y:     perchY + Math.sin(bird.bobT * 0.0018) * 2.5,
        angle: 0,
        show:  true,
        img:   imgPerch,
      };
    }

    // During dive: t goes 0..1 across DIVE_START..WATER_HIT
    const t = clamp01(p, DIVE_START, WATER_HIT);
    const eT = easeInCubic(t);   // accelerating dive

    // Where will the waterline be when the bird "hits" it?
    const waterlineAtHit = H - WATER_HIT * window.innerHeight;

    // X: drift from perch toward center of river
    const x = perchX + (W * 0.48 - perchX) * easeInOutQuad(t) * 0.7;

    // Y: perch → waterline position, accelerating
    const y = perchY + (waterlineAtHit - perchY) * eT;

    // Rotation: 0 → ~85°  (straight down)
    const angle = eT * Math.PI * 0.47;

    // Splash at transition
    if (p >= WATER_HIT && lastSplashProgress < WATER_HIT) {
      splash(x, waterlineAtHit);
      addRipples(x, waterlineAtHit, 6);
    }
    lastSplashProgress = p;

    // Hide once fully underwater
    if (p > HIDDEN_FROM) {
      return { show: false };
    }

    // Slightly past waterline: continue downward
    const postT = clamp01(p, WATER_HIT, HIDDEN_FROM);
    const finalX = x;
    const finalY = waterlineAtHit + postT * H * 0.15;

    return {
      x:     finalX,
      y:     finalY,
      angle: Math.PI * 0.47,
      show:  true,
      img:   imgFly,   // use flying sprite during dive
    };
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt) {
    bird.bobT += dt;
    const p = heroProgress();

    // Fly-away/flyback state machine (independent of scroll)
    switch (bird.state) {
      case 'flyaway':
        bird.x += bird.vx;
        bird.y += bird.vy;
        bird.vy += 0.04;
        break;
      case 'flyback': {
        const dx = perchX - bird.x;
        const dy = perchY - bird.y;
        bird.vx += (dx * 0.05 - bird.vx) * 0.12;
        bird.vy += (dy * 0.05 - bird.vy) * 0.12;
        bird.x  += bird.vx;
        bird.y  += bird.vy;
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
          bird.state = 'perched';
          bird.x = perchX;
          bird.y = perchY;
          bird.facingLeft = false;
        }
        break;
      }
      case 'perched':
        bird.nextAutoFly -= dt;
        if (bird.nextAutoFly <= 0) {
          flyAway();
          bird.nextAutoFly = randomInterval();
        }
        break;
    }

    // Background parallax (CSS transform)
    updateBgParallax();

    // UI fade-ins/outs based on scroll
    const hintOpacity  = Math.max(0, 1 - p * 5);      // fades quickly
    const textOpacity  = Math.max(0, 1 - p * 3);
    scrollHint.style.opacity = hintOpacity;
    textBlock.style.opacity  = textOpacity;
    clickHint.style.opacity  = p < 0.05 ? '1' : '0';

    // Ripples
    ripples.forEach(r => { r.r += r.spd * (dt / 1000); r.a = 1 - r.r / r.maxR; });
    ripples = ripples.filter(r => r.a > 0);

    // Particles
    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.a -= 0.025; });
    particles = particles.filter(p => p.a > 0);
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    // Night stars (drawn in canvas above the night overlay)
    if (currentBgCfg && currentBgCfg.night) {
      for (const s of stars) {
        const alpha = s.base * (0.5 + 0.5 * Math.sin(t * s.spd + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H * 0.5, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,250,230,${alpha})`;
        ctx.fill();
      }
    }

    // Ripples (ellipse = water perspective)
    for (const r of ripples) {
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.28, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${r.a * 0.75})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // Splash droplets
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,235,255,${p.a})`;
      ctx.fill();
    }

    // Bird: fly-away/flyback overrides scroll-driven position
    const p = heroProgress();
    let birdData;

    if (bird.state === 'flyaway' || bird.state === 'flyback') {
      birdData = {
        x:     bird.x,
        y:     bird.y,
        angle: 0,
        show:  true,
        img:   imgFly,
        flipX: bird.facingLeft,
      };
    } else {
      birdData = getBirdFromScroll(p);
      birdData.flipX = false;
    }

    if (birdData.show) {
      const img = birdData.img || imgPerch;
      if (img.complete && img.naturalWidth > 0) {
        const bw = birdSize();
        const bh = img.naturalHeight * (bw / img.naturalWidth);
        ctx.save();
        ctx.translate(birdData.x, birdData.y);
        if (birdData.flipX) ctx.scale(-1, 1);
        if (birdData.angle) ctx.rotate(birdData.angle);
        ctx.drawImage(img, -bw / 2, -bh / 2, bw, bh);
        ctx.restore();
      }
    }
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  let lastT = 0;

  function loop(t) {
    const dt = Math.min(t - lastT, 80);
    lastT = t;
    update(dt);
    draw(t);
    requestAnimationFrame(loop);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  resize();
  // Reset splash tracker on page load
  lastSplashProgress = heroProgress() - 0.01;
  requestAnimationFrame(t => { lastT = t; loop(t); });

})();
