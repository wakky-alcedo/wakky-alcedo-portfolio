/**
 * dev エディタのファイル操作 API（Vite の dev サーバーにだけ載せるミドルウェア）。
 *
 * 書き込めるのは src/content/<コレクション>/*.mdx と、画像の保存先（EDITOR.imageDir）の中だけ。
 * 保存のたびに、その記事の画像フォルダのうちどこからも使われていない画像を EDITOR.trashDir へ移す。
 *
 * - GET  /__edit-api/list                          記事一覧
 * - GET  /__edit-api/file?file=works/x.mdx         フロントマター（オブジェクト）・本文・更新時刻
 * - PUT  /__edit-api/file?file=works/x.mdx         保存（他で更新されていたら 409）。使われなくなった画像を片付ける
 * - POST /__edit-api/new                           記事の新規作成
 * - POST /__edit-api/upload?file=…&name=元の名前    画像を保存し、記事から見た相対パスを返す
 * - GET  /__edit-api/asset?file=…&src=相対パス      プレビュー用に画像を返す
 * - GET  /__edit-api/history?file=…                その記事の git の履歴（新しい順）
 * - GET  /__edit-api/revision?file=…&rev=ハッシュ    その版のフロントマターと本文（差分表示の比較元）
 * - GET  /__edit-api/mine?file=…                   最後に自分で書いた版（なければ null）
 * - DELETE /__edit-api/mine?file=…                 「確認を終える」：最後に自分で書いた版を消す
 *
 * 差分表示のため、エディタで保存するたびにその内容を EDITOR.diff.snapshotDir に残す（saved）。
 * 記事を読んだときに中身が saved と違えば、エディタの外で変更されたので、saved を「自分で書いた版」（mine）として残す。
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual, promisify } from 'node:util';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import YAML from 'yaml';
import { EDITOR } from '../config/editor';

export const API_BASE = '/__edit-api';

const ARTICLE_NAME = /^[A-Za-z0-9][\w-]*$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml',
};

const COMMIT_HASH = /^[0-9a-f]{7,40}$/;
const run = promisify(execFile);

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

interface ArticleRef { collection: string; name: string; abs: string; dir: string }

/** 新規記事の本文（works は仕上げた記事と同じ章立て） */
const TEMPLATES: Record<string, string> = {
  works: '## 概要\n\n- 制作期間：\n- 担当範囲：\n\n## 開発の思い・背景\n\n## 製作\n\n## 振り返り\n\n## 関連リンク\n',
  blog: '',
};

export function editorApi(): Plugin {
  let root = process.cwd();

  const contentDir = (collection: string) => path.join(root, 'src/content', collection);

  function article(file: string | null): ArticleRef {
    const m = /^([a-z]+)\/(.+)\.mdx$/.exec(file ?? '');
    if (!m || !(EDITOR.collections as readonly string[]).includes(m[1]) || !ARTICLE_NAME.test(m[2])) {
      throw new HttpError(400, `編集できない記事です: ${file}`);
    }
    const dir = contentDir(m[1]);
    return { collection: m[1], name: m[2], dir, abs: path.join(dir, `${m[2]}.mdx`) };
  }

  /** 記事から見た相対パスを、許可した範囲（src/）の中の絶対パスにする */
  function resolveAsset(ref: ArticleRef, src: string | null): string {
    const abs = path.resolve(ref.dir, src ?? '');
    if (!abs.startsWith(path.join(root, 'src') + path.sep)) throw new HttpError(400, '記事の外の画像です');
    return abs;
  }

  function split(text: string) {
    const m = FRONTMATTER.exec(text);
    return m ? { fmRaw: m[1], body: text.slice(m[0].length) } : { fmRaw: '', body: text };
  }

  async function readBody(req: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > EDITOR.maxUploadBytes) throw new HttpError(413, 'ファイルが大きすぎます');
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  const readJson = async (req: IncomingMessage) => JSON.parse((await readBody(req)).toString('utf8'));

  async function list() {
    const entries = [];
    for (const collection of EDITOR.collections) {
      for (const file of (await fs.readdir(contentDir(collection))).sort().reverse()) {
        if (!file.endsWith('.mdx')) continue;
        const { fmRaw } = split(await fs.readFile(path.join(contentDir(collection), file), 'utf8'));
        const fm = YAML.parse(fmRaw) ?? {};
        entries.push({
          file: `${collection}/${file}`, collection, title: fm.title ?? file,
          date: fm.date ?? '', wip: !!fm.wip, unpublished: !!fm.unpublished,
          tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
        });
      }
    }
    return entries;
  }

  async function readArticle(ref: ArticleRef) {
    const [text, stat] = await Promise.all([fs.readFile(ref.abs, 'utf8'), fs.stat(ref.abs)]);
    await keepMine(ref, text);
    const { fmRaw, body } = split(text);
    return { frontmatter: YAML.parse(fmRaw) ?? {}, body, mtime: stat.mtimeMs };
  }

  async function writeArticle(ref: ArticleRef, input: { frontmatter: object; body: string; baseMtime?: number; force?: boolean }) {
    const current = await fs.readFile(ref.abs, 'utf8');
    const stat = await fs.stat(ref.abs);
    if (!input.force && input.baseMtime !== stat.mtimeMs) {
      throw new HttpError(409, 'ファイルがエディタの外で変更されています');
    }
    const { fmRaw } = split(current);
    // フロントマターが変わっていなければ元の書き方のまま残す
    const fm = isDeepStrictEqual(YAML.parse(fmRaw) ?? {}, input.frontmatter)
      ? fmRaw
      : YAML.stringify(input.frontmatter, { lineWidth: 0 }).trimEnd();
    const text = `---\n${fm}\n---\n${input.body}`;
    await fs.writeFile(ref.abs, text);
    await writeSnapshot(snapshotOf(ref, 'saved'), text);
    const images = await tidyImages(ref, text);
    return { mtime: (await fs.stat(ref.abs)).mtimeMs, ...images };
  }

  // ---- 差分表示の比較元（最後に自分で書いた版・git の履歴） ----

  const snapshotOf = (ref: ArticleRef, kind: 'saved' | 'mine') =>
    path.join(root, EDITOR.diff.snapshotDir, ref.collection, `${ref.name}.${kind}.mdx`);
  const readSnapshot = (file: string) => fs.readFile(file, 'utf8').catch(() => null);
  async function writeSnapshot(file: string, text: string) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
  }

  /** エディタの外で変更されていたら（saved と違えば）、saved を「自分で書いた版」として残す。すでにあれば古いほうを残す */
  async function keepMine(ref: ArticleRef, text: string) {
    const saved = await readSnapshot(snapshotOf(ref, 'saved'));
    // 初めて開いた記事は、いまの内容を起点にする
    if (saved === null) return writeSnapshot(snapshotOf(ref, 'saved'), text);
    if (saved === text || await readSnapshot(snapshotOf(ref, 'mine')) !== null) return;
    await writeSnapshot(snapshotOf(ref, 'mine'), saved);
  }

  async function mine(ref: ArticleRef) {
    const file = snapshotOf(ref, 'mine');
    const text = await readSnapshot(file);
    if (text === null) return null;
    const { fmRaw, body } = split(text);
    return { frontmatter: YAML.parse(fmRaw) ?? {}, body, savedAt: (await fs.stat(file)).mtimeMs };
  }

  /** git を引数の配列で呼ぶ（シェルを通さない） */
  const git = async (args: string[]) =>
    (await run('git', ['-C', root, ...args], { maxBuffer: EDITOR.maxUploadBytes })).stdout;

  /** リポジトリのルートから見た記事のパス */
  const gitPath = async (ref: ArticleRef) =>
    path.relative((await git(['rev-parse', '--show-toplevel'])).trim(), ref.abs).split(path.sep).join('/');

  /** 記事のコミット履歴。git が使えない・まだコミットしていない記事は空 */
  async function history(ref: ArticleRef) {
    const out = await git(['log', `-n${EDITOR.diff.historyLimit}`, '--format=%H%x1f%aI%x1f%s', '--', await gitPath(ref)])
      .catch(() => '');
    return out.split('\n').filter(Boolean).map((line) => {
      const [hash, date, subject] = line.split('\x1f');
      return { hash, date, subject };
    });
  }

  async function revision(ref: ArticleRef, rev: string | null) {
    if (!COMMIT_HASH.test(rev ?? '')) throw new HttpError(400, `コミットの指定が正しくありません: ${rev}`);
    const text = await git(['show', `${rev}:${await gitPath(ref)}`])
      .catch(() => { throw new HttpError(404, 'その版にはこの記事がありません'); });
    const { fmRaw, body } = split(text);
    return { frontmatter: YAML.parse(fmRaw) ?? {}, body };
  }

  // ---- 使われていない画像の片付け ----

  const imageDirOf = (ref: ArticleRef) => path.join(root, EDITOR.imageDir, ref.name);
  const trashDirOf = (ref: ArticleRef) => path.join(root, EDITOR.trashDir, ref.name);
  const readdir = (dir: string) => fs.readdir(dir).catch(() => [] as string[]);

  /** src/ の中のテキストファイル（画像フォルダを除く）をすべて読む。画像を参照しうるのは記事・設定・コンポーネント */
  async function sourceTexts(): Promise<string[]> {
    const texts: string[] = [];
    const skip = path.join(root, EDITOR.imageDir);
    const walk = async (dir: string) => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) { if (abs !== skip) await walk(abs); continue; }
        if (/\.(mdx?|astro|[cm]?[jt]s|json|ya?ml|css)$/.test(entry.name)) texts.push(await fs.readFile(abs, 'utf8'));
      }
    };
    await walk(path.join(root, 'src'));
    return texts;
  }

  /**
   * 記事の画像フォルダ（imageDir/<記事名>/）を片付ける。
   * - どのファイルからも `<記事名>/<画像>` で参照されていない画像は trashDir へ移す（アップロード直後は除く）
   * - この記事が参照しているのに無い画像が trashDir にあれば戻す（元に戻す操作で参照が復活したとき）
   */
  async function tidyImages(ref: ArticleRef, articleText: string) {
    const dir = imageDirOf(ref);
    const trash = trashDirOf(ref);
    const removed: string[] = [];
    const restored: string[] = [];
    const present = new Set(await readdir(dir));

    for (const file of await readdir(trash)) {
      if (!present.has(file) && articleText.includes(`${ref.name}/${file}`)) {
        await fs.mkdir(dir, { recursive: true });
        await fs.rename(path.join(trash, file), path.join(dir, file));
        present.add(file);
        restored.push(file);
      }
    }
    if (!present.size) return { removed, restored };

    const texts = await sourceTexts();
    for (const file of present) {
      if (texts.some((t) => t.includes(`${ref.name}/${file}`))) continue;
      const stat = await fs.stat(path.join(dir, file));
      if (!stat.isFile() || Date.now() - stat.mtimeMs < EDITOR.orphanGraceMs) continue;
      await fs.mkdir(trash, { recursive: true });
      await fs.rename(path.join(dir, file), path.join(trash, file));
      removed.push(file);
    }
    // 空になったフォルダは消す
    if (removed.length && !(await readdir(dir)).length) await fs.rmdir(dir);
    return { removed, restored };
  }

  async function createArticle(input: { collection: string; name: string; title: string }) {
    const ref = article(`${input.collection}/${input.name}.mdx`);
    if (await fs.stat(ref.abs).catch(() => null)) throw new HttpError(409, '同じ名前の記事があります');
    const today = new Date().toLocaleDateString('sv-SE');
    const frontmatter: Record<string, unknown> = { title: input.title || input.name, description: '', date: today };
    if (ref.collection === 'works') {
      frontmatter.thumbnail = path.relative(ref.dir, path.join(root, EDITOR.placeholderThumbnail)).split(path.sep).join('/');
    }
    Object.assign(frontmatter, { tags: [], wip: true, unpublished: true });
    if (ref.collection === 'works') frontmatter.featured = 0;
    const fm = YAML.stringify(frontmatter, { lineWidth: 0 }).trimEnd();
    await fs.writeFile(ref.abs, `---\n${fm}\n---\n${TEMPLATES[ref.collection] ?? ''}`);
    return { file: `${ref.collection}/${ref.name}.mdx` };
  }

  async function upload(ref: ArticleRef, originalName: string, data: Buffer) {
    let ext = path.extname(originalName).slice(1).toLowerCase();
    if (!(EDITOR.imageExtensions as readonly string[]).includes(ext)) {
      throw new HttpError(415, `この形式の画像は使えません（${EDITOR.imageExtensions.join(', ')}）`);
    }
    if (ext === 'jpeg') ext = 'jpg';
    const dir = path.join(root, EDITOR.imageDir, ref.name);
    await fs.mkdir(dir, { recursive: true });
    const numbered = new RegExp(`^${ref.name}-(\\d+)\\.`);
    // 片付けた画像と番号がぶつからないよう、trashDir の分も数える（元に戻したときに取り違えないため）
    const used = [...await fs.readdir(dir), ...await readdir(trashDirOf(ref))].map((f) => Number(numbered.exec(f)?.[1] ?? 0));
    const file = path.join(dir, `${ref.name}-${Math.max(0, ...used) + 1}.${ext}`);
    await fs.writeFile(file, data, { flag: 'wx' });
    return { src: path.relative(ref.dir, file).split(path.sep).join('/') };
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = `${req.method} ${url.pathname}`;
    const q = (key: string) => url.searchParams.get(key);
    const json = (data: unknown) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data));
    };

    switch (route) {
      case 'GET /list': return json(await list());
      case 'GET /file': return json(await readArticle(article(q('file'))));
      case 'PUT /file': return json(await writeArticle(article(q('file')), await readJson(req)));
      case 'POST /new': return json(await createArticle(await readJson(req)));
      case 'GET /history': return json(await history(article(q('file'))));
      case 'GET /mine': return json(await mine(article(q('file'))));
      case 'DELETE /mine': {
        await fs.rm(snapshotOf(article(q('file')), 'mine'), { force: true });
        return json({});
      }
      case 'GET /revision': return json(await revision(article(q('file')), q('rev')));
      case 'POST /upload': return json(await upload(article(q('file')), q('name') ?? '', await readBody(req)));
      case 'GET /asset': {
        const abs = resolveAsset(article(q('file')), q('src'));
        const data = await fs.readFile(abs).catch(() => { throw new HttpError(404, '画像がありません'); });
        res.setHeader('Content-Type', MIME[path.extname(abs).slice(1).toLowerCase()] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        return res.end(data);
      }
      default: throw new HttpError(404, `不明な API です: ${route}`);
    }
  }

  return {
    name: 'dev-editor-api',
    apply: 'serve',
    configResolved(config) { root = config.root; },
    configureServer(server) {
      server.middlewares.use(API_BASE, (req, res) => {
        handle(req, res).catch((error: unknown) => {
          const status = error instanceof HttpError ? error.status : 500;
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        });
      });
    },
  };
}
