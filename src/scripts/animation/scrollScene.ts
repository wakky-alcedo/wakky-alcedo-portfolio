import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { kingfisher } from './kingfisher';
import { horizontalScroll } from './horizontalScroll';
import { scrollKingfisher } from './scrollKingfisher';
import { WaterRipple } from '../canvas/ripple';
import { FishSimulation } from '../canvas/fish';
import { setupVisibility, type Pauseable } from '../utils/visibility';

let started = false;

/**
 * シーン全体のオーケストレーター。各モジュールは init/destroy のみで自己完結する。
 * window.load 後に呼び出し、画像ロード完了後に ScrollTrigger.refresh() する。
 */
export function initScrollScene(): void {
  if (started) return;
  started = true;

  const modules: Pauseable[] = [kingfisher, horizontalScroll, scrollKingfisher];

  const rippleCanvas = document.getElementById('water-surface');
  if (rippleCanvas instanceof HTMLCanvasElement) {
    modules.push(new WaterRipple(rippleCanvas));
  }

  const fishCanvas = document.getElementById('fish-layer');
  if (fishCanvas instanceof HTMLCanvasElement) {
    modules.push(new FishSimulation(fishCanvas));
  }

  modules.forEach((module) => module.init());
  setupVisibility(modules);

  ScrollTrigger.refresh();
}
