/**
 * 記事の素の Markdown を、記事用コンポーネントに変換する remark プラグイン（MDX のみに適用）。
 *
 * - 画像だけの段落：1枚なら段落を外して画像のみに、2枚以上なら <FlexRow> で横並びにする
 *   （画像そのものは ArticleLayout が img を MarkdownImage に差し替えて描画する）
 * - URL だけの段落：YouTube なら <YouTube>、X なら <TwitterEmbed> にする
 * いずれも本文の直下の段落だけが対象（箇条書き・引用の中はそのまま）。
 *
 * コンポーネントは ArticleLayout の <Content components> で渡すので、記事に import は要らない。
 * 記法の解釈は src/lib/embeds.ts。
 */
import type { Root } from 'mdast';
import { visit, SKIP } from 'unist-util-visit';
import { parseEmbedUrl, type Embed } from './embeds';

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  [key: string]: unknown;
}

const attr = (name: string, value: string) => ({ type: 'mdxJsxAttribute', name, value });

function isBlankText(node: MdNode): boolean {
  return node.type === 'text' && !node.value?.trim();
}

function textOf(node: MdNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

/** 段落の中身が URL 1つ（自動リンク or [タイトル](URL)）なら、その URL とタイトルを返す */
function soleLink(children: MdNode[]): { url: string; title?: string } | null {
  const nodes = children.filter((n) => !isBlankText(n));
  if (nodes.length !== 1) return null;
  const [node] = nodes;
  if (node.type === 'link' && node.url) {
    const text = textOf(node).trim();
    return { url: node.url, title: text && text !== node.url ? text : undefined };
  }
  if (node.type === 'text' && node.value) return { url: node.value.trim() };
  return null;
}

function embedNode(embed: Embed, title?: string): MdNode {
  if (embed.type === 'youtube') {
    const attributes = [attr('id', embed.id)];
    if (embed.start) attributes.push(attr('start', String(embed.start)));
    if (title) attributes.push(attr('title', title));
    return { type: 'mdxJsxFlowElement', name: 'YouTube', attributes, children: [] };
  }
  return { type: 'mdxJsxFlowElement', name: 'TwitterEmbed', attributes: [attr('url', embed.url)], children: [] };
}

export default function remarkEmbeds() {
  return (tree: Root) => {
    visit(tree as never, 'paragraph', (node: MdNode, index: number | undefined, parent: MdNode | undefined) => {
      // 本文の直下の段落だけ（箇条書きの中のリンクなどは変換しない）
      if (parent?.type !== 'root' || !parent.children || index === undefined) return;
      const children = node.children ?? [];

      const content = children.filter((n) => !isBlankText(n));
      if (content.length > 0 && content.every((n) => n.type === 'image')) {
        const replacement = content.length === 1
          ? content[0]
          : { type: 'mdxJsxFlowElement', name: 'FlexRow', attributes: [], children: content };
        parent.children.splice(index, 1, replacement);
        return [SKIP, index + 1];
      }

      const link = soleLink(children);
      const embed = link && parseEmbedUrl(link.url);
      if (embed) {
        parent.children.splice(index, 1, embedNode(embed, link.title));
        return [SKIP, index + 1];
      }
    });
  };
}
