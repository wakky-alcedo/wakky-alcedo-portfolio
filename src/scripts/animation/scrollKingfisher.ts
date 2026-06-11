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
  private workCards: HTMLAnchorElement[] = [];

  init(): void {
    this.el = document.getElementById('scroll-kingfisher');
    const underwater = document.getElementById('underwater');
    if (!this.el || !underwater) return;

    this.el.addEventListener('click', this.handleClick);

    this.workCards = Array.from(document.querySelectorAll<HTMLAnchorElement>('.work-card'));
    this.workCards.forEach((card) => card.addEventListener('click', this.handleWorkCardClick));

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
    this.workCards.forEach((card) => card.removeEventListener('click', this.handleWorkCardClick));
  }

  private handleClick = (): void => {
    this.playCatchAnimation();
    this.dispatchCatch();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  private handleWorkCardClick = (event: MouseEvent): void => {
    if (prefersReducedMotion()) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const card = event.currentTarget as HTMLAnchorElement;
    event.preventDefault();
    this.playCatchAnimation();
    this.dispatchCatch();
    window.setTimeout(() => {
      window.location.href = card.href;
    }, 400);
  };

  private dispatchCatch(): void {
    if (!this.el) return;
    const rect = this.el.getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent('kingfisher:catch', {
        detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      }),
    );
  }

  private playCatchAnimation(): void {
    if (!this.el || prefersReducedMotion()) return;
    gsap
      .timeline()
      .to(this.el, { scale: 1.3, rotation: -15, duration: 0.15, ease: 'power1.out' })
      .to(this.el, { scale: 1, rotation: 0, duration: 0.35, ease: 'bounce.out' });
  }
}

export const scrollKingfisher = new ScrollKingfisher();
