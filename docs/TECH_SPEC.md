# Wakky-Alcedo Portfolio — 技術仕様・実装計画

## 技術スタック

| レイヤー | 採用技術 | 選定理由 |
|----------|----------|----------|
| フレームワーク | **Astro 6.x** | ポートフォリオに最適な静的サイト生成。コンテンツコレクションでWorks/Blogを型安全に管理 |
| 言語 | **TypeScript** | アニメーション/Canvasの複雑なロジックを型安全に記述 |
| スクロールアニメーション | **GSAP + ScrollTrigger** | 業界標準。カワセミ飛び込み演出のような精密なスクロール連動アニメーションに最適。※GSAPは個人ポートフォリオ用途では無料ライセンス可 |
| Canvas演出 | **Canvas API（ネイティブ）** | 魚シミュレーション・水面リプル。外部ライブラリ不要で軽量 |
| スタイリング | **CSS Custom Properties** | デザイントークン（カラーパレット）を変数管理。Phase 2の時間帯変化にも対応しやすい |
| コンテンツ拡張 | **@astrojs/mdx** | Works/Blog記事内でAstroコンポーネント（画像レイアウト等）を使用可能にする |
| 記事エディタ（dev のみ） | **CodeMirror 6**, **yaml** | `npm run dev` の `/_edit` で記事をライブプレビュー編集する（build には含めない） |
| ビルドツール | **Vite**（Astro内蔵） | 高速 HMR、アセット最適化 |
| パッケージマネージャ | **npm** | `package-lock.json` を必ずコミットして依存を固定する |
| 型チェック | **@astrojs/check** | `npm run check`（`astro check`）で .astro / .ts の型エラーを検出。変更後はビルド前に実行する |

---

## アーキテクチャ方針

### 静的HTML＋後から起動する演出スクリプト

```
静的HTML（コンテンツ）← ビルド時に生成、JS不要
         +
演出スクリプト ← Astro の <script>（type=module で遅延実行）
  └─ window.load 後に initScrollScene()（src/pages/index.astro）
       ├─ GSAP ScrollTrigger（カワセミ）→ 最後に refresh
       └─ Canvas（水面・コースティクス・魚）
```

- コンテンツ（テキスト・画像）は即座に表示 → FCP高速化
- UIフレームワークの Island（`client:*`）は使わない。演出はすべて素の TypeScript モジュール
- 画像の読み込み完了（window.load）後に起動するので、ScrollTrigger の位置ズレを防げる

### ブレークポイント

| 区分 | 幅 | 用途 |
|------|----|------|
| スマホ | 〜640px | 1カラム化・カードの横スワイプ・Canvas の軽量化 |
| タブレット | 〜1024px | 現状は専用の切り替えなし（PC と同じ） |

値は `src/config/breakpoints.ts` を正とし、CSS の `@media` では同じ値を直書きする（変数が使えないため）。

### スクロールアニメーションの制御方針

**CSS変数をアニメーション値に使わない。**

| 用途 | 方法 |
|------|------|
| スクロール連動のアニメーション値 | `gsap.set(element, { y, opacity, ... })` で直接制御 |
| カワセミ位置・魚オフセット等 | GSAPのTweenターゲットプロパティに渡す |
| デザイントークン（色・余白等） | CSS Custom Properties（静的用途のみ） |
| 演出の制御パラメータ | `src/config/scene.ts` で管理 |

> 理由：CSS変数をJSで毎フレーム `style.setProperty()` 更新すると、スタイル再計算（Recalculate Style）がメインスレッドで走りモバイルでパフォーマンス問題が発生する。

### カード一覧（Works / Blog）のレイアウト方針

**縦スクロールはページ送り、横スワイプはカード送りと、操作を分ける。** 縦スクロールに連動して横に動かす（GSAP のピン固定）パターンは使わない。

| 画面 | トップの Works / Blog | /works・/blog 一覧 |
|------|------------------------|---------------------|
| PC・タブレット | タイル（`auto-fill, minmax(280px, 1fr)`） | タイル |
| スマホ（〜640px） | ネイティブの横スクロール（`overflow-x: auto` + scroll-snap） | 1カラムのタイル |

- 並べ方は `CardCollection.astro`（`mobile="grid" | "row"`）、カードは Works / Blog 共通の `EntryCard.astro`
- 横スワイプ行は `overscroll-behavior-x: contain` で縦スクロールへ連鎖させない

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

> 背景演出の Canvas（水面・コースティクス・魚）は装飾なので `aria-hidden="true"` にして読み上げ対象から外す。スクロールバー役カワセミはキーボード操作を阻害しない実装にする。

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
│   │   ├── contact.astro
│   │   └── debug/
│   │       └── sensor.astro         # 管理者用センサーデバッグページ（noindex、非リンク）
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.astro         # ロゴ＋ナビ
│   │   │   ├── Footer.astro         # SNS・コピーライト・傾きトグル
│   │   │   ├── BaseLayout.astro     # <head>・OGP・メタタグ共通レイアウト
│   │   │   ├── ArticleLayout.astro  # Works/Blog 詳細ページ共通（ヒーロー・タグ・本文・戻るリンク）
│   │   │   └── PageLayout.astro     # 一覧・About・Contact 共通の外枠（戻るボタン・見出し・本文幅）
│   │   ├── home/
│   │   │   ├── HeroSection.astro    # 水上エリア全体
│   │   │   ├── WaterSurface.astro   # 水面リプルCanvas
│   │   │   ├── UnderwaterSection.astro # 水中コンテンツエリア
│   │   │   ├── FishLayer.astro      # 魚Canvas（画像URLをdata属性で渡す）
│   │   │   └── ScrollKingfisher.astro  # 右端スクロールバー役
│   │   ├── works/
│   │   │   └── SortableWorksGrid.astro # Featured/Newest 切り替え付きの作品一覧（トップ・Works一覧で共通）
│   │   ├── content/
│   │   │   ├── MarkdownImage.astro  # Markdown の画像記法を CustomImage で描画（img の差し替え）
│   │   │   ├── CustomImage.astro    # 記事内画像（幅指定・キャプション・ライトボックス）
│   │   │   ├── FlexRow.astro        # 記事内画像の横並びレイアウト
│   │   │   ├── YouTube.astro        # 記事内の動画埋め込み
│   │   │   ├── TwitterEmbed.astro   # 記事内のポスト埋め込み（oEmbed）
│   │   │   ├── NoteEmbed.astro      # 記事内のnote記事カード（oEmbed）
│   │   │   ├── ExternalLink.astro   # 外部URLなら新しいタブで開くリンク
│   │   │   └── ArtCard.astro        # インタラクティブアート（public/art）のプレビューカード
│   │   └── common/
│   │       ├── SectionTitle.astro
│   │       ├── BackButton.astro     # トップ以外のページの戻るボタン
│   │       ├── EntryCard.astro      # Works/Blog 共通カード（トップ画像・タイトル・タグ・ホバーで概要）
│   │       ├── CardCollection.astro # カード一覧のレイアウト（PCはタイル、スマホは縦積み or 横スワイプ）
│   │       └── EmailReveal.astro    # クリックでメールアドレスを復元して mailto リンクにする
│   ├── config/                      # 制御パラメータ・サイト設定（AGENTS 7.6）
│   │   ├── quality.ts               # AdaptiveQuality の判定閾値
│   │   ├── art.ts                   # ArtCard のプレビュー読み込み範囲
│   │   ├── breakpoints.ts           # 画面幅の切り替え点（CSS の @media にも同じ値を使う）
│   │   ├── image.ts                 # ライトボックス画像の最大幅
│   │   ├── editor.ts                # dev エディタの自動保存間隔・画像の保存先
│   │   ├── scene.ts                 # トップページの演出パラメータ（Canvas・カワセミ）
│   │   └── site.ts                  # SNSリンク・メールアドレス（全ページ共通）
│   ├── content.config.ts            # コンテンツコレクションのzodスキーマ定義
│   ├── lib/
│   │   ├── collections.ts           # 一覧・詳細ページに出すエントリの取得（unpublished の扱い）
│   │   ├── embeds.ts                # 記事記法の解釈（画像の幅・YouTube / X の URL）。ビルドとエディタで共通
│   │   └── remark-embeds.ts         # 画像だけ・URL だけの段落を FlexRow / YouTube / TwitterEmbed にする
│   ├── dev-editor/                  # dev 専用の記事エディタ（integration.ts が astro dev のときだけ追加）
│   │   ├── integration.ts           # /_edit の追加・API の登録
│   │   ├── api.ts                   # 記事の読み書き・画像の保存（src/content と画像フォルダの中だけ）
│   │   ├── EditorPage.astro         # 一覧・編集画面
│   │   └── client/                  # ライブプレビュー・ドロップ／貼り付け・フロントマターのフォーム
│   ├── content/
│   │   ├── works/                   # 作品記事（YYYY-slug.mdx）
│   │   └── blog/                    # ブログ記事（YYYYMM-slug.mdx）
│   ├── scripts/
│   │   ├── animation/
│   │   │   ├── scrollScene.ts       # オーケストレーター（init/destroyのみ）
│   │   │   ├── kingfisher.ts        # ヒーローのカワセミ（スクロール連動の飛び込み・アイドル演出）
│   │   │   └── scrollKingfisher.ts  # 右端カワセミ（スクロールバー役・浮上・Worksカード遷移演出）
│   │   ├── canvas/
│   │   │   ├── canvasAnimation.ts   # Canvas共通の基底クラス（ループ・リサイズ・一時停止）
│   │   │   ├── fish.ts              # 魚Boidシミュレーション（4レイヤー）
│   │   │   ├── ripple.ts            # 水面リプル
│   │   │   └── caustics.ts          # 水中コースティクス（水面からの揺らめく光）
│   │   └── utils/
│   │       ├── visibility.ts        # SceneModule/Pauseable と Page Visibility（非表示中にCanvasを停止）
│   │       ├── deviceOrientation.ts # iOS/Android 傾き取得・TiltTracker・requestPermission管理
│   │       ├── adaptiveQuality.ts   # フレーム間隔監視・品質自動調整
│   │       ├── device.ts            # スマホ判定・Canvas の DPR 上限
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

トークンの値は `src/styles/tokens.css` を正とする（ここには写さない）。設計上の決まりだけを記す。

- **カラーパレット**: primary（青）/ secondary（シアン）/ accent（オレンジ）/ bg（濃紺）/ text の5色。Phase 2 の時間帯変化はこの5色の差し替えで行う
- **透明度付きの色**: `rgba(var(--color-secondary-rgb), 0.3)` のように `--color-*-rgb` を使い、RGB 値を直書きしない
- **色の役割と比率**（目安 ベース紺 70 : メイン青緑 25 : アクセント橙 5）。コンポーネントは役割のトークン（`--surface-*` / `--line-*` / `--tag-*`）を使う
  - 紺: 背景だけ
  - 青緑: ヘッダー・フッターの帯と、カードの半透明の面（透明感を残す）
  - 水色: ブランドと水のモチーフ（ロゴ・見出し・写真の縁・水面やカワセミの演出）だけ
  - 橙: 操作できるところ（ボタン・リンク・選択中）と強調だけ
  - 線・タグ・補足: 文字色の透明度で控えめにする
- **z-index**: `--z-caustics` < `--z-fish-bg` < `--z-ui` < `--z-kingfisher` < `--z-header` の順で重ねる
- **アニメーション値には使わない**（「スクロールアニメーションの制御方針」参照）
- **reduced-motion**: `tokens.css` で全アニメーション・トランジションを実質停止する
- **safe-area-inset**: ヘッダー・フッター・右端カワセミはノッチ／Dynamic Island を避ける（`src/styles/global.css`）

---

## 魚シミュレーション設計

魚は4つの深度レイヤーに分けて描画する。奥ほど小さく・ぼかし強め・遅く、ページスクロールへの追従も遅くする（奥行き表現）。
レイヤーごとのスケール・ブラー・速度・密度・スクロール追従率は `src/config/scene.ts` の `FISH.layers` で管理する。

**Canvasの配置：**
魚とコースティクスの Canvas は `#underwater` 全体ではなくビューポートサイズで確保し、`position: sticky` で画面に追従させる（`UnderwaterSection.astro` の `.underwater__viewport`）。
水中セクション全体の高さで確保すると DPR2 で数百MB規模になるため。個体数は画面面積×密度で決め、スクロール量に応じて座標をずらしてラップアラウンドさせる。

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
- 全Canvasは基底クラス `src/scripts/canvas/canvasAnimation.ts` を継承し、`update` / `draw` だけを実装する（ループ・dt上限・リサイズ・DPR・一時停止・reduced-motion時の静止描画は基底クラスが担う）
- `will-change: contents` を Canvas 要素に指定（`transform` ではない）
- 制御パラメータは `src/config/scene.ts` に置き、各モジュールに直書きしない

**アルゴリズム：** Boid軽量版（分離・整列・結合）。レイヤー内のみの O(n²) で、画面あたり十数匹なら問題ない。

**モバイル最適化：**
- `utils/device.ts` の `isMobile()` でスマホを判定（`BREAKPOINTS.sp` 以下）
- スマホでは起動直後から `liteMode`（レイヤー2枚・個体数半減）。PC はフレーム間隔の超過が連続すると発動（閾値は `src/config/quality.ts`）
- DPR を最大 1.5（スマホ）/ 2（PC）にキャップ（`canvasDpr()`）
- スマホでは `ctx.filter` + OffscreenCanvas blur をスキップし直接描画（最重要最適化）

**カーソル逃避：** Layer 3・4 のみ適用。

**DeviceOrientation時：** レイヤーごとに異なるオフセット量で `translateX` → 奥行き感。

---

## DeviceOrientation 実装仕様

iOS 13+ では `requestPermission()` が必須（実装: `src/scripts/utils/deviceOrientation.ts` の `requestOrientationPermission`）。以下の制約を必ず守る：

- **必ずユーザーの click ハンドラ内から直接呼ぶ**（`setTimeout` などを挟むと拒否される）
- `requestPermission` がない環境（Android など）は許可不要として扱う
- 傾きは `gamma` を `TILT.maxGammaDeg`（`src/config/scene.ts`）で -1〜1 に正規化して使う

フッターのトグルの `click` ハンドラ内から直接呼ぶ。拒否時はトグルを disabled にして「Safariの設定から再許可が必要です」ガイダンスを表示する。

---

## パフォーマンス戦略

| 対策 | 実装方法 |
|------|----------|
| コンテンツ先行表示 | 演出スクリプトは window.load 後に起動 |
| ScrollTrigger位置ズレ防止 | `window.load` 後に `ScrollTrigger.refresh()` を呼ぶ |
| バックグラウンド停止 | Page Visibility API で Canvas の描画ループだけを pause / resume |
| アダプティブ品質 | `adaptiveQuality.ts` でフレーム間隔を監視 → `liteMode` 切り替え |
| Canvas blur 効率化 | PC: `ctx.filter` + OffscreenCanvas合成。スマホ: blur スキップし直接描画 |
| Retina対応 | DPR を `canvasDpr()` でキャップ（スマホ 1.5 / PC 2） |
| 画像最適化 | Astro `<Image>` コンポーネント（`width`/`height` 必須指定）|
| CLS防止 | 全`<Image>`に`width`/`height`明示 |
| SEO / OGP | BaseLayout.astroでコレクションのfrontmatterからdynamic meta生成 |
| メールアドレス保護 | Base64エンコードをJSで復元する難読化を適用 |

---

## コンテンツコレクション型定義

スキーマは `src/content.config.ts` を正とする（ここには写さない）。各フィールドの意味と決まり：

| フィールド | Works | Blog | 意味 |
|------------|-------|------|------|
| `title` / `description` | 必須 | 必須 | タイトル／カードのホバーで出す概要（1文程度） |
| `date` | 必須 | 必須 | `YYYY-MM-DD` のみ。Works は**作品の時期**、Blog は投稿日。Newest 順の並びと記事の日付表示に使う |
| `thumbnail` | 必須 | 任意 | カードと記事ヒーローの画像。Blog で省略するとカードはグラデーションの仮画像 |
| `tags` | 任意 | 任意 | 記事・カードのタグ |
| `wip` | 任意 | 任意 | true でカード右上に WIP バッジを出して公開 |
| `unpublished` | 任意 | 任意 | true で build（本番）の一覧・詳細ページ・PDF から除外。`npm run dev` では「非公開」バッジ付きで表示する（`src/lib/collections.ts`） |
| `featured` | 任意 | — | 大きいほど Featured 順で上位（同値は新しい順） |

### 記事の書き方

記事は `.mdx` だが、コンポーネントの import は書かず素の Markdown で書く（Obsidian でもそのまま読める）。
変換は `src/lib/remark-embeds.ts`、記法の解釈は `src/lib/embeds.ts`。対象は本文直下の段落だけ（箇条書きの中のリンクはそのまま）。

| 書き方 | 表示 |
|--------|------|
| `![説明\|80%](../../assets/images/a.jpg "キャプション")` | CustomImage。幅は `80%` か px の数値。キャプションに `"` を含むときは `'…'` で囲む |
| 画像だけの行を空行なしで続ける | FlexRow で横並び |
| YouTube の URL だけの段落（`?t=秒` で開始位置） | YouTube。`[タイトル](URL)` にすると iframe の title になる |
| X / Twitter のポストの URL だけの段落 | TwitterEmbed |

ドロップした画像は `src/assets/images/<記事名>/<記事名>-<連番>.<拡張子>` に保存する（`src/config/editor.ts`）。

### 記事エディタ（dev のみ）

`npm run dev` のときだけ `/_edit`（一覧・新規作成）と、記事ページの「✎ 編集」ボタンが出る。
カーソル行だけ Markdown を見せるライブプレビュー、画像のドロップ／貼り付け、YouTube / X の URL の埋め込み表示、表のプレビュー（中では Tab でセル移動・Enter で行追加）、書式のショートカットとツールバー（`client/formatting.ts`）、入力が止まって 1 秒後の自動保存（エディタ外で変更されていたら確認する）。
記事を保存すると Astro が開いているページを再読み込みさせるが、エディタの画面だけは再読み込みしない（`src/dev-editor/client/main.ts`）。

---

## アニメーションモジュール設計原則

`scrollScene.ts` はオーケストレーターとして薄く保つ。各モジュールは `SceneModule`（`init` / `destroy`）を実装し自己完結する（`src/scripts/utils/visibility.ts`）。

タブ非表示中は `Pauseable`（`pause` / `resume`）を実装した Canvas だけを止め、状態は保持したまま再開する。
GSAP（ScrollTrigger）は非表示中は rAF ごと止まるため対象にしない（destroy → init し直すとインラインの transform が残り状態がずれるため）。

状態の共有はカスタムイベントで疎結合に伝達する（`kingfisher:dive` → 水面の波紋、`kingfisher:catch` → 魚の差し替え、`orientation:enabled` → 傾きパララックス開始）。

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
- [x] Works/Blog のカード一覧（PCはタイル、スマホは横スワイプ。GSAPピン固定は廃止）
- [ ] アイドルアニメーション（放置で周期的に飛び込み）
- [ ] スクロールカワセミ（右端スクロールバー役）
- [ ] タッチデバイスでの横スワイプ動作検証

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
  - `scrollKingfisher.ts`: reduced-motion時は `window.scrollTo` を `behavior: 'auto'` に
- [x] Canvas `will-change: contents` ・GPU合成確認
  - FishLayer / WaterSurface は `will-change: contents`、カワセミ系は `will-change: transform` で構成済みであることを確認
- [ ] 各種ブラウザ（Safari / Chrome / Firefox）動作検証
  - Chrome（Chromium系）はpreviewツールで確認済み。Safari/Firefoxの実機検証はWindows環境では不可のため、ユーザー側での確認待ち
  - 確認観点：
    - スマホでの Works/Blog の横スワイプ（縦スクロールと干渉しないこと）
    - Canvas演出（魚Boid・水面リプル・カワセミ捕食演出）の描画とフレームレート
    - DeviceOrientationパララックス（iOS Safariの権限ダイアログ含む）

---

## 参照
- [要件定義](./REQUIREMENTS.md)
- [Astro公式](https://docs.astro.build)
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [GSAP Horizontal Scrolling](https://gsap.com/docs/v3/Plugins/ScrollTrigger/demos/HorizontalScrolling/)
