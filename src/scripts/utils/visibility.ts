/** シーンを構成するモジュール。scrollScene.ts が init し、自己完結で動く */
export interface SceneModule {
  init(): void;
  destroy(): void;
}

/** タブ非表示中に止めるモジュール（Canvas の描画ループなど）。状態は保持したまま止める */
export interface Pauseable {
  pause(): void;
  resume(): void;
}

/**
 * タブが非表示の間 Pauseable を止める。
 * GSAP（ScrollTrigger）は非表示中は rAF ごと止まるため対象にしない。
 */
export function setupVisibility(modules: Pauseable[]): () => void {
  const handleVisibility = () => {
    if (document.hidden) {
      modules.forEach((m) => m.pause());
    } else {
      modules.forEach((m) => m.resume());
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}
