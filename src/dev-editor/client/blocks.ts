/**
 * 本文を「段落ブロック」（空行で区切られた行のまとまり）に分け、画像・埋め込みのブロックを見つける。
 * 判定はビルド時の src/lib/remark-embeds.ts と同じ考え方（画像だけの段落／URL だけの段落）。
 */
import type { Text } from '@codemirror/state';
import { parseEmbedUrl, type Embed } from '../../lib/embeds';
import { parseTable, type Table } from './tables';

export interface ImageToken { alt: string; src: string; caption?: string }

export interface Block {
  from: number;
  to: number;
  kind: 'images' | 'embed' | 'table' | 'other';
  images?: ImageToken[];
  table?: Table;
  embed?: Embed;
  title?: string;
}

/** `![説明](パス "キャプション")`（キャプションに " を含むときは '…' で囲む） */
const IMAGE = /!\[([^\]]*)\]\(\s*(\S+?)(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)/g;
const ONLY_IMAGES = /^(?:\s*!\[[^\]]*\]\(\s*\S+?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\))+\s*$/;
const LINK_ONLY = /^\[([^\]]*)\]\((\S+?)\)$/;
const FENCE = /^\s*(```|~~~)/;

function classify(text: string): Pick<Block, 'kind' | 'images' | 'embed' | 'table' | 'title'> {
  const table = parseTable(text);
  if (table) return { kind: 'table', table };
  if (ONLY_IMAGES.test(text)) {
    const images = [...text.matchAll(IMAGE)].map(([, alt, src, dq, sq]) => ({ alt, src, caption: dq ?? sq }));
    return { kind: 'images', images };
  }
  const line = text.trim();
  if (!line.includes('\n')) {
    const link = LINK_ONLY.exec(line);
    const embed = parseEmbedUrl(link ? link[2] : line);
    if (embed) return { kind: 'embed', embed, title: link?.[1] || undefined };
  }
  return { kind: 'other' };
}

/** 本文全体を段落ブロックに分ける（コードブロックの中は 1 ブロック扱いで判定しない） */
export function findBlocks(doc: Text): Block[] {
  const blocks: Block[] = [];
  let start: number | null = null;
  let end = 0;
  let inFence = false;
  let fenced = false;

  const flush = () => {
    if (start === null) return;
    const text = doc.sliceString(start, end);
    blocks.push({ from: start, to: end, ...(fenced ? { kind: 'other' as const } : classify(text)) });
    start = null;
    fenced = false;
  };

  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (FENCE.test(line.text)) {
      if (!inFence) { flush(); start = line.from; fenced = true; }
      inFence = !inFence;
      end = line.to;
      continue;
    }
    if (inFence) { end = line.to; continue; }
    if (!line.text.trim()) { flush(); continue; }
    if (start === null) start = line.from;
    end = line.to;
  }
  flush();
  return blocks;
}

export function blockAt(doc: Text, pos: number): Block | undefined {
  return findBlocks(doc).find((b) => b.from <= pos && pos <= b.to);
}
