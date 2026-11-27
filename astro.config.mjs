// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkEmbeds from './src/lib/remark-embeds.ts';
import devEditor from './src/dev-editor/integration.ts';

// https://astro.build/config
export default defineConfig({
  // 公開 URL（canonical・OGP・sitemap の絶対 URL に使う）
  site: 'https://alcedoworks.com',
  integrations: [
    // 記事の素の Markdown（画像・YouTube / X の URL）を記事用コンポーネントにする（.mdx だけに適用）
    mdx({ processor: unified({ remarkPlugins: [remarkEmbeds] }) }),
    // `astro dev` のときだけ、ブラウザで記事を編集する /_edit を追加する
    devEditor(),
    // /sitemap-index.xml を出力する（管理者用の隠しページ /debug/ は除く）
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/debug/') }),
  ],
});
