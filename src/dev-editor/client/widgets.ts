/**
 * ライブプレビューで段落ブロックの代わりに表示するウィジェット（画像・YouTube・X）。
 * クリックするとそのブロックの Markdown を編集できる状態になる。
 */
import { WidgetType, type EditorView } from '@codemirror/view';
import { parseImageAlt, type Embed } from '../../lib/embeds';
import type { ImageToken } from './blocks';
import { renderInline, type Table } from './tables';

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

  get estimatedHeight() { return 320; }

  toDOM(view: EditorView) {
    const row = document.createElement('div');
    row.className = `ed-images${this.images.length > 1 ? ' ed-images--row' : ''}`;
    for (const image of this.images) {
      const { alt, width } = parseImageAlt(image.alt);
      const figure = document.createElement('figure');
      figure.className = 'ed-image';
      if (width !== undefined) figure.style.maxWidth = typeof width === 'number' ? `${width}px` : width;
      const img = document.createElement('img');
      img.src = this.resolve(image.src);
      img.alt = alt;
      img.onload = () => view.requestMeasure();
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
    editOnClick(wrap, view);
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
