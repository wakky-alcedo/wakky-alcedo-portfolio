(function () {
  'use strict';

  // ── Shared RAF namespace (underwater.js also reads this) ──────────────────
  window.alcedoRAF = { heroActive: true, uwActive: false };

  // ── Time slot config (CSS variables, no bitmap images) ───────────────────
  const TIME_SLOTS = {
    morning: {
      '--sky-top':      '#FF9A5C',
      '--sky-bottom':   '#FFD49E',
      '--water-top':    '#4ECDC4',
      '--water-bottom': '#0a3040',
      '--mountain-far': '#2a3d4e',
      '--hill-color':   '#1e3028',
      '--shore-color':  '#0d2218',
      '--grass-color':  '#1c4228',
      '--branch-color': '#2a1a0a',
      night: false,
    },
    day: {
      '--sky-top':      '#1E90FF',
      '--sky-bottom':   '#87CEEB',
      '--water-top':    '#006994',
      '--water-bottom': '#021828',
      '--mountain-far': '#1a2d3e',
      '--hill-color':   '#162536',
      '--shore-color':  '#0f2418',
      '--grass-color':  '#1a3d22',
      '--branch-color': '#2a1a0a',
      night: false,
    },
    sunset: {
      '--sky-top':      '#C44A00',
      '--sky-bottom':   '#FF8C42',
      '--water-top':    '#1a3a6e',
      '--water-bottom': '#030e1a',
      '--mountain-far': '#1c1830',
      '--hill-color':   '#14202a',
      '--shore-color':  '#0c1c14',
      '--grass-color':  '#162e1c',
      '--branch-color': '#1e0e04',
      night: false,
    },
    night: {
      '--sky-top':      '#0D0D2B',
      '--sky-bottom':   '#1A1A4E',
      '--water-top':    '#021028',
      '--water-bottom': '#010810',
      '--mountain-far': '#0d1220',
      '--hill-color':   '#0a1018',
      '--shore-color':  '#060e0a',
      '--grass-color':  '#0c1c10',
      '--branch-color': '#14080a',
      night: true,
    },
  };

  const SEASON_CSS = {
    spring: { '--sky-bottom': '#b8d8f8', extra: 'rgba(255,192,203,0.04)' },
    summer: null,
    autumn: { '--sky-bottom': '#c8a070', extra: 'rgba(255,120,40,0.04)' },
    winter: { '--sky-bottom': '#c8d8e8', extra: 'rgba(200,220,255,0.03)' },
  };

  function getTimeSlot(h) {
    if (h >= 5  && h < 8)  return 'morning';
    if (h >= 8  && h < 17) return 'day';
    if (h >= 17 && h < 21) return 'sunset';
    return 'night';
  }

  function getSeason(m) {
    if (m >= 2 && m <= 4)  return 'spring';
    if (m >= 5 && m <= 7)  return 'summer';
    if (m >= 8 && m <= 10) return 'autumn';
    return 'winter';
  }

  function applyEnvCSSVars() {
    const now    = new Date();
    const slot   = getTimeSlot(now.getHours());
    const season = getSeason(now.getMonth());
    const cfg    = TIME_SLOTS[slot];
    const root   = document.documentElement;

    Object.entries(cfg).forEach(([k, v]) => {
      if (k.startsWith('--')) root.style.setProperty(k, v);
    });

    // Seasonal tint overrides
    const sc = SEASON_CSS[season];
    if (sc) {
      Object.entries(sc).forEach(([k, v]) => {
        if (k.startsWith('--')) root.style.setProperty(k, v);
      });
    }

    // Body data attributes for CSS hooks
    document.body.dataset.timeSlot = slot;
    document.body.dataset.season   = season;

    return { slot, season, night: cfg.night };
  }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const hero       = document.getElementById('hero');
  const heroSticky = document.getElementById('heroSticky');
  const canvas     = document.getElementById('heroCanvas');
  const scrollHint = document.getElementById('scrollHint');
  const textBlock  = document.getElementById('heroTextBlock');
  const clickHint  = document.getElementById('clickHint');
  const mainContent = document.getElementById('main-content');
  const ctx        = canvas.getContext('2d');

  // ── Apply environment & replace old bg with SVG ───────────────────────────
  let envState = applyEnvCSSVars();
  setInterval(() => { envState = applyEnvCSSVars(); }, 60000);

  // Remove old bitmap bg elements; insert SVG
  const bgWrap = document.querySelector('.hero-bg-wrap');
  if (bgWrap) {
    bgWrap.innerHTML = `
      <img class="hero-scene-svg" src="images/hero-scene.svg" alt=""
           style="position:absolute;top:0;left:0;width:100%;height:200vh;object-fit:cover;object-position:center top;will-change:transform;">
      <div class="hero-night-layer" id="heroNightLayer" style="position:absolute;inset:0;background:rgba(4,8,24,0.72);transition:opacity 2.5s ease;opacity:0;pointer-events:none;"></div>
    `;
  }

  const sceneSvg   = bgWrap.querySelector('.hero-scene-svg');
  const nightLayer = document.getElementById('heroNightLayer');
  if (envState.night) nightLayer.style.opacity = '1';

  // Fade in main content when hero is fully scrolled
  function checkUwVisible() {
    if (window.scrollY >= window.innerHeight * 0.9) {
      mainContent.classList.add('uw-visible');
      window.alcedoRAF.uwActive = true;
    } else {
      window.alcedoRAF.uwActive = false;
    }
  }
  window.addEventListener('scroll', checkUwVisible, { passive: true });
  checkUwVisible();

  // ── Images ────────────────────────────────────────────────────────────────
  const imgPerch = new Image(); imgPerch.src = 'images/kawasemi_perch.png';
  const imgFly   = new Image(); imgFly.src   = 'images/kawasemi_fly.png';
  const imgDive  = new Image(); imgDive.src  = 'images/kawasemi_dive.png';

  // ── Layout (DPR-aware) ────────────────────────────────────────────────────
  let W, H, dpr, perchX, perchY;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W   = canvas.offsetWidth;
    H   = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    perchX = W * 0.65;
    perchY = H * 0.36;
  }
  window.addEventListener('resize', resize);

  // ── Scroll progress ───────────────────────────────────────────────────────
  function heroProgress() {
    return Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
  }

  // Background parallax (SVG)
  function updateBgParallax() {
    if (sceneSvg) sceneSvg.style.transform = `translateY(-${window.scrollY}px)`;
  }

  // ── Stars ─────────────────────────────────────────────────────────────────
  const stars = Array.from({ length: 90 }, () => ({
    x:     Math.random(),
    y:     Math.random() * 0.44,
    r:     Math.random() * 1.4 + 0.4,
    base:  Math.random() * 0.5 + 0.3,
    phase: Math.random() * Math.PI * 2,
    spd:   0.0007 + Math.random() * 0.001,
  }));

  // ── Ripples & Splash ──────────────────────────────────────────────────────
  let ripples = [], particles = [];

  function addRipples(x, y, n) {
    for (let i = 0; i < (n || 4); i++) {
      ripples.push({
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 8,
        r: 0, maxR: 30 + Math.random() * 40,
        spd: 20 + Math.random() * 20, a: 0.9,
      });
    }
  }

  function splash(x, y) {
    for (let i = 0; i < 25; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const spd = 2 + Math.random() * 6;
      particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: 1.5 + Math.random() * 3, a: 1 });
    }
  }

  // ── Seasonal particles ────────────────────────────────────────────────────
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile      = navigator.maxTouchPoints > 0;
  const animLevel     = reducedMotion ? 0 : (navigator.hardwareConcurrency <= 2 ? 1 : (isMobile ? 2 : 3));

  let seasonParticles = [];

  function initSeasonParticles(season) {
    if (animLevel < 3) return;
    const COUNT = { spring: 20, autumn: 15, winter: 30 };
    const n = COUNT[season] || 0;
    seasonParticles = Array.from({ length: n }, () => makeSeasonParticle(season, true));
  }

  function makeSeasonParticle(season, randomY) {
    const p = {
      season,
      x: Math.random() * W,
      y: randomY ? Math.random() * H : -20,
      vx: (Math.random() - 0.5) * 0.8,
      vy: season === 'winter' ? 0.4 + Math.random() * 0.6 : 0.6 + Math.random() * 1.0,
      angle: Math.random() * Math.PI * 2,
      angleSpd: (Math.random() - 0.5) * 0.04,
      size: season === 'winter' ? 1.5 + Math.random() * 2 : 5 + Math.random() * 7,
      a: 0.5 + Math.random() * 0.5,
      wobble: Math.random() * Math.PI * 2,
    };
    return p;
  }

  function updateSeasonParticles() {
    seasonParticles.forEach(p => {
      p.x += p.vx + Math.sin(p.wobble) * 0.4;
      p.y += p.vy;
      p.angle += p.angleSpd;
      p.wobble += 0.02;
      if (p.y > H + 20) {
        p.x = Math.random() * W;
        p.y = -20;
      }
    });
  }

  function drawSeasonParticles(t) {
    for (const p of seasonParticles) {
      ctx.save();
      ctx.globalAlpha = p.a * 0.7;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.season === 'winter') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220,235,255,0.9)';
        ctx.fill();
      } else if (p.season === 'spring') {
        // Simple 5-petal flower
        for (let i = 0; i < 5; i++) {
          ctx.save();
          ctx.rotate((i / 5) * Math.PI * 2);
          ctx.beginPath();
          ctx.ellipse(0, -p.size * 0.6, p.size * 0.4, p.size * 0.6, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,192,210,0.85)';
          ctx.fill();
          ctx.restore();
        }
      } else if (p.season === 'autumn') {
        // Leaf shape
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.bezierCurveTo(p.size * 0.6, -p.size * 0.5, p.size * 0.7, p.size * 0.3, 0, p.size);
        ctx.bezierCurveTo(-p.size * 0.7, p.size * 0.3, -p.size * 0.6, -p.size * 0.5, 0, -p.size);
        ctx.fillStyle = `rgba(${180 + Math.floor(p.a * 30)},${80 + Math.floor(p.a * 20)},30,0.85)`;
        ctx.fill();
      }

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ── FishCatch module ──────────────────────────────────────────────────────
  const FishCatch = {
    active:    false,
    flopTimer: 0,
    pending:   false,

    onFlyAway() {
      this.pending = Math.random() < 0.30;
    },

    onPerched() {
      if (this.pending) {
        this.active    = true;
        this.flopTimer = 180;
        this.pending   = false;
      }
    },

    update() {
      if (!this.active) return;
      this.flopTimer--;
      if (this.flopTimer <= 0) {
        // Small splash at beak position, then dismiss
        if (bird.state === 'perched') {
          splash(perchX + 18, perchY + 10);
          addRipples(perchX + 18, perchY + 12, 3);
        }
        this.active = false;
      }
    },

    draw(ctx) {
      if (!this.active) return;
      const angle = Math.sin(this.flopTimer * 0.3) * 0.4;
      const bx    = perchX + 18;
      const by    = perchY + 8;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(angle);
      ctx.beginPath();
      if (ctx.ellipse) {
        ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
      }
      ctx.fillStyle = 'rgba(200,225,255,0.9)';
      ctx.fill();
      // Tail
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-16, -4);
      ctx.lineTo(-16, 4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(180,210,240,0.8)';
      ctx.fill();
      ctx.restore();
    },
  };

  // ── Bird ──────────────────────────────────────────────────────────────────
  const bird = {
    x: 0, y: 0, angle: 0,
    state: 'perched',
    facingLeft: false,
    bobT: 0,
    nextAutoFly: randomInterval(),
    splashTriggered: false,
  };

  function randomInterval() { return 30000 + Math.random() * 30000; }
  function birdSize()        { return Math.min(W, H) * 0.13; }

  function flyAway() {
    if (bird.state !== 'perched' || heroProgress() > 0.05) return;
    FishCatch.onFlyAway();
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

  heroSticky.addEventListener('click', flyAway);

  // ── Easing helpers ────────────────────────────────────────────────────────
  function easeInCubic(t)   { return t * t * t; }
  function easeInOutQuad(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }
  function clamp01(v,lo,hi) { return Math.max(0, Math.min(1, (v - lo) / (hi - lo))); }

  // ── Scroll-driven bird ────────────────────────────────────────────────────
  let lastSplashProgress = -1;

  function getBirdFromScroll(p) {
    const waterlineY    = H - window.scrollY;
    const DIVE_START    = 0.08;
    const WATER_HIT     = 0.55;
    const HIDDEN_FROM   = 0.62;

    if (p <= DIVE_START) {
      return {
        x: perchX,
        y: perchY + Math.sin(bird.bobT * 0.0018) * 2.5,
        angle: 0, show: true, img: imgPerch,
      };
    }

    const t  = clamp01(p, DIVE_START, WATER_HIT);
    const eT = easeInCubic(t);
    const waterlineAtHit = H - WATER_HIT * window.innerHeight;
    const x  = perchX + (W * 0.48 - perchX) * easeInOutQuad(t) * 0.7;
    const y  = perchY + (waterlineAtHit - perchY) * eT;
    const targetX = perchX + (W * 0.48 - perchX) * 0.7;
    const dx = targetX - x;
    const dy = waterlineAtHit - y;
    const travelAngle = (dx === 0 && dy === 0) ? Math.PI / 2 : Math.atan2(dy, dx);
    const angle = travelAngle - Math.PI / 2;

    if (p >= WATER_HIT && lastSplashProgress < WATER_HIT) {
      splash(x, waterlineAtHit);
      addRipples(x, waterlineAtHit, 6);
    }
    lastSplashProgress = p;

    if (p > HIDDEN_FROM) return { show: false };

    const postT  = clamp01(p, WATER_HIT, HIDDEN_FROM);
    const finalY = waterlineAtHit + postT * H * 0.15;
    return { x, y: finalY, angle: 0, show: true, img: imgDive };
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt) {
    bird.bobT += dt;
    const p = heroProgress();

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
          bird.x = perchX; bird.y = perchY;
          bird.facingLeft = false;
          FishCatch.onPerched();
        }
        break;
      }
      case 'perched':
        bird.nextAutoFly -= dt;
        if (bird.nextAutoFly <= 0) { flyAway(); bird.nextAutoFly = randomInterval(); }
        break;
    }

    FishCatch.update();
    updateBgParallax();
    updateSeasonParticles();

    const hintOpacity = Math.max(0, 1 - p * 5);
    const textOpacity = Math.max(0, 1 - p * 3);
    scrollHint.style.opacity = hintOpacity;
    textBlock.style.opacity  = textOpacity;
    clickHint.style.opacity  = p < 0.05 ? '1' : '0';

    // Night layer
    if (nightLayer) nightLayer.style.opacity = envState.night ? '1' : '0';

    ripples.forEach(r => { r.r += r.spd * (dt / 1000); r.a = 1 - r.r / r.maxR; });
    ripples = ripples.filter(r => r.a > 0);
    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.a -= 0.025; });
    particles = particles.filter(p => p.a > 0);
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    // Night stars
    if (envState.night) {
      for (const s of stars) {
        const alpha = s.base * (0.5 + 0.5 * Math.sin(t * s.spd + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H * 0.5, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,250,230,${alpha})`;
        ctx.fill();
      }
    }

    // Seasonal particles
    if (animLevel >= 3) drawSeasonParticles(t);

    // Summer heat shimmer (CSS class approach)
    // Applied via body[data-season="summer"] in CSS

    // Ripples
    for (const r of ripples) {
      ctx.beginPath();
      if (ctx.ellipse) {
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.28, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      }
      ctx.strokeStyle = `rgba(255,255,255,${r.a * 0.75})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // Splash
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,235,255,${p.a})`;
      ctx.fill();
    }

    // Bird
    const p = heroProgress();
    let bd;
    if (bird.state === 'flyaway' || bird.state === 'flyback') {
      bd = { x: bird.x, y: bird.y, angle: 0, show: true, img: imgFly, flipX: bird.facingLeft };
    } else {
      bd = getBirdFromScroll(p);
      bd.flipX = false;
    }

    if (bd.show) {
      const img = bd.img || imgPerch;
      if (img.complete && img.naturalWidth > 0) {
        const bw = birdSize();
        const bh = img.naturalHeight * (bw / img.naturalWidth);
        ctx.save();
        ctx.translate(bd.x, bd.y);
        if (bd.flipX) ctx.scale(-1, 1);
        if (bd.angle) ctx.rotate(bd.angle);
        ctx.drawImage(img, -bw / 2, -bh / 2, bw, bh);
        ctx.restore();
      }
    }

    // Fish in beak
    if (bird.state === 'perched') FishCatch.draw(ctx);
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  let lastT = 0;
  let running = true;

  function loop(t) {
    if (!running) return;
    const dt = Math.min(t - lastT, 80);
    lastT = t;
    // Skip hero drawing when far below
    if (window.alcedoRAF.heroActive) {
      update(dt);
      draw(t);
    }
    requestAnimationFrame(loop);
  }

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(t => { lastT = t; loop(t); });
  });

  // Pause hero canvas when scrolled far past hero
  window.addEventListener('scroll', () => {
    window.alcedoRAF.heroActive = window.scrollY < window.innerHeight * 1.3;
  }, { passive: true });

  // ── Init ──────────────────────────────────────────────────────────────────
  resize();
  initSeasonParticles(getSeason(new Date().getMonth()));
  lastSplashProgress = heroProgress() - 0.01;
  requestAnimationFrame(t => { lastT = t; loop(t); });

})();
