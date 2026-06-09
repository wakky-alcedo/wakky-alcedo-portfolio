import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Pauseable } from '../utils/visibility';
import { prefersReducedMotion } from '../utils/motionPreference';

gsap.registerPlugin(ScrollTrigger);

/**
 * Works / Blog セクションの横スクロール（GSAPピン固定パターン）。
 * `overflow-x: scroll` を使わず、セクションをピン固定して
 * トラック要素を `x` で横移動させることで iOS Safari の
 * 縦×横スクロール干渉を回避する。
 */
export class HorizontalScroll implements Pauseable {
  private triggers: ScrollTrigger[] = [];

  init(): void {
    if (prefersReducedMotion()) return;

    document.querySelectorAll<HTMLElement>('[data-hscroll]').forEach((section) => {
      const track = section.querySelector<HTMLElement>('[data-hscroll-track]');
      if (!track) return;

      const distance = () => Math.max(0, track.scrollWidth - section.clientWidth);

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${distance()}`,
          scrub: 1,
          pin: true,
          invalidateOnRefresh: true,
        },
      });

      if (tween.scrollTrigger) this.triggers.push(tween.scrollTrigger);
    });
  }

  destroy(): void {
    this.triggers.forEach((trigger) => trigger.kill());
    this.triggers = [];
  }
}

export const horizontalScroll = new HorizontalScroll();
