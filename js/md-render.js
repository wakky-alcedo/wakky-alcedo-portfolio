/**
 * md-render.js — Markdown ファイルを取得してHTMLに変換する共通処理
 * 依存: marked.js (CDN で読み込み済みであること)
 */

/**
 * Markdown ファイルを取得してレンダリングし、指定の要素に挿入する
 * @param {string} mdPath   - Markdown ファイルのパス (例: 'content/about.md')
 * @param {string} targetId - 挿入先の要素ID
 */
async function renderMarkdown(mdPath, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  try {
    const res = await fetch(mdPath);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const md = await res.text();
    el.innerHTML = marked.parse(md);
    el.classList.add('md-rendered');
  } catch (e) {
    el.innerHTML = `<p class="md-error">コンテンツを読み込めませんでした。<br><small>${e.message}</small></p>`;
  }
}

/**
 * URLパラメータから slug を取得する
 * 例: post.html?slug=my-first-post → 'my-first-post'
 */
function getSlug() {
  return new URLSearchParams(window.location.search).get('slug') || '';
}
