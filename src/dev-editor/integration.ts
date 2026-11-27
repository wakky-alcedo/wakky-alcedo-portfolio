/**
 * dev 専用の記事エディタ。`astro dev` のときだけ /_edit ページと API を追加し、build には何も入れない。
 * 画面：src/dev-editor/EditorPage.astro、API：src/dev-editor/api.ts
 */
import type { AstroIntegration } from 'astro';
import { editorApi } from './api';

export default function devEditor(): AstroIntegration {
  return {
    name: 'dev-editor',
    hooks: {
      'astro:config:setup': ({ command, injectRoute, updateConfig }) => {
        if (command !== 'dev') return;
        injectRoute({ pattern: '/_edit', entrypoint: new URL('./EditorPage.astro', import.meta.url) });
        updateConfig({
          vite: {
            plugins: [editorApi()],
            // 初めて /_edit を開いたときに依存の最適化で再読み込みが走らないよう、先に最適化しておく
            optimizeDeps: {
              include: ['@codemirror/state', '@codemirror/view', '@codemirror/commands', '@codemirror/language', '@codemirror/lang-markdown', '@codemirror/search'],
            },
          },
        });
      },
    },
  };
}
