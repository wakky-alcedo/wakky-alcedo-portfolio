# Wakky-Alcedo Portfolio — 技術仕様・実装計画

## 技術スタック

| レイヤー | 採用技術 | 選定理由 |
|----------|----------|----------|
| フレームワーク | **Astro 5.x** | ポートフォリオに最適な静的サイト生成。コンテンツコレクションでWorks/Blogを型安全に管理。Island Architectureでアニメーションを遅延ロード可能 |
| 言語 | **TypeScript** | アニメーション/Canvasの複雑なロジックを型安全に記述 |
| スクロールアニメーション | **GSAP + ScrollTrigger** | 業界標準。カワセミ飛び込み演出のような精密なスクロール連動アニメーションに最適。※GSAPは個人ポートフォリオ用途では無料ライセンス可 |
| Canvas演出 | **Canvas API（ネイティブ）** | 魚シミュレーション・水面リプル。外部ライブラリ不要で軽量 |
| スタイリング | **CSS Custom Properties** | デザイントークン（カラーパレット）を変数管理。Phase 2の時間帯変化にも対応しやすい |
| コンテンツ拡張 | **@astrojs/mdx** | Works/Blog記事内でAstroコンポーネント（画像レイアウト等）を使用可能にする |
| ビルドツール | **Vite**（Astro内蔵） | 高速 HMR、アセット最適化 |
| パッケージマネージャ | **npm** | `package-lock.json` を必ずコミットして依存を固定する |

---

## アーキテクチャ方針

### Island Architecture（Astroの核心）

```
静的HTML（コンテンツ）← サーバーサイドレンダリング、JS不要
         +
アニメーションIsland ← JSを遅延ロード
  ├─ Canvas要素（DOM参照必須）→ client:only
  └─ GSAP ScrollTrigger     → client:load（window.load 後に refresh）
```

- コンテンツ（テキスト・画像）は即座に表示 → FCP高速化
- GSAP・Canvasスクリプトは `client:only` / `client:load` で後から注入
- これにより非機能要件「段階的読み込み」を構造レベルで担保

> ⚠️ `client:idle` と `client:only` の混在禁止。Canvas島は `client:only`、ScrollTrigger初期化は `client:load` に統一する。

### スクロールアニメーションの制御方針

**CSS変数をアニメーション値に使わない。**

| 用途 | 方法 |
|------|------|
| スクロール連動のアニメーション値 | `gsap.set(element, { y, opacity, ... })` で直接制御 |
| カワセミ位置・魚オフセット等 | GSAPのTweenターゲットプロパティに渡す |
| デザイントークン（色・余白等） | CSS Custom Properties（静的用途のみ） |
| シーン境界の定数（水面Y座標等） | JS定数として管理（`WATER_SURFACE_VH = 100`） |

> 理由：CSS変数をJSで毎フレーム `style.setProperty()` 更新すると、スタイル再計算（Recalculate Style）がメインスレッドで走りモバイルでパフォーマンス問題が発生する。

### 横スクロールセクション（Blog）の実装方針

**iOS Safariでの縦×横スクロール干渉を避けるため、`overflow-x: scroll` は使わない。**

GSAPの「水平スクロールセクション」パターンを採用する：
- `ScrollTrigger` でセクションをピン固定
- `gsap.to(container, { x: -totalWidth })` で横移動をスクロール量に連動させる
- タッチデバイスでの動作検証はPhase 2完了時点で必須

### Works セクション（トップページ）

Works一覧ページ（`/works`）と同様、`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` によるタイル表示。横スクロールピンは使用しない（将来的に変更の可能性あり）。

### ScrollTrigger 初期化タイミング

```ts
// 正しい初期化パターン
window.addEventListener('load', () => {
  initScrollScene(); // GSAPシーン初期化
  ScrollTrigger.refresh(); // 全画像ロード後に位置再計算
});
```

- Astroの `<Image>` コンポーネントで全画像に `width`/`height` を明示 → CLS防止・高さ事前確定

### アクセシビリティ方針

```css
/* tokens.css に必ず含める */
@media (prefers-reduced-motion: reduce) {
  /* アニメーション全停止フラグ */
}
```

```ts
// JS側でも判定
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReduced) {
  // Boid・飛び込み・リプルを全停止
  // 静的なレイアウトのみ表示
}
```

> Canvas要素には `role="img"` と `aria-label` を付与する。スクロールバー役カワセミはキーボード操作を阻害しない実装にする。

---

## スクロールシーン設計

```
Scroll 0%    ━━━━━━━━━━━━━━━━━━━━━━━━ Hero（水上）
             カワセミ → とまり木に静止
             放置でアイドルアニメーション（飛び込み→戻り）

Scroll ~70%  ━━━━━━━━━━━━━━━━━━━━━━━━ 飛び込みトリガー
             GSAPでカワセミが助走→飛び込み開始

Scroll 100%  ━━━━━━━━━━━━━━━━━━━━━━━━ 水面（リプルアニメーション）
             水上↔水中の境界。連続スクロールで自然に遷移

Scroll 100%+ ━━━━━━━━━━━━━━━━━━━━━━━━ 水中コンテンツ
             Works → Blog → About → Contact（縦積み）
             各セクションはGSAP水平スクロールパターン
             カワセミが右端でスクロールバー役

最下部クリック━━━━━━━━━━━━━━━━━━━━━━━━ 水上に浮上
             カワセミクリック → 魚をキャッチ → 水上に戻る
```

---

## ディレクトリ構成

```
wakky-alcedo-portfolio/
├── src/
│   ├── pages/
│   │   ├── index.astro              # トップページ
│   │   ├── works/
│   │   │   ├── index.astro          # Works一覧
│   │   │   └── [slug].astro         # Works詳細
│   │   ├── blog/
│   │   │   ├── index.astro          # Blog一覧
│   │   │   └── [slug].astro         # Blog詳細
│   │   ├── about.astro
│   │   └── contact.astro
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.astro         # ロゴ＋ナビ
│   │   │   ├── Footer.astro         # SNS・コピーライト・傾きトグル
│   │   │   └── BaseLayout.astro     # <head>・OGP・メタタグ共通レイアウト
│   │   ├── home/
│   │   │   ├── HeroSection.astro    # 水上エリア全体
│   │   │   ├── WaterSurface.astro   # 水面リプルCanvas（client:only）
│   │   │   ├── UnderwaterSection.astro # 水中コンテンツエリア
│   │   │   └── ScrollKingfisher.astro  # 右端スクロールバー役（client:only）
│   │   ├── works/
│   │   │   └── WorkCard.astro       # サムネイル・ホバー演出
│   │   ├── blog/
│   │   │   └── BlogCard.astro       # タイトル＋冒頭文
│   │   ├── content/
│   │   │   ├── CustomImage.astro    # 記事内画像（幅指定・キャプション・代替テキスト）
│   │   │   └── FlexRow.astro        # 記事内画像の横並びレイアウト
│   │   └── common/
│   │       ├── SectionTitle.astro
│   │       └── PrintModeToggle.astro # 印刷配色モード切替トグル
│   ├── content/
│   │   ├── config.ts                # zodスキーマ定義（title, date, thumbnail, tags, description 必須）
│   │   ├── works/
│   │   │   ├── work1.md
│   │   │   └── work2.md
│   │   └── blog/
│   │       └── placeholder.md
│   ├── scripts/
│   │   ├── animation/
│   │   │   ├── scrollScene.ts       # オーケストレーター（init/destroyのみ）
│   │   │   ├── kingfisher.ts        # カワセミアニメーション（自己完結モジュール）
│   │   │   └── workCardTransition.ts # Works遷移（自己完結モジュール）
│   │   ├── canvas/
│   │   │   ├── fish.ts              # 魚Boidシミュレーション（4レイヤー）
│   │   │   └── ripple.ts            # 水面リプル
│   │   └── utils/
│   │       ├── visibility.ts        # Page Visibility API（バックグラウンド停止）
│   │       ├── deviceOrientation.ts # iOS/Android 傾き取得・requestPermission管理
│   │       ├── adaptiveQuality.ts   # フレームレート監視・品質自動調整
│   │       └── motionPreference.ts  # prefers-reduced-motion 判定
│   ├── styles/
│   │   ├── tokens.css               # CSS Custom Properties（デザイントークン専用）
│   │   ├── global.css               # リセット・ベーススタイル・safe-area-inset
│   │   ├── animations.css           # CSS-only アニメーション定義
│   │   └── print.css                # 印刷配色モード（節約／そのまま）
│   └── assets/
│       ├── images/
│       │   ├── kawasemi_perch.png
│       │   ├── kawasemi_dive.png
│       │   ├── kawasemi_fly.png
│       │   ├── bg_morning.png
│       │   ├── bg_day.png
│       │   ├── bg_sunset.png
│       │   ├── fish_1.png
│       │   ├── fish_2.png
│       │   ├── profile_picture.jpg
│       │   ├── thumbnail_work1.webp
│       │   └── thumbnail_work2.webp
│       └── favicon.png
├── public/
│   └── favicon.ico
├── docs/
│   ├── REQUIREMENTS.md
│   └── TECH_SPEC.md
├── astro.config.mjs
├── tsconfig.json
├── package.json
└── .gitignore
```

---

## デザインシステム（CSS Custom Properties）

```css
/* tokens.css — デザイントークン専用。アニメーション値には使わない */
:root {
  /* カラーパレット */
  --color-primary:    #0063AA;
  --color-secondary:  #68CED6;
  --color-accent:     #FFA100;
  --color-bg:         #00112C;
  --color-text:       #F9FFFD;

  /* レイアウト定数 */
  --layout-breakpoint-sm: 640px;
  --layout-breakpoint-md: 1024px;

  /* z-indexレイヤー */
  --z-fish-bg:     1;
  --z-fish-mid:    2;
  --z-fish-front:  3;
  --z-fish-near:   4;
  --z-ui:          10;
  --z-kingfisher:  20;
  --z-header:      100;
}

/* アクセシビリティ：アニメーション全停止 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

```css
/* global.css — safe-area-inset（ノッチ/Dynamic Island対応） */
.header { padding-top: env(safe-area-inset-top); }
.footer { padding-bottom: env(safe-area-inset-bottom); }
.scroll-kingfisher { right: env(safe-area-inset-right, 0); }
```

---

## 魚シミュレーション設計

魚は4つの深度レイヤーに分けて描画する。

| レイヤー | 深度 | スケール | ブラー | 速度 | 個体数 |
|----------|------|----------|--------|------|--------|
| Layer 1（奥）| 最遠 | 0.4 | blur(3px) | 遅 | 8匹 |
| Layer 2 | 遠 | 0.6 | blur(1.5px) | 中低 | 6匹 |
| Layer 3 | 中 | 0.8 | blur(0.5px) | 中 | 4匹 |
| Layer 4（手前）| 最近 | 1.0 | なし | 速 | 3匹 |

**Canvasのブラー実装方針：**
CSS `filter: blur()` を Canvas 要素にかけない。代わりに Canvas 2D APIの `ctx.filter = 'blur(3px)'` で描画時に適用する。Layer1〜3はオフスクリーンCanvasに描いてから合成することで負荷を最小化する。

```ts
// オフスクリーンCanvas合成パターン
const offscreen = new OffscreenCanvas(width, height);
const ctx = offscreen.getContext('2d');
ctx.filter = 'blur(3px)';
// ...描画...
mainCtx.drawImage(offscreen, 0, 0);
```

**Canvas共通実装ルール：**
- `will-change: contents` を Canvas 要素に指定（`transform` ではない）
- `ResizeObserver` でウィンドウリサイズを監視し `canvas.width = width * devicePixelRatio` を再設定
- 全Canvasで `devicePixelRatio` に対応してRetinaディスプレイの粗さを防ぐ

**アルゴリズム：** Boid軽量版（分離・整列・結合）。O(n²) で合計21匹は問題ないが、空間グリッド分割を用意しておく。

**モバイル最適化：**
- `utils/device.ts` の `isMobile()` でスマホを判定（`max-width: 768px`）
- スマホでは起動直後から `liteMode`（レイヤー2枚・個体数半減）。PC はフレーム落ち連続30回で発動
- DPR を最大 1.5（スマホ）/ 2（PC）にキャップ（`canvasDpr()`）
- スマホでは `ctx.filter` + OffscreenCanvas blur をスキップし直接描画（最重要最適化）

**カーソル逃避：** Layer 3・4 のみ適用。

**DeviceOrientation時：** レイヤーごとに異なるオフセット量で `translateX` → 奥行き感。

---

## DeviceOrientation 実装仕様

iOS 13+ では `requestPermission()` が必須。以下の制約を必ず守る：

```ts
// deviceOrientation.ts
export async function requestOrientationPermission(): Promise<boolean> {
  if (typeof DeviceOrientationEvent === 'undefined') return false;

  // iOS判定
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      // ⚠️ 必ずユーザーのclickハンドラ内から直接呼ぶこと（setTimeout経由は拒否される）
      const result = await (DeviceOrientationEvent as any).requestPermission();
      return result === 'granted';
    } catch {
      return false; // 拒否時：「設定 → Safari → モーションセンサーを許可」案内UIを表示
    }
  }
  // Android: パーミッション不要
  return true;
}
```

フッターのトグルの `click` ハンドラ内から上記関数を直接呼ぶ。拒否時はトグルを disabled にして「Safariの設定から再許可が必要です」ガイダンスを表示する。

---

## パフォーマンス戦略

| 対策 | 実装方法 |
|------|----------|
| コンテンツ先行表示 | Canvas/GSAP は `client:only` / `client:load` で遅延注入 |
| ScrollTrigger位置ズレ防止 | `window.load` 後に `ScrollTrigger.refresh()` を呼ぶ |
| バックグラウンド停止 | Page Visibility API → `cancelAnimationFrame` |
| アダプティブ品質 | `adaptiveQuality.ts` でフレームレート監視 → `liteMode` 切り替え |
| Canvas blur 効率化 | PC: `ctx.filter` + OffscreenCanvas合成。スマホ: blur スキップし直接描画 |
| Retina対応 | DPR を `canvasDpr()` でキャップ（スマホ 1.5 / PC 2） |
| 画像最適化 | Astro `<Image>` コンポーネント（`width`/`height` 必須指定）|
| CLS防止 | 全`<Image>`に`width`/`height`明示 |
| SEO / OGP | BaseLayout.astroでコレクションのfrontmatterからdynamic meta生成 |
| メールアドレス保護 | Base64エンコードをJSで復元する難読化を適用 |

---

## コンテンツコレクション型定義

```ts
// content/config.ts
import { defineCollection, z } from 'astro:content';

const works = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/works' }), // .mdxはコンポーネント埋め込み記事用
  schema: ({ image }) => z.object({
    title:       z.string(),
    description: z.string(),
    date:        z.coerce.date(),
    thumbnail:   image(),          // Astro画像最適化対応
    tags:        z.array(z.string()).default([]),
    wip:         z.boolean().default(false), // trueならカード右上にWIPバッジを表示して公開
    unpublished: z.boolean().default(false), // trueなら一覧・詳細ページから除外
    featured:    z.number().default(0),      // 数値が高いほどFeatured順で上位表示（同値なら新しい順）
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) => z.object({
    title:       z.string(),
    description: z.string(),
    date:        z.coerce.date(),
    thumbnail:   image().optional(),
    tags:        z.array(z.string()).default([]),
    wip:         z.boolean().default(false),
    unpublished: z.boolean().default(false),
  }),
});

export const collections = { works, blog };
```

---

## アニメーションモジュール設計原則

`scrollScene.ts` はオーケストレーターとして薄く保つ。各モジュールは `init` / `destroy` インターフェースを持ち自己完結する。

```ts
// 各アニメーションモジュールの共通インターフェース
interface AnimationModule {
  init(): void;
  destroy(): void;
}

// scrollScene.ts（オーケストレーターの例）
import { kingfisher } from './kingfisher';
import { fishSimulation } from '../canvas/fish';
import { setupVisibility } from '../utils/visibility';

export function initScrollScene() {
  kingfisher.init();
  fishSimulation.init();
  setupVisibility([kingfisher, fishSimulation]); // 一括停止
}
```

状態の共有はカスタムイベント（`dispatchEvent(new CustomEvent('scene:underwater'))`）で疎結合に伝達する。

---

## 実装フェーズ

### Phase 0 — プロジェクト初期化（1セッション）
- [ ] Astroプロジェクト生成 + TypeScript設定
- [ ] アセットを `tmp_image/` → `src/assets/images/` に移動
- [ ] CSS デザイントークン（tokens.css）+ `prefers-reduced-motion` + `safe-area-inset`
- [ ] BaseLayout.astro（head・OGP・動的meta）
- [ ] Header / Footer コンポーネント（傾きトグル含む）
- [ ] `motionPreference.ts` / `visibility.ts` ユーティリティ

### Phase 1 — 静的ページ（1〜2セッション）
- [ ] コンテンツコレクション定義（zodスキーマ）
- [ ] Works・Blog のプレースホルダーコンテンツ作成
- [ ] トップページ レイアウト（アニメーションなし、モバイルファーストで実装）
- [ ] Works一覧・詳細ページ
- [ ] Blog一覧・詳細ページ
- [ ] About・Contact ページ（メールアドレス難読化含む）
- [ ] 全ページレスポンシブ確認

### Phase 2 — コアアニメーション（1〜2セッション）
- [ ] 水面リプル（Canvas ripple.ts、`ctx.filter` + OffscreenCanvas）
- [ ] カワセミ飛び込み演出（GSAP ScrollTrigger、`window.load`後に初期化）
- [ ] Works/Blog 横スクロールセクション（GSAPピン固定パターン）
- [ ] アイドルアニメーション（放置で周期的に飛び込み）
- [ ] スクロールカワセミ（右端スクロールバー役）
- [ ] タッチデバイスでの横スクロール動作検証

### Phase 3a — 魚シミュレーション（1セッション）
- [ ] 4レイヤーCanvas構成（OffscreenCanvas + blur合成）
- [ ] Boidアルゴリズム実装（分離・整列・結合）
- [ ] `devicePixelRatio` 対応・ResizeObserver
- [ ] `adaptiveQuality.ts`（フレームレート監視 + liteMode切り替え）
- [ ] Page Visibility APIによる停止

### Phase 3b — インタラクティブ演出（1セッション）
- [x] 魚の逃避行動（カーソル/クリック、Layer 3・4のみ）
- [x] DeviceOrientationパララックス（`requestPermission` 実装）
- [x] カワセミクリック → 魚をキャッチ → 水上浮上
- [x] WorksCard クリック時カワセミ演出

### Phase 4 — 品質仕上げ（1セッション）
- [x] Lighthouseスコア確認（Performance / Accessibility / SEO）
  - `astro build` + `astro preview` に対して計測: Performance 0.97 / Accessibility 1.0 / Best Practices 1.0 / SEO 1.0
  - カワセミ画像に `densities={[1,2]}` ・LCP画像に `fetchpriority="high"` を追加して画像解像度・LCP発見性を改善
- [x] `prefers-reduced-motion` 全モジュール検証
  - `tokens.css`: `animation-iteration-count: 1` と `scroll-behavior: auto` を追加し、無限ループアニメーションのちらつき・スムーススクロールを停止
  - `UnderwaterSection.astro`: reduced-motion時はWorks/Blogの横スクロールピンが効かないため `.hscroll`/`.hscroll__track` を折り返しレイアウトに切り替え、全カードへアクセス可能に
  - `scrollKingfisher.ts`: reduced-motion時は `window.scrollTo` を `behavior: 'auto'` に
- [x] Canvas `will-change: contents` ・GPU合成確認
  - FishLayer / WaterSurface は `will-change: contents`、カワセミ系は `will-change: transform` で構成済みであることを確認
- [ ] 各種ブラウザ（Safari / Chrome / Firefox）動作検証
  - Chrome（Chromium系）はpreviewツールで確認済み。Safari/Firefoxの実機検証はWindows環境では不可のため、ユーザー側での確認待ち
  - 確認観点：
    - GSAP ScrollTriggerによる横スクロールセクション（Works/Blog）のピン固定・スクロール連動
    - Canvas演出（魚Boid・水面リプル・カワセミ捕食演出）の描画とフレームレート
    - `prefers-reduced-motion` 有効時のフォールバックレイアウト（横スクロール→折り返し）
    - DeviceOrientationパララックス（iOS Safariの権限ダイアログ含む）

---

## 参照
- [要件定義](./REQUIREMENTS.md)
- [Astro公式](https://docs.astro.build)
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [GSAP Horizontal Scrolling](https://gsap.com/docs/v3/Plugins/ScrollTrigger/demos/HorizontalScrolling/)
