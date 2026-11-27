/** AdaptiveQuality（src/scripts/utils/adaptiveQuality.ts）の判定パラメータ */
export const ADAPTIVE_QUALITY = {
  /**
   * これを超えるフレーム間隔を「コマ落ち」とみなす（ms）。
   * 60Hz の正常間隔は約16.7ms、1フレーム落ちると約33ms になるため、その中間に置く。
   */
  frameBudgetMs: 25,
  /** liteMode に切り替えるまでの連続コマ落ちフレーム数 */
  badStreakLimit: 30,
} as const;
