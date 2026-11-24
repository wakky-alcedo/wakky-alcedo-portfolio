// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkEmbeds from './src/lib/remark-embeds.ts';
import devEditor from './src/dev-editor/integration.ts';

// https://astro.build/config
export default defineConfig({
  integrations: [
    // 記事の素の Markdown（画像・YouTube / X の URL）を記事用コンポーネントにする（.mdx だけに適用）
    mdx({ processor: unified({ remarkPlugins: [remarkEmbeds] }) }),
    // `astro dev` のときだけ、ブラウザで記事を編集する /_edit を追加する
    devEditor(),
  ],
});
