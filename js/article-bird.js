(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Detect image path prefix (root vs subdir)
  const isSubdir = /\/(blog|portfolio)\//.test(location.pathname);
  const imgBase  = isSubdir ? '../images/' : 'images/';

  // ── ① Title perch bird ───────────────────────────────────────────────────
  // Find the first <h1> or element with .post-title / .item-title
  const titleEl = document.querySelector('h1, .post-title, .item-title');

  if (titleEl && !reducedMotion) {
    // Wrap title text in relative container if needed
    if (!titleEl.classList.contains('article-bird-title-wrap')) {
      const wrap = document.createElement('span');
      wrap.className = 'article-bird-title-wrap';
      wrap.style.display = 'inline-block';
      wrap.style.position = 'relative';
      // Move title content into wrap
      while (titleEl.firstChild) wrap.appendChild(titleEl.firstChild);
      titleEl.appendChild(wrap);
    }

    const wrap = titleEl.querySelector('.article-bird-title-wrap');

    const birdImg = document.createElement('img');
    birdImg.src = imgBase + 'kawasemi_perch.png';
    birdImg.alt = '';
    birdImg.className = 'article-bird-perch';
    wrap.appendChild(birdImg);

    // Dive when user first scrolls
    let dived = false;
    const onScroll = () => {
      if (!dived && window.scrollY > 50) {
        dived = true;
        birdImg.classList.add('diving');
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ── ② Footer landing bird ────────────────────────────────────────────────
  // Find the footer element
  const footerEl = document.querySelector('footer');
  if (!footerEl) return;

  // Create footer bird container
  const footerBird = document.createElement('div');
  footerBird.className = 'article-bird-footer';

  const birdFooterImg = document.createElement('img');
  birdFooterImg.src = imgBase + 'kawasemi_perch.png';
  birdFooterImg.alt = '';
  birdFooterImg.className = 'article-bird-footer-img';

  // Small fish canvas (fish in beak)
  const fishCanvas = document.createElement('canvas');
  fishCanvas.className = 'article-footer-fish-canvas';
  fishCanvas.width  = 30;
  fishCanvas.height = 20;

  const msg = document.createElement('span');
  msg.className = 'article-bird-footer-msg';
  msg.textContent = '魚、ゲット！';

  footerBird.appendChild(birdFooterImg);
  footerBird.appendChild(fishCanvas);
  footerBird.appendChild(msg);
  footerEl.insertAdjacentElement('beforebegin', footerBird);

  // Draw flopping fish on canvas
  let fishTimer = 0;
  let fishAnimId = null;

  function drawFish(t) {
    const c   = fishCanvas.getContext('2d');
    const w   = fishCanvas.width;
    const h   = fishCanvas.height;
    c.clearRect(0, 0, w, h);
    const angle = Math.sin(t * 0.08) * 0.4;
    c.save();
    c.translate(10, 10);
    c.rotate(angle);
    c.beginPath();
    if (c.ellipse) {
      c.ellipse(0, 0, 9, 3.5, 0, 0, Math.PI * 2);
    } else {
      c.arc(0, 0, 5, 0, Math.PI * 2);
    }
    c.fillStyle = 'rgba(200,225,255,0.9)';
    c.fill();
    // Tail
    c.beginPath();
    c.moveTo(-9, 0); c.lineTo(-15, -4); c.lineTo(-15, 4);
    c.closePath();
    c.fillStyle = 'rgba(170,205,235,0.8)';
    c.fill();
    c.restore();
  }

  function startFishAnim() {
    fishCanvas.classList.add('visible');
    let t = 0;
    const step = () => {
      if (t > 240) {
        // Stop after ~4s
        fishCanvas.classList.remove('visible');
        return;
      }
      drawFish(t++);
      fishAnimId = requestAnimationFrame(step);
    };
    step();
  }

  // Trigger landing when footer area enters viewport
  if (!reducedMotion) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          observer.disconnect();
          // 1. Fly in
          birdFooterImg.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease';
          birdFooterImg.classList.add('landed');
          // 2. Show fish + message after landing
          setTimeout(() => {
            startFishAnim();
            msg.classList.add('visible');
          }, 900);
        }
      });
    }, { threshold: 0.3 });

    observer.observe(footerBird);
  } else {
    // No animation, just show static bird
    birdFooterImg.style.opacity = '1';
    birdFooterImg.style.transform = 'none';
  }

})();
