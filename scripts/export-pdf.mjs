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
import { readdir, readFile } from 'fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import { execSync, spawn } from 'child_process';
import { createServer } from 'net';
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

// --- frontmatter から単純な key: value を抽出 ---
async function readFrontmatter(filePath) {
  // BOM 付き・CRLF のファイルもあるので正規化してから読む
  const content = (await readFile(filePath, 'utf-8')).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = content.match(/^\s*---\n([\s\S]*?)\n---/);
  const get = (key) => {
    const keyMatch = match?.[1].match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
    return keyMatch ? keyMatch[1].trim() : undefined;
  };
  return {
    unpublished: get('unpublished') === 'true',
    featured: parseInt(get('featured') ?? '0', 10) || 0,
    date: new Date(get('date') ?? 0).getTime() || 0,
  };
}

// --- ページ一覧を src/content から自動収集 ---
async function collectRoutes() {
  const routes = ['/', '/works', '/blog', '/about', '/contact'];

  for (const collection of ['works', 'blog']) {
    const dir = resolve(ROOT, 'src/content', collection);
    if (!existsSync(dir)) continue;
    const files = await readdir(dir);

    const items = [];
    for (const file of files) {
      if (!/\.(md|mdx)$/.test(file)) continue;
      const slug = basename(file).replace(/\.(md|mdx)$/, '');
      const meta = await readFrontmatter(resolve(dir, file));
      // 非公開記事はページが生成されない（404 になる）ので除外する
      if (meta.unpublished) continue;
      items.push({ ...meta, path: `/${collection}/${slug}` });
    }

    // サイトの並びに合わせる: works は Featured 順（同値は新しい順）、blog は新しい順
    items.sort((a, b) => (collection === 'works' ? b.featured - a.featured : 0) || b.date - a.date);

    items.forEach(item => routes.push(item.path));
  }

  return routes;
}

// --- ポートが空いているか確認（使用中だと astro preview が別ポートで起動し、別のサーバーを撮ってしまうため） ---
function assertPortFree(port) {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()
      .once('error', () => reject(new Error(`ポート ${port} は使用中です。--port で別のポートを指定してください`)))
      .once('listening', () => probe.close(() => resolvePort()))
      .listen(port, 'localhost');
  });
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
  await assertPortFree(PORT);
  console.log(`🚀 プレビューサーバーを起動 (port ${PORT})...`);
  // detached で新しいプロセスグループにし、終了時は npm → astro までまとめて止める
  const server = spawn(
    'npm',
    ['run', 'preview', '--', '--port', String(PORT)],
    { cwd: ROOT, stdio: 'pipe', detached: true }
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
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      // すでに終了している
    }
  }
}

main().catch(err => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
