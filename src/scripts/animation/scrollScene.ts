import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { kingfisher } from './kingfisher';
import { horizontalScroll } from './horizontalScroll';
import { scrollKingfisher } from './scrollKingfisher';
import { WaterRipple } from '../canvas/ripple';
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

  const canvas = document.getElementById('water-surface');
  if (canvas instanceof HTMLCanvasElement) {
    modules.push(new WaterRipple(canvas));
  }

  modules.forEach((module) => module.init());
  setupVisibility(modules);

  ScrollTrigger.refresh();
}
