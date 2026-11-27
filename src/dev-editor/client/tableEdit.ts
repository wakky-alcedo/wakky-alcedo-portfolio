/**
 * 表の行・列の追加と削除（ツールバーの「表」のボタンから使う）。
 *
 * カーソルのある表を読み直し、操作したあと表全体を書き直す（セルの区切りの空白は揃え直す）。
 * 操作のあとは、追加した行・列（削除なら隣）のセルにカーソルを置く。
 */
import type { EditorState } from '@codemirror/state';
import type { Command, EditorView } from '@codemirror/view';
import { blockAt } from './blocks';
import { splitRow, type Align, type Table } from './tables';

/** カーソルのある表と、その中のセルの位置（row は見出し行が -1、本文の 1 行目が 0） */
interface TableCursor {
  from: number;
  to: number;
  table: Table;
  row: number;
  col: number;
}

export function tableAt(state: EditorState, pos = state.selection.main.head): TableCursor | null {
  const block = blockAt(state.doc, pos);
  if (block?.kind !== 'table' || !block.table) return null;
  const line = state.doc.lineAt(pos);
  const index = line.number - state.doc.lineAt(block.from).number;
  // 区切り行（2 行目）は見出し行として扱う
  const row = index <= 1 ? -1 : index - 2;
  const before = line.text.slice(0, pos - line.from);
  const pipesBefore = (before.match(/(?<!\\)\|/g) ?? []).length;
  const leading = /^\s*\|/.test(line.text) ? 1 : 0;
  const col = Math.min(Math.max(pipesBefore - leading, 0), block.table.header.length - 1);
  return { from: block.from, to: block.to, table: block.table, row, col };
}

const escapeCell = (text: string) => text.replace(/\|/g, '\\|');
const rowText = (cells: string[]) => `| ${cells.map(escapeCell).join(' | ')} |`;
const delimiter = (align: Align) =>
  align === 'center' ? ':---:' : align === 'right' ? '---:' : align === 'left' ? ':---' : '---';

function serialize(table: Table): string {
  return [
    rowText(table.header),
    `| ${table.align.map(delimiter).join(' | ')} |`,
    ...table.rows.map(rowText),
  ].join('\n');
}

/** 書き直した表の中で、row 行 col 列のセルの中身の先頭の位置（表の先頭からの文字数） */
function cellOffset(table: Table, row: number, col: number): number {
  const lines = serialize(table).split('\n');
  const lineIndex = row < 0 ? 0 : row + 2;
  let offset = lines.slice(0, lineIndex).reduce((n, l) => n + l.length + 1, 0);
  const cells = row < 0 ? table.header : table.rows[row];
  offset += 2; // 行頭の `| `
  for (let i = 0; i < col; i++) offset += escapeCell(cells[i]).length + 3; // ` | `
  return offset;
}

/** 表を書き換えて、指定したセルにカーソルを置く（セルの中身があれば選択する） */
function apply(view: EditorView, cur: TableCursor, table: Table, row: number, col: number) {
  const start = cur.from + cellOffset(table, row, col);
  const length = escapeCell((row < 0 ? table.header : table.rows[row])[col]).length;
  view.dispatch({
    changes: { from: cur.from, to: cur.to, insert: serialize(table) },
    selection: { anchor: start, head: start + length },
    scrollIntoView: true,
  });
}

const copy = (t: Table): Table => ({ header: [...t.header], align: [...t.align], rows: t.rows.map((r) => [...r]) });

/** カーソルが表の中にあるときだけ、表を書き換える操作を実行する */
function tableCommand(edit: (t: Table, cur: TableCursor) => { row: number; col: number } | null): Command {
  return (view) => {
    const cur = tableAt(view.state);
    if (!cur) return false;
    const table = copy(cur.table);
    const target = edit(table, cur);
    if (target) apply(view, cur, table, target.row, target.col);
    return true;
  };
}

const emptyRow = (t: Table) => t.header.map(() => '');

export const insertRowAbove = tableCommand((t, { row, col }) => {
  // 見出し行の上には足せないので、本文の 1 行目に足す
  const at = Math.max(row, 0);
  t.rows.splice(at, 0, emptyRow(t));
  return { row: at, col };
});

export const insertRowBelow = tableCommand((t, { row, col }) => {
  t.rows.splice(row + 1, 0, emptyRow(t));
  return { row: row + 1, col };
});

export const deleteRow = tableCommand((t, { row, col }) => {
  if (row < 0) return null; // 見出し行は消さない（表でなくなるため）
  t.rows.splice(row, 1);
  return { row: Math.min(row, t.rows.length - 1), col };
});

function insertColumn(t: Table, at: number) {
  t.header.splice(at, 0, '');
  t.align.splice(at, 0, null);
  for (const r of t.rows) r.splice(at, 0, '');
}

export const insertColumnLeft = tableCommand((t, { row, col }) => {
  insertColumn(t, col);
  return { row, col };
});

export const insertColumnRight = tableCommand((t, { row, col }) => {
  insertColumn(t, col + 1);
  return { row, col: col + 1 };
});

export const deleteColumn = tableCommand((t, { row, col }) => {
  if (t.header.length <= 1) return null; // 最後の 1 列は消さない
  t.header.splice(col, 1);
  t.align.splice(col, 1);
  for (const r of t.rows) r.splice(col, 1);
  return { row, col: Math.min(col, t.header.length - 1) };
});

/** プレビューの表でクリックしたセルにカーソルを置く */
export function focusCell(view: EditorView, tableFrom: number, row: number, col: number) {
  const { doc } = view.state;
  const first = doc.lineAt(tableFrom).number;
  const line = doc.line(first + (row < 0 ? 0 : row + 2));
  // セルの区切り `|` の位置から、col 列目の中身の先頭を探す
  const cells = splitRow(line.text);
  const pipes = [...line.text.matchAll(/(?<!\\)\|/g)].map((m) => m.index!);
  const leading = /^\s*\|/.test(line.text) ? 1 : 0;
  const sep = col - 1 + leading;
  let pos = sep >= 0 && pipes[sep] !== undefined ? pipes[sep] + 1 : 0;
  const length = cells[col]?.length ?? 0;
  if (length) while (line.text[pos] === ' ') pos++;
  else if (line.text[pos] === ' ') pos++; // 空のセルは `| ` の後ろ
  view.dispatch({ selection: { anchor: line.from + pos, head: line.from + pos + length } });
  view.focus();
}
