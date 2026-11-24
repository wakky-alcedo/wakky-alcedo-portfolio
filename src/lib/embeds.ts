/**
 * 記事の Markdown 記法の解釈（ビルド時の remark-embeds と dev エディタのプレビューで共通）。
 *
 * - 画像：`![説明|幅](パス "キャプション")`。幅は `80%` か px の数値（`400`）
 * - 埋め込み：段落に URL だけ（または `[タイトル](URL)` だけ）があるとき、YouTube / X の URL なら埋め込みにする
 */

export type Embed =
  | { type: 'youtube'; id: string; start?: number }
  | { type: 'tweet'; url: string; id: string };

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com']);
const TWEET_HOSTS = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']);
const YOUTUBE_ID = /^[\w-]{11}$/;

/** `11325` / `11325s` / `3h8m45s` を秒にする */
function parseSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+s?$/.test(value)) return Number.parseInt(value, 10) || undefined;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!m || !m[0]) return undefined;
  const sec = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return sec || undefined;
}

function parseYouTube(url: URL): Embed | null {
  const host = url.hostname;
  if (!YOUTUBE_HOSTS.has(host)) return null;
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.slice(1);
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v');
  } else {
    // /live/ID, /shorts/ID, /embed/ID
    const m = /^\/(?:live|shorts|embed)\/([^/]+)/.exec(url.pathname);
    id = m?.[1] ?? null;
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;
  const start = parseSeconds(url.searchParams.get('t') ?? url.searchParams.get('start'));
  return start ? { type: 'youtube', id, start } : { type: 'youtube', id };
}

function parseTweet(url: URL): Embed | null {
  if (!TWEET_HOSTS.has(url.hostname)) return null;
  const m = /^\/[^/]+\/status\/(\d+)/.exec(url.pathname);
  if (!m) return null;
  return { type: 'tweet', url: `https://x.com${m[0]}`, id: m[1] };
}

/** 埋め込みにする URL なら、その種類と ID を返す */
export function parseEmbedUrl(raw: string): Embed | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return parseYouTube(url) ?? parseTweet(url);
}

/** YouTube の埋め込みを、記事に書く短い URL に戻す（移行・貼り付け用） */
export function youtubeUrl(id: string, start?: number): string {
  return `https://youtu.be/${id}${start ? `?t=${start}` : ''}`;
}

/** 画像の alt `説明|80%` を説明と幅に分ける。幅は px なら数値、% なら文字列 */
export function parseImageAlt(raw: string): { alt: string; width?: number | string } {
  const m = /^(.*)\|\s*(\d+(?:\.\d+)?)(%|px)?\s*$/.exec(raw);
  if (!m) return { alt: raw };
  const [, alt, num, unit] = m;
  return { alt: alt.trim(), width: unit === '%' ? `${num}%` : Number(num) };
}
