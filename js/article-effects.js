(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Keyword → CSS class mapping
  const KEYWORD_MAP = [
    { re: /swim|スイム|水泳/i, cls: 'section--swim'  },
    { re: /bike|バイク|自転車/i, cls: 'section--bike' },
    { re: /run|ラン|ランニング/i, cls: 'section--run'  },
  ];

  // Target container: post-body or item-body
  const container = document.getElementById('post-body') || document.getElementById('item-body');
  if (!container) return;

  // Watch for content being populated (md-render.js writes innerHTML asynchronously)
  const observer = new MutationObserver((mutations, obs) => {
    const headings = container.querySelectorAll('h2, h3');
    if (headings.length === 0) return;
    obs.disconnect();
    wrapSections(headings);
  });

  observer.observe(container, { childList: true, subtree: false });

  // Fallback: run immediately if content is already present
  const existing = container.querySelectorAll('h2, h3');
  if (existing.length > 0) wrapSections(existing);

  // ── Section wrapping ──────────────────────────────────────────────────────
  function wrapSections(headings) {
    headings.forEach(heading => {
      // Determine matching class
      const text = heading.textContent || '';
      let cls = null;
      for (const { re, cls: c } of KEYWORD_MAP) {
        if (re.test(text)) { cls = c; break; }
      }
      if (!cls) return;
      // Skip if already wrapped
      if (heading.closest('.section--swim, .section--bike, .section--run')) return;

      // Collect all sibling nodes until next heading of same or higher level
      const tagRank = { H1: 1, H2: 2, H3: 3, H4: 4 };
      const myRank  = tagRank[heading.tagName] || 3;
      const nodes   = [];
      let node = heading.nextSibling;
      while (node) {
        if (node.nodeType === 1 && tagRank[node.tagName] <= myRank) break;
        nodes.push(node);
        node = node.nextSibling;
      }

      // Wrap in section div
      const section = document.createElement('div');
      section.className = cls;
      heading.parentNode.insertBefore(section, heading);
      section.appendChild(heading);
      nodes.forEach(n => section.appendChild(n));
    });

    // Disable animations if prefers-reduced-motion
    if (reducedMotion) {
      const animated = container.querySelectorAll('.section--swim, .section--bike, .section--run');
      animated.forEach(el => el.classList.add('no-anim'));
    }
  }

})();
