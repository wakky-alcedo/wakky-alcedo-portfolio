import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { SceneModule } from '../utils/visibility';
import { prefersReducedMotion } from '../utils/motionPreference';
import { KINGFISHER } from '../../config/scene';

gsap.registerPlugin(ScrollTrigger);

/**
 * カワセミ飛び込み演出。
 * - スクロール連動: hero区間のスクロールに合わせてとまり木→飛び込みへ遷移する
 * - アイドル時: 放置していると周期的に飛び込み→とまり木へ戻る
 */
export class Kingfisher implements SceneModule {
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

    const cfg = KINGFISHER.scrollDive;
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: cfg.scrub,
        onUpdate: (self) => this.handleDiveProgress(self.progress),
      },
    });

    tl.to(bird, { ...cfg.to, ease: 'none' }, 0);
    if (perch) tl.to(perch, { opacity: 0, ease: 'none' }, cfg.perchToDiveAt);
    if (dive) tl.to(dive, { opacity: 1, ease: 'none' }, cfg.perchToDiveAt);
    if (dive) tl.to(dive, { opacity: 0, ease: 'none' }, cfg.diveToFlyAt);
    if (fly) tl.to(fly, { opacity: 1, ease: 'none' }, cfg.diveToFlyAt);
    tl.to(bird, { opacity: 0, ease: 'none' }, cfg.fadeOutAt);

    this.scrollTimeline = tl;
  }

  private handleDiveProgress(progress: number): void {
    const { rippleAt } = KINGFISHER.scrollDive;
    if (!this.hasDived && progress >= rippleAt) {
      this.hasDived = true;
      this.dispatchDive();
    } else if (this.hasDived && progress < rippleAt) {
      this.hasDived = false;
    }
  }

  private dispatchDive(): void {
    window.dispatchEvent(new CustomEvent('kingfisher:dive', { detail: { x: KINGFISHER.diveXRatio } }));
  }

  private resetIdle = (): void => {
    window.clearTimeout(this.idleTimerId);
    const bird = document.getElementById('hero-kingfisher');
    if (bird) this.scheduleIdle(bird);
  };

  private scheduleIdle(bird: HTMLElement): void {
    this.idleTimerId = window.setTimeout(() => this.playIdleDive(bird), KINGFISHER.idleDelayMs);
  }

  private playIdleDive(bird: HTMLElement): void {
    // hero区間外（スクロールが進んでいる）ではアイドル演出をスキップする
    const hero = document.getElementById('hero');
    if (!hero || hero.getBoundingClientRect().bottom <= 0) {
      this.scheduleIdle(bird);
      return;
    }

    const cfg = KINGFISHER.idleDive;
    const caughtFish = Math.random() < cfg.catchChance;

    this.idleTimeline = gsap.timeline({
      onComplete: () => this.scheduleIdle(bird),
    })
      .to(bird, { ...cfg.dip, ease: 'power1.in' })
      .to(bird, { ...cfg.rise, ease: 'power2.out', onStart: () => this.dispatchDive() })
      .to(bird, {
        y: 0,
        rotation: 0,
        duration: cfg.land.duration,
        ease: 'bounce.out',
        delay: caughtFish ? cfg.catchDelay : 0,
      });
  }
}

export const kingfisher = new Kingfisher();
