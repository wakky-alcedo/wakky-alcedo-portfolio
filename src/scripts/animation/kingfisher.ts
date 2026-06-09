import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Pauseable } from '../utils/visibility';
import { prefersReducedMotion } from '../utils/motionPreference';

gsap.registerPlugin(ScrollTrigger);

const IDLE_DELAY_MS = 7000;
const DIVE_X_RATIO = 0.72; // 飛び込み位置（hero幅に対する比率）

/**
 * カワセミ飛び込み演出。
 * - スクロール連動: hero区間のスクロールに合わせてとまり木→飛び込みへ遷移する
 * - アイドル時: 放置していると周期的に飛び込み→とまり木へ戻る
 */
export class Kingfisher implements Pauseable {
  private scrollTimeline?: gsap.core.Timeline;
  private idleTimeline?: gsap.core.Timeline;
  private idleTimerId = 0;
  private hasDived = false;
  private active = false;

  init(): void {
    if (this.active) return;
    const hero = document.getElementById('hero');
    const bird = document.getElementById('hero-kingfisher');
    if (!hero || !bird) return;

    this.active = true;

    if (prefersReducedMotion()) return;

    this.setupScrollDive(hero, bird);
    this.scheduleIdle(bird);
    document.addEventListener('scroll', this.resetIdle, { passive: true });
    document.addEventListener('pointermove', this.resetIdle, { passive: true });
  }

  destroy(): void {
    this.active = false;
    this.scrollTimeline?.scrollTrigger?.kill();
    this.scrollTimeline?.kill();
    this.idleTimeline?.kill();
    window.clearTimeout(this.idleTimerId);
    document.removeEventListener('scroll', this.resetIdle);
    document.removeEventListener('pointermove', this.resetIdle);
  }

  private setupScrollDive(hero: HTMLElement, bird: HTMLElement): void {
    const perch = bird.querySelector<HTMLElement>('.hero__bird-img--perch');
    const dive = bird.querySelector<HTMLElement>('.hero__bird-img--dive');
    const fly = bird.querySelector<HTMLElement>('.hero__bird-img--fly');

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.4,
        onUpdate: (self) => this.handleDiveProgress(self.progress),
      },
    });

    tl.to(bird, { x: 80, y: 260, rotation: 50, ease: 'none' }, 0);
    if (perch) tl.to(perch, { opacity: 0, ease: 'none' }, 0.25);
    if (dive) tl.to(dive, { opacity: 1, ease: 'none' }, 0.25);
    if (dive) tl.to(dive, { opacity: 0, ease: 'none' }, 0.6);
    if (fly) tl.to(fly, { opacity: 1, ease: 'none' }, 0.6);
    tl.to(bird, { opacity: 0, ease: 'none' }, 0.85);

    this.scrollTimeline = tl;
  }

  private handleDiveProgress(progress: number): void {
    if (!this.hasDived && progress >= 0.6) {
      this.hasDived = true;
      window.dispatchEvent(new CustomEvent('kingfisher:dive', { detail: { x: DIVE_X_RATIO } }));
    } else if (this.hasDived && progress < 0.6) {
      this.hasDived = false;
    }
  }

  private resetIdle = (): void => {
    window.clearTimeout(this.idleTimerId);
    const bird = document.getElementById('hero-kingfisher');
    if (bird) this.scheduleIdle(bird);
  };

  private scheduleIdle(bird: HTMLElement): void {
    this.idleTimerId = window.setTimeout(() => this.playIdleDive(bird), IDLE_DELAY_MS);
  }

  private playIdleDive(bird: HTMLElement): void {
    // hero区間外（スクロールが進んでいる）ではアイドル演出をスキップする
    const hero = document.getElementById('hero');
    if (!hero || hero.getBoundingClientRect().bottom <= 0) {
      this.scheduleIdle(bird);
      return;
    }

    const caughtFish = Math.random() < 0.4;

    this.idleTimeline = gsap.timeline({
      onComplete: () => this.scheduleIdle(bird),
    })
      .to(bird, { y: 40, rotation: 25, duration: 0.35, ease: 'power1.in' })
      .to(bird, { y: -16, rotation: -10, duration: 0.5, ease: 'power2.out', onStart: () => {
        window.dispatchEvent(new CustomEvent('kingfisher:dive', { detail: { x: DIVE_X_RATIO } }));
      } })
      .to(bird, {
        y: 0,
        rotation: 0,
        duration: 0.4,
        ease: 'bounce.out',
        delay: caughtFish ? 0.15 : 0,
      });
  }
}

export const kingfisher = new Kingfisher();
