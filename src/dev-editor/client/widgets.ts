/**
 * ライブプレビューで段落ブロックの代わりに表示するウィジェット（画像・YouTube・X）。
 * クリックするとそのブロックの Markdown を編集できる状態になる。
 */
import { WidgetType, type EditorView } from '@codemirror/view';
import { parseImageAlt, type Embed } from '../../lib/embeds';
import type { ImageToken } from './blocks';
import { renderInline, type Table } from './tables';
import { focusCell } from './tableEdit';

declare global {
  interface Window {
    twttr?: { ready: (cb: (t: { widgets: { createTweet: (id: string, el: HTMLElement, opts: object) => Promise<unknown> } }) => void) => void };
  }
}

let twitterScript: Promise<void> | null = null;
function loadTwitter(): Promise<void> {
  twitterScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://platform.twitter.com/widgets.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('X の埋め込みスクリプトを読み込めませんでした'));
    document.head.append(s);
  });
  return twitterScript;
}

/** クリックでブロックの先頭にカーソルを置く（＝生の Markdown を表示して編集） */
function editOnClick(el: HTMLElement, view: EditorView) {
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const pos = view.posAtDOM(el);
    view.dispatch({ selection: { anchor: pos } });
    view.focus();
  });
}

/**
 * 画像の縦横（記事から見た相対パス → 縦横）。開くときにサーバーで調べておき（main.ts）、
 * 読み込み前の <img> に付けて高さを確保する。新しく追加した画像は、読み込んだときに覚える
 */
const imageSizes = new Map<string, { width: number; height: number }>();
export function rememberImageSizes(sizes: Record<string, { width: number; height: number }>) {
  for (const [src, size] of Object.entries(sizes)) imageSizes.set(src, size);
}

/** 本文の幅（画面外の画像の高さを見積もるため。画像を描くたびに測る） */
let contentWidth = 0;

abstract class BlockWidget extends WidgetType {
  abstract readonly key: string;
  eq(other: WidgetType) { return other instanceof BlockWidget && other.key === this.key; }
  /** ドラッグ＆ドロップだけはエディタに渡す（画像の横並び追加のため） */
  ignoreEvent(e: Event) { return !e.type.startsWith('drag') && e.type !== 'drop'; }
}

export class ImagesWidget extends BlockWidget {
  readonly key: string;
  constructor(readonly images: ImageToken[], readonly resolve: (src: string) => string) {
    super();
    this.key = JSON.stringify(images);
  }

  /**
   * 画面外にあるときの高さの見積もり。実際と違うと、上にスクロールして描かれたときに本文が動くので、
   * 縦横がわかっていれば本文の幅から計算する（.ed-images の上下の padding と、キャプションの分を足す）
   */
  get estimatedHeight() {
    const sizes = this.images.map((image) => imageSizes.get(image.src));
    if (!contentWidth || sizes.some((s) => !s)) return 320;
    const gap = 16;
    const each = (contentWidth - gap * (this.images.length - 1)) / this.images.length;
    const caption = this.images.some((image) => image.caption) ? 28 : 0;
    return Math.max(...sizes.map((s) => (each * s!.height) / s!.width)) + 24 + caption;
  }

  toDOM(view: EditorView) {
    contentWidth = view.contentDOM.clientWidth || contentWidth;
    const row = document.createElement('div');
    row.className = `ed-images${this.images.length > 1 ? ' ed-images--row' : ''}`;
    for (const image of this.images) {
      const { alt, width } = parseImageAlt(image.alt);
      const figure = document.createElement('figure');
      figure.className = 'ed-image';
      if (width !== undefined) figure.style.maxWidth = typeof width === 'number' ? `${width}px` : width;
      const img = document.createElement('img');
      const size = imageSizes.get(image.src);
      if (size) {
        // CSS の width: 100%; height: auto と合わせて、読み込み前から縦横比どおりの高さになる
        img.width = size.width;
        img.height = size.height;
      }
      img.src = this.resolve(image.src);
      img.alt = alt;
      img.onload = () => {
        imageSizes.set(image.src, { width: img.naturalWidth, height: img.naturalHeight });
        view.requestMeasure();
      };
      img.onerror = () => { figure.classList.add('ed-image--missing'); figure.dataset.src = image.src; };
      figure.append(img);
      if (image.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = image.caption;
        figure.append(caption);
      }
      row.append(figure);
    }
    editOnClick(row, view);
    return row;
  }
}

export class EmbedWidget extends BlockWidget {
  readonly key: string;
  constructor(readonly embed: Embed, readonly title?: string) {
    super();
    this.key = JSON.stringify([embed, title]);
  }

  get estimatedHeight() { return this.embed.type === 'youtube' ? 450 : 400; }

  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = `ed-embed ed-embed--${this.embed.type}`;
    const bar = document.createElement('div');
    bar.className = 'ed-embed__bar';
    bar.textContent = `${this.embed.type === 'youtube' ? '▶ YouTube' : '𝕏 ポスト'}${this.title ? `：${this.title}` : ''}（ここをクリックで編集）`;
    editOnClick(bar, view);
    wrap.append(bar);

    if (this.embed.type === 'youtube') {
      const iframe = document.createElement('iframe');
      const { id, start } = this.embed;
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`;
      iframe.title = this.title ?? 'YouTube video';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      wrap.append(iframe);
    } else {
      const target = document.createElement('div');
      target.className = 'ed-embed__tweet';
      target.textContent = '読み込み中…';
      wrap.append(target);
      const { id, url } = this.embed;
      loadTwitter()
        .then(() => new Promise<void>((resolve) => window.twttr!.ready(async (t) => {
          target.textContent = '';
          await t.widgets.createTweet(id, target, { theme: 'dark', lang: 'ja', dnt: true });
          resolve();
        })))
        .then(() => view.requestMeasure())
        .catch(() => { target.textContent = url; });
    }
    return wrap;
  }
}

export class TableWidget extends BlockWidget {
  readonly key: string;
  constructor(readonly table: Table) {
    super();
    this.key = JSON.stringify(table);
  }

  get estimatedHeight() { return 40 * (this.table.rows.length + 1); }

  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = 'ed-table-preview';
    const cell = (tag: 'th' | 'td', text: string, i: number) => {
      const el = document.createElement(tag);
      el.innerHTML = renderInline(text);
      const align = this.table.align[i];
      if (align) el.style.textAlign = align;
      return el;
    };
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    this.table.header.forEach((t, i) => head.append(cell('th', t, i)));
    const body = table.createTBody();
    for (const row of this.table.rows) {
      const tr = body.insertRow();
      row.forEach((t, i) => tr.append(cell('td', t, i)));
    }
    wrap.append(table);
    // クリックしたセルにカーソルを置く（セルの外なら表の先頭）
    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>('th, td');
      const from = view.posAtDOM(wrap);
      if (!cell) {
        view.dispatch({ selection: { anchor: from } });
        view.focus();
        return;
      }
      const tr = cell.parentElement as HTMLTableRowElement;
      const row = cell.tagName === 'TH' ? -1 : tr.sectionRowIndex;
      focusCell(view, from, row, cell.cellIndex);
    });
    return wrap;
  }
}

/** 箇条書きの「-」を「•」に見せる */
export class BulletWidget extends WidgetType {
  eq() { return true; }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'ed-bullet';
    span.textContent = '•';
    return span;
  }
}
