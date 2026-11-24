/**
 * 書式のショートカット（Obsidian と同じキー）。
 * Ctrl+B 太字 / Ctrl+I 斜体 / Ctrl+K リンク / Ctrl+Shift+X 取り消し線 / Ctrl+` コード。ツールバーのボタンからも使う
 */
import { EditorSelection } from '@codemirror/state';
import type { Command, KeyBinding } from '@codemirror/view';
import { insertBlock } from './media';
import { TABLE_TEMPLATE } from './tables';

/** 選択範囲を marker で囲む。すでに囲まれていれば外す。選択がなければ marker の間にカーソルを置く */
function toggleWrap(marker: string): Command {
  return (view) => {
    const { state } = view;
    const len = marker.length;
    view.dispatch(state.changeByRange((range) => {
      const before = state.sliceDoc(range.from - len, range.from);
      const after = state.sliceDoc(range.to, range.to + len);
      const text = state.sliceDoc(range.from, range.to);
      // 外側に marker がある → 外す（斜体の * が太字の ** の一部のときは外さない）
      const partOfBold = marker === '*' && state.sliceDoc(range.from - 2, range.from) === '**'
        && state.sliceDoc(range.from - 3, range.from) !== '***';
      if (before === marker && after === marker && !partOfBold) {
        return {
          changes: [{ from: range.from - len, to: range.from }, { from: range.to, to: range.to + len }],
          range: EditorSelection.range(range.from - len, range.to - len),
        };
      }
      // 選択範囲の内側が marker で始まり終わる → 外す
      if (text.length >= len * 2 && text.startsWith(marker) && text.endsWith(marker)) {
        return {
          changes: { from: range.from, to: range.to, insert: text.slice(len, -len) },
          range: EditorSelection.range(range.from, range.to - len * 2),
        };
      }
      return {
        changes: [{ from: range.from, insert: marker }, { from: range.to, insert: marker }],
        range: EditorSelection.range(range.from + len, range.to + len),
      };
    }));
    return true;
  };
}

/** [選択](URL)。選択が URL なら [](URL) にしてテキスト側へカーソルを置く */
const insertLink: Command = (view) => {
  const { state } = view;
  view.dispatch(state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to);
    if (/^https?:\/\/\S+$/.test(text)) {
      return { changes: { from: range.from, to: range.to, insert: `[](${text})` }, range: EditorSelection.cursor(range.from + 1) };
    }
    const insert = `[${text}]()`;
    return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(range.from + insert.length - 1) };
  }));
  return true;
};

export const insertTable: Command = (view) => {
  insertBlock(view, view.state.selection.main.head, TABLE_TEMPLATE);
  return true;
};

export const bold = toggleWrap('**');
export const italic = toggleWrap('*');
export const strike = toggleWrap('~~');
export const code = toggleWrap('`');
export { insertLink };

export const formattingKeymap: KeyBinding[] = [
  { key: 'Mod-b', run: bold },
  { key: 'Mod-i', run: italic },
  { key: 'Mod-Shift-x', run: strike },
  { key: 'Mod-`', run: code },
  { key: 'Mod-k', run: insertLink },
];
