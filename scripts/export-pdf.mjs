/**
 * ポートフォリオ全ページを1つのPDFに書き出すスクリプト
 *
 * 使い方:
 *   node scripts/export-pdf.mjs              # ビルドから実行
 *   node scripts/export-pdf.mjs --no-build   # ビルド済みの場合
 *   node scripts/export-pdf.mjs --port 4322  # プレビューポート指定
 *
 * 依存: playwright, pdf-lib (devDependencies)
 */

import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { readdir } from 'fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- CLI オプション ---
const args = process.argv.slice(2);
const NO_BUILD = args.includes('--no-build');
const PORT = (() => {
  const i = args.indexOf('--port');
  return i !== -1 ? parseInt(args[i + 1], 10) : 4321;
})();
const OUTPUT_FILE = args.find(a => a.startsWith('--out='))?.slice(6) ?? 'portfolio.pdf';

const BASE_URL = `http://localhost:${PORT}`;

// --- ページ一覧を src/content から自動収集 ---
async function collectRoutes() {
  const routes = ['/', '/works', '/blog', '/about', '/contact'];

  for (const collection of ['works', 'blog']) {
    const dir = resolve(ROOT, 'src/content', collection);
    if (!existsSync(dir)) continue;
    const files = await readdir(dir);
    for (const file of files) {
      if (!/\.(md|mdx)$/.test(file)) continue;
      const slug = basename(file).replace(/\.(md|mdx)$/, '');
      routes.push(`/${collection}/${slug}`);
    }
  }

  return routes;
}

// --- プレビューサーバーが立ち上がるまで待機 ---
async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return;
    } catch {
      // まだ起動中
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`サーバーが ${timeoutMs}ms 以内に起動しませんでした: ${url}`);
}

// --- メイン ---
async function main() {
  // 1. ビルド
  if (!NO_BUILD) {
    console.log('📦 ビルド中...');
    execSync('npm run build', { stdio: 'inherit', cwd: ROOT });
  }

  // 2. プレビューサーバー起動
  console.log(`🚀 プレビューサーバーを起動 (port ${PORT})...`);
  const server = spawn(
    'npm',
    ['run', 'preview', '--', '--port', String(PORT)],
    { cwd: ROOT, stdio: 'pipe', shell: true }
  );
  server.stderr.on('data', d => process.stderr.write(d));

  try {
    await waitForServer(BASE_URL);
    console.log('✅ サーバー準備完了');

    // 3. ページ一覧取得
    const routes = await collectRoutes();
    console.log(`📄 対象ページ数: ${routes.length}`);
    routes.forEach(r => console.log('  ', r));

    // 4. Playwright で各ページを PDF 化
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    // print CSS（インク節約・白背景）を無効化してスクリーンの色をそのまま出力する
    await page.emulateMedia({ media: 'screen' });
    const pdfBuffers = [];

    for (const route of routes) {
      console.log(`📸 ${route}`);
      await page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'networkidle',
        timeout: 30_000,
      });
      // アニメーション等が落ち着くまで少し待つ
      await page.waitForTimeout(500);

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
      pdfBuffers.push(pdf);
    }

    await browser.close();

    // 5. PDF を結合
    console.log('🔗 PDF を結合中...');
    const merged = await PDFDocument.create();
    for (const buf of pdfBuffers) {
      const doc = await PDFDocument.load(buf);
      const copied = await merged.copyPages(doc, doc.getPageIndices());
      copied.forEach(p => merged.addPage(p));
    }

    const bytes = await merged.save();
    const outPath = resolve(ROOT, OUTPUT_FILE);
    writeFileSync(outPath, bytes);
    console.log(`✨ 完了: ${outPath} (${(bytes.byteLength / 1024).toFixed(0)} KB)`);
  } finally {
    server.kill();
  }
}

main().catch(err => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
