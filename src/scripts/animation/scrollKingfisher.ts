import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Pauseable } from '../utils/visibility';
import { prefersReducedMotion } from '../utils/motionPreference';

gsap.registerPlugin(ScrollTrigger);

/**
 * 水中パートの右端スクロールバー役カワセミ。
 * #underwater のスクロール進捗に応じて上下移動し、
 * クリックでトップ（水上）へ浮上する。
 */
export class ScrollKingfisher implements Pauseable {
  private trigger?: ScrollTrigger;
  private el: HTMLElement | null = null;

  init(): void {
    this.el = document.getElementById('scroll-kingfisher');
    const underwater = document.getElementById('underwater');
    if (!this.el || !underwater) return;

    this.el.addEventListener('click', this.handleClick);

    if (prefersReducedMotion()) {
      this.el.classList.add('is-visible');
      return;
    }

    this.trigger = ScrollTrigger.create({
      trigger: underwater,
      start: 'top bottom',
      end: 'bottom bottom',
      onUpdate: (self) => {
        if (!this.el) return;
        const top = 8 + self.progress * 84;
        gsap.set(this.el, { top: `${top}%` });
      },
      onToggle: (self) => {
        this.el?.classList.toggle('is-visible', self.isActive);
      },
    });
  }

  destroy(): void {
    this.trigger?.kill();
    this.el?.removeEventListener('click', this.handleClick);
  }

  private handleClick = (): void => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
}

export const scrollKingfisher = new ScrollKingfisher();
