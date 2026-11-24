/**
 * Obsidian 風ライブプレビュー。カーソルのある行だけ Markdown の記号を見せ、それ以外は整形して表示する。
 *
 * - 行内（見出し・太字・リンクなど）：ViewPlugin が記号を隠し、見た目のクラスを付ける
 * - 画像・埋め込みのブロック：StateField がウィジェットに置き換える（カーソルがあるときは下に並べる）
 * - 表：カーソルが外にあるときだけ HTML の表に置き換える
 */
import { StateField, type EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { findBlocks } from './blocks';
import { BulletWidget, EmbedWidget, ImagesWidget, TableWidget } from './widgets';

const hide = Decoration.replace({});
const lineClass = (cls: string) => Decoration.line({ class: cls });
const markClass = (cls: string) => Decoration.mark({ class: cls });
const bullet = Decoration.replace({ widget: new BulletWidget() });

/** カーソル（選択範囲）が掛かっている行番号 */
function activeLines(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const r of state.selection.ranges) {
    const first = state.doc.lineAt(r.from).number;
    const last = state.doc.lineAt(r.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

function inlineDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const active = activeLines(state);
  const isActive = (pos: number) => active.has(state.doc.lineAt(pos).number);
  const decos: Range<Decoration>[] = [];
  const eachLine = (from: number, to: number, cls: string) => {
    for (let pos = from; pos <= to;) {
      const line = state.doc.lineAt(pos);
      decos.push(lineClass(cls).range(line.from));
      pos = line.to + 1;
    }
  };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from, to,
      enter(node) {
        const name = node.name;
        const heading = /^ATXHeading(\d)$/.exec(name);
        if (heading) {
          decos.push(lineClass(`ed-h ed-h${heading[1]}`).range(state.doc.lineAt(node.from).from));
          return;
        }
        switch (name) {
          case 'HeaderMark': {
            if (isActive(node.from)) return;
            const end = state.doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to;
            decos.push(hide.range(node.from, end));
            return;
          }
          case 'Emphasis': decos.push(markClass('ed-em').range(node.from, node.to)); return;
          case 'StrongEmphasis': decos.push(markClass('ed-strong').range(node.from, node.to)); return;
          case 'Strikethrough': decos.push(markClass('ed-strike').range(node.from, node.to)); return;
          case 'InlineCode': decos.push(markClass('ed-code').range(node.from, node.to)); return;
          case 'EmphasisMark':
          case 'StrikethroughMark':
            if (!isActive(node.from)) decos.push(hide.range(node.from, node.to));
            return;
          case 'CodeMark':
            if (node.node.parent?.name === 'InlineCode' && !isActive(node.from)) decos.push(hide.range(node.from, node.to));
            return;
          case 'Link': {
            decos.push(markClass('ed-link').range(node.from, node.to));
            if (isActive(node.from)) return false;
            // [テキスト](URL) のテキスト以外を隠す
            const cursor = node.node.cursor();
            if (cursor.firstChild()) {
              do {
                if (['LinkMark', 'URL', 'LinkTitle'].includes(cursor.name)) decos.push(hide.range(cursor.from, cursor.to));
              } while (cursor.nextSibling());
            }
            return false;
          }
          case 'URL': decos.push(markClass('ed-link').range(node.from, node.to)); return;
          case 'Image': return false;
          case 'Blockquote': eachLine(node.from, node.to, 'ed-quote'); return;
          case 'QuoteMark':
            if (!isActive(node.from)) decos.push(hide.range(node.from, Math.min(node.to + 1, state.doc.lineAt(node.from).to)));
            return;
          case 'ListMark': {
            const mark = state.doc.sliceString(node.from, node.to);
            if (/^[-*+]$/.test(mark) && !isActive(node.from)) decos.push(bullet.range(node.from, node.to));
            return;
          }
          case 'HorizontalRule': eachLine(node.from, node.to, 'ed-hr'); return;
          case 'FencedCode': eachLine(node.from, node.to, 'ed-codeblock'); return false;
          case 'Table': eachLine(node.from, node.to, 'ed-table'); return false;
          case 'HTMLBlock': eachLine(node.from, node.to, 'ed-jsx'); return false;
          default: return;
        }
      },
    });

    // MDX のコメント {/* … */} と import 行は控えめに
    for (let pos = from; pos <= to;) {
      const line = state.doc.lineAt(pos);
      if (/^\s*(\{\/\*.*\*\/\}|import\s.+from\s)/.test(line.text)) decos.push(lineClass('ed-dim').range(line.from));
      pos = line.to + 1;
    }
  }
  return Decoration.set(decos, true);
}

const inlinePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = inlineDecorations(view); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
        this.decorations = inlineDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/** 画像・埋め込みブロックのウィジェット（ブロック単位の置き換えは StateField から出す必要がある） */
function blockPreview(resolveImage: (src: string) => string) {
  const build = (state: EditorState): DecorationSet => {
    const decos: Range<Decoration>[] = [];
    for (const block of findBlocks(state.doc)) {
      if (block.kind === 'other') continue;
      const editing = state.selection.ranges.some((r) => r.from <= block.to && r.to >= block.from);
      // 表は編集中ならプレビューを出さず、等幅の Markdown のまま（Tab でセル移動）
      if (block.kind === 'table') {
        if (!editing) decos.push(Decoration.replace({ widget: new TableWidget(block.table!), block: true }).range(block.from, block.to));
        continue;
      }
      const widget = block.kind === 'images'
        ? new ImagesWidget(block.images!, resolveImage)
        : new EmbedWidget(block.embed!, block.title);
      decos.push(editing
        ? Decoration.widget({ widget, block: true, side: 1 }).range(block.to)
        : Decoration.replace({ widget, block: true }).range(block.from, block.to));
    }
    return Decoration.set(decos, true);
  };

  return StateField.define<DecorationSet>({
    create: build,
    update: (value, tr) => (tr.docChanged || tr.selection ? build(tr.state) : value),
    provide: (f) => EditorView.decorations.from(f),
  });
}

export function livePreview(resolveImage: (src: string) => string) {
  return [inlinePreview, blockPreview(resolveImage)];
}
