import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { kingfisher } from './kingfisher';
import { scrollKingfisher } from './scrollKingfisher';
import { WaterRipple } from '../canvas/ripple';
import { FishSimulation } from '../canvas/fish';
import { CausticsEffect } from '../canvas/caustics';
import { setupVisibility, type SceneModule } from '../utils/visibility';
import type { CanvasAnimation } from '../canvas/canvasAnimation';

let started = false;

/**
 * シーン全体のオーケストレーター。各モジュールは init/destroy のみで自己完結する。
 * タブ非表示中は Canvas の描画ループだけを pause する（GSAP は rAF ごと止まるため対象外）。
 * window.load 後に呼び出し、画像ロード完了後に ScrollTrigger.refresh() する。
 */
export function initScrollScene(): void {
  if (started) return;
  started = true;

  const canvases: CanvasAnimation[] = [];

  const rippleCanvas = document.getElementById('water-surface');
  if (rippleCanvas instanceof HTMLCanvasElement) {
    canvases.push(new WaterRipple(rippleCanvas));
  }

  const causticsCanvas = document.getElementById('caustics-layer');
  if (causticsCanvas instanceof HTMLCanvasElement) {
    canvases.push(new CausticsEffect(causticsCanvas));
  }

  const fishCanvas = document.getElementById('fish-layer');
  if (fishCanvas instanceof HTMLCanvasElement) {
    canvases.push(new FishSimulation(fishCanvas));
  }

  const modules: SceneModule[] = [kingfisher, scrollKingfisher, ...canvases];
  modules.forEach((module) => module.init());
  setupVisibility(canvases);

  ScrollTrigger.refresh();
}
