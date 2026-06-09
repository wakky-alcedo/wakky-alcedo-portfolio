# Wakky-Alcedo Portfolio — 技術仕様・実装計画

## 技術スタック

| レイヤー | 採用技術 | 選定理由 |
|----------|----------|----------|
| フレームワーク | **Astro 5.x** | ポートフォリオに最適な静的サイト生成。コンテンツコレクションでWorks/Blogを型安全に管理。Island Architectureでアニメーションを遅延ロード可能 |
| 言語 | **TypeScript** | アニメーション/Canvasの複雑なロジックを型安全に記述 |
| スクロールアニメーション | **GSAP + ScrollTrigger** | 業界標準。カワセミ飛び込み演出のような精密なスクロール連動アニメーションに最適 |
| Canvas演出 | **Canvas API（ネイティブ）** | 魚シミュレーション・水面リプル。外部ライブラリ不要で軽量 |
| スタイリング | **CSS Custom Properties** | デザイントークン（カラーパレット）を変数管理。Phase 2の時間帯変化にも対応しやすい |
| ビルドツール | **Vite**（Astro内蔵） | 高速 HMR、アセット最適化 |
| パッケージマネージャ | **npm** | |

---

## アーキテクチャ方針

### Island Architecture（アストロの核心）

```
静的HTML（コンテンツ）← サーバーサイドレンダリング、JS不要
         +
アニメーションIsland（client:only）← JSを遅延ロード
```

- コンテンツ（テキスト・画像）は即座に表示 → FCP高速化
- GSAP・Canvasスクリプトは `client:visible` または `client:idle` で後から注入
- これにより非機能要件「段階的読み込み」を構造レベルで担保

### スクロールシーン設計

```
Scroll 0%    ━━━━━━━━━━━━━━━━━━━━━━━━ Hero（水上）
             カワセミ → とまり木に静止
             放置でアイドルアニメーション（飛び込み→戻り）

Scroll ~70%  ━━━━━━━━━━━━━━━━━━━━━━━━ 飛び込みトリガー
             カワセミが助走→飛び込み開始

Scroll 100%  ━━━━━━━━━━━━━━━━━━━━━━━━ 水面（リプルアニメーション）
             水上↔水中の境界。連続スクロールで自然に遷移

Scroll 100%+ ━━━━━━━━━━━━━━━━━━━━━━━━ 水中コンテンツ
             Works → Blog → About → Contact（縦積み）
             各セクション内でカード横スクロール
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
│   │   │   ├── Header.astro         # ロゴ＋ナビ（水上/水中で外観変化）
│   │   │   ├── Footer.astro         # SNS・コピーライト・傾きトグル
│   │   │   └── BaseLayout.astro     # <head>・メタタグ共通レイアウト
│   │   ├── home/
│   │   │   ├── HeroSection.astro    # 水上エリア全体
│   │   │   ├── WaterSurface.astro   # 水面リプルCanvas
│   │   │   ├── UnderwaterSection.astro # 水中コンテンツエリア
│   │   │   └── ScrollKingfisher.astro  # 右端スクロールバー役カワセミ
│   │   ├── works/
│   │   │   └── WorkCard.astro       # サムネイル・ホバー演出
│   │   ├── blog/
│   │   │   └── BlogCard.astro       # タイトル＋冒頭文
│   │   └── common/
│   │       └── SectionTitle.astro
│   ├── content/
│   │   ├── config.ts                # コレクション型定義
│   │   ├── works/
│   │   │   ├── work1.md
│   │   │   └── work2.md
│   │   └── blog/
│   │       └── placeholder.md
│   ├── scripts/
│   │   ├── animation/
│   │   │   ├── scrollScene.ts       # GSAP ScrollTrigger 全体管理
│   │   │   ├── kingfisher.ts        # カワセミ飛び込み・アイドル
│   │   │   └── workCardTransition.ts # Works遷移アニメーション
│   │   ├── canvas/
│   │   │   ├── fish.ts              # 魚シミュレーション（4レイヤー）
│   │   │   └── ripple.ts            # 水面リプル
│   │   └── utils/
│   │       ├── visibility.ts        # Page Visibility API（バックグラウンド停止）
│   │       └── deviceOrientation.ts # iOS/Android 傾き取得
│   ├── styles/
│   │   ├── tokens.css               # CSS Custom Properties（デザイントークン）
│   │   ├── global.css               # リセット・ベーススタイル
│   │   └── animations.css           # CSS-only アニメーション定義
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
│   └── TECH_SPEC.md                 # このファイル
├── astro.config.mjs
├── tsconfig.json
├── package.json
└── .gitignore
```

---

## デザインシステム（CSS Custom Properties）

```css
/* tokens.css */
:root {
  /* カラーパレット */
  --color-primary:    #0063AA;
  --color-secondary:  #68CED6;
  --color-accent:     #FFA100;
  --color-bg:         #00112C;
  --color-text:       #F9FFFD;

  /* シーン管理（JSで動的更新） */
  --scroll-progress:  0;        /* 0.0〜1.0 */
  --water-surface-y:  100vh;    /* 水面のY座標 */

  /* アニメーション共通イージング */
  --ease-dive:     cubic-bezier(0.4, 0, 0.2, 1);
  --ease-surface:  cubic-bezier(0.0, 0.0, 0.2, 1);

  /* z-indexレイヤー */
  --z-fish-bg:     1;
  --z-fish-mid:    2;
  --z-fish-front:  3;
  --z-fish-near:   4;
  --z-ui:          10;
  --z-kingfisher:  20;
  --z-header:      100;
}
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

各魚はBoidアルゴリズム（分離・整列・結合）の簡易版で動く。
カーソル/クリックへの逃避行動は Layer 3・4 のみ適用。

DeviceOrientation時：レイヤーごとに異なるオフセット量でtransformX→奥行き感。

---

## パフォーマンス戦略

| 対策 | 実装方法 |
|------|----------|
| アニメーション遅延ロード | Astro `client:idle`（Canvasスクリプト）|
| バックグラウンド停止 | Page Visibility API → Canvas `cancelAnimationFrame` |
| GPU合成 | Canvas要素に `will-change: transform` |
| 画像最適化 | Astro組み込みの `<Image>` コンポーネント |
| GSAP軽量化 | ScrollTriggerのみtree-shaking import |

---

## 実装フェーズ

### Phase 0 — プロジェクト初期化（1セッション）
- [ ] Astroプロジェクト生成 + TypeScript設定
- [ ] アセットを `tmp_image/` → `src/assets/images/` に移動
- [ ] CSS デザイントークン（tokens.css）
- [ ] BaseLayout.astro（head・meta）
- [ ] Header / Footer コンポーネント

### Phase 1 — 静的ページ（1〜2セッション）
- [ ] コンテンツコレクション定義（works・blog）
- [ ] Works・Blog のプレースホルダーコンテンツ作成
- [ ] トップページ レイアウト（アニメーションなし）
- [ ] Works一覧・詳細ページ
- [ ] Blog一覧・詳細ページ
- [ ] About・Contact ページ

### Phase 2 — コアアニメーション（1〜2セッション）
- [ ] 水面リプル（Canvas ripple.ts）
- [ ] カワセミ飛び込み演出（GSAP ScrollTrigger）
- [ ] アイドルアニメーション（放置で周期的に飛び込み）
- [ ] スクロールカワセミ（右端スクロールバー役）

### Phase 3 — インタラクティブ演出（1セッション）
- [ ] 魚シミュレーション（Boid軽量版、4レイヤー）
- [ ] 魚の逃避行動（カーソル/クリック）
- [ ] カワセミクリック → 水上浮上
- [ ] WorksCard → クリック時カワセミ演出

### Phase 4 — パフォーマンス・品質仕上げ（1セッション）
- [ ] Page Visibility APIによるアニメーション停止
- [ ] DeviceOrientation トグル（フッター）
- [ ] レスポンシブ対応（スマホ）
- [ ] Lighthouseスコア確認・チューニング

### Phase 5 — Phase 2機能（将来）
- [ ] 時間帯・季節・天気による背景変化
- [ ] 多言語対応（i18n）

---

## 参照
- [要件定義](./REQUIREMENTS.md)
- [Astro公式](https://docs.astro.build)
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
