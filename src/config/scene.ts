/**
 * トップページのシーン演出パラメータ（src/scripts/animation, src/scripts/canvas で使用）。
 * 座標・サイズは CSS px、時間は特記なければ秒。
 */

/** Canvas アニメーション共通（src/scripts/canvas/canvasAnimation.ts） */
export const CANVAS = {
  /** 1フレームの経過時間の上限（s）。タブ復帰直後などの飛びを抑える */
  maxDt: 0.1,
  /** DPR 上限（スマホ / デスクトップ） */
  maxDprMobile: 1.5,
  maxDprDesktop: 2,
} as const;

/** 端末の傾きパララックス（src/scripts/utils/deviceOrientation.ts） */
export const TILT = {
  /** この角度（度）で傾きが最大（±1）になる */
  maxGammaDeg: 30,
  /** 目標値への追従速度（1秒あたりの補間係数） */
  lerpPerSec: 3,
} as const;

/** 魚の Boid シミュレーション（src/scripts/canvas/fish.ts） */
export const FISH = {
  /** scale 1.0 時の表示サイズ */
  baseSize: 48,
  /**
   * 奥（index 0）→ 手前の4レイヤー。
   * densityPerMpx: 画面 100万px² あたりの匹数。
   * scrollFactor: ページスクロール量に対する移動率（1 でコンテンツと同じ速さ）
   * parallaxPx: 傾き最大時の横ずれ量
   */
  layers: [
    { scale: 0.4, blurPx: 3, speed: 22, densityPerMpx: 2.1, scrollFactor: 0.4, parallaxPx: 3 },
    { scale: 0.6, blurPx: 1.5, speed: 32, densityPerMpx: 1.6, scrollFactor: 0.6, parallaxPx: 7 },
    { scale: 0.8, blurPx: 0.5, speed: 44, densityPerMpx: 1.1, scrollFactor: 0.8, parallaxPx: 13 },
    { scale: 1.0, blurPx: 0, speed: 58, densityPerMpx: 0.8, scrollFactor: 1.0, parallaxPx: 20 },
  ],
  /** 各レイヤーの最低匹数 */
  minCountPerLayer: 1,
  /** liteMode で残すレイヤーと、匹数の倍率 */
  liteLayerIndices: [0, 3],
  liteCountRatio: 0.5,
  boid: {
    separationRadius: 28,
    alignmentRadius: 60,
    cohesionRadius: 90,
    separationWeight: 1.4,
    alignmentWeight: 0.03,
    cohesionWeight: 0.004,
    /** 最高速度に対する最低速度の比 */
    minSpeedRatio: 0.4,
    /** 生成時の速度は speed × (minSpawnSpeedRatio〜1) */
    minSpawnSpeedRatio: 0.5,
    /** 進行方向に合わせた体の傾きの倍率 */
    bodyTiltRatio: 0.5,
  },
  /** カーソル・クリックから逃げるレイヤー */
  fleeLayerIndices: [2, 3],
  fleeRadius: 70,
  fleeWeight: 3.5,
  fleeClickRadius: 140,
  /** カワセミがキャッチする魚の探索半径 */
  catchRadius: 90,
} as const;

/** 水中コースティクス（src/scripts/canvas/caustics.ts） */
export const CAUSTICS = {
  /** 画面 100万px² あたりの光の数（通常 / liteMode）と最低数 */
  densityPerMpx: 3.75,
  liteDensityPerMpx: 1.3,
  minCount: 2,
  /** 半径・漂流幅は画面幅に対する比 */
  radiusMin: 0.08,
  radiusMax: 0.2,
  driftAmp: 0.08,
  /** 縦横比（横長の楕円にする） */
  ellipseRatio: 0.65,
  baseAlphaMin: 0.18,
  baseAlphaMax: 0.38,
  radiusPulseDepth: 0.25,
  alphaPulseDepth: 0.35,
  /** 漂流・脈動の角周波数範囲（rad/s） */
  freqMin: 0.18,
  freqMax: 0.55,
  /** ページスクロール量に対する移動率 */
  scrollFactor: 0.5,
  /** 画面外にはみ出してから反対側へ回り込むまでの余白（画面高に対する比） */
  wrapMargin: 0.25,
  tiltParallaxPx: 12,
  /** 0=cyan, 1=blue と、cyan を選ぶ確率 */
  colors: ['#68CED6', '#0063AA'],
  primaryColorChance: 0.7,
  /** 放射グラデーションの中間点（位置, 不透明度） */
  gradientMidStop: [0.4, 0.55],
} as const;

/** 水面の波紋（src/scripts/canvas/ripple.ts） */
export const RIPPLE = {
  /** 自動で波紋を出す間隔（ms） */
  spawnIntervalMinMs: 1800,
  spawnIntervalMaxMs: 3600,
  /** 半径の広がる速さ（px/s）と、不透明度の減衰（/s） */
  growthPxPerSec: 38,
  fadePerSec: 0.18,
  blurPx: 3,
  /** 波紋の中心の高さ（canvas 高に対する比）と楕円の縦横比 */
  centerYRatio: 0.5,
  ellipseRatio: 0.35,
  /** 通常 / カワセミ飛び込み時（maxRadius は canvas 高に対する比） */
  normal: { maxRadius: 0.9, alpha: 0.35, lineWidth: 1.5 },
  big: { maxRadius: 1.6, alpha: 0.55, lineWidth: 3 },
  /** 飛び込みイベントに位置がないときの横位置（canvas 幅に対する比） */
  defaultDiveX: 0.7,
  /** 線色（RGB） */
  colorRgb: '104, 206, 214',
  /** reduced-motion 時の静的グラデーション上端の不透明度 */
  staticAlpha: 0.25,
} as const;

/** ヒーローのカワセミ（src/scripts/animation/kingfisher.ts） */
export const KINGFISHER = {
  /** 放置後にアイドル飛び込みを始めるまで（ms） */
  idleDelayMs: 7000,
  /** 飛び込み位置（hero 幅に対する比） */
  diveXRatio: 0.72,
  /** スクロール連動の飛び込み（タイムライン上の位置は 0〜1） */
  scrollDive: {
    scrub: 0.4,
    to: { x: 80, y: 260, rotation: 50 },
    perchToDiveAt: 0.25,
    diveToFlyAt: 0.6,
    fadeOutAt: 0.85,
    /** この進捗を超えたら水面に波紋を出す */
    rippleAt: 0.6,
  },
  /** アイドル時の飛び込み→戻り */
  idleDive: {
    dip: { y: 40, rotation: 25, duration: 0.35 },
    rise: { y: -16, rotation: -10, duration: 0.5 },
    land: { duration: 0.4 },
    /** 魚を捕まえた演出にする確率と、そのときの着地の遅れ */
    catchChance: 0.4,
    catchDelay: 0.15,
    /** 捕まえた魚を見せる時間（着地後）と、消えるまでの時間 */
    catchHold: 1.5,
    catchFade: 0.4,
  },
} as const;

/** 水中パート右端のカワセミ（src/scripts/animation/scrollKingfisher.ts） */
export const SCROLL_KINGFISHER = {
  /** 上下位置の範囲（ビューポート高に対する %） */
  topMinPct: 8,
  topMaxPct: 92,
  /** Works カードをクリックしてから遷移するまで（ms） */
  navigateDelayMs: 400,
  catchAnimation: {
    grab: { scale: 1.3, rotation: -15, duration: 0.15 },
    release: { duration: 0.35 },
  },
} as const;
