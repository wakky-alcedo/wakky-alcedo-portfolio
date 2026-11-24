/**
 * 表（GFM のパイプ表）のプレビューと編集操作。
 *
 * - プレビュー：カーソルが表の外にあるとき HTML の表で見せる（livePreview から使う）
 * - 編集：Tab / Shift+Tab でセル移動、表の中の Enter で行を追加（最後のセルで Tab でも追加）
 */
import { EditorSelection, type EditorState, type Line } from '@codemirror/state';
import type { Command } from '@codemirror/view';

export type Align = 'left' | 'center' | 'right' | null;
export interface Table { header: string[]; align: Align[]; rows: string[][] }

const DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const isRow = (text: string) => /^\s*\|/.test(text);

/** `| a | b |` をセルに分ける（`\|` はセル内の文字として扱う） */
export function splitRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  return text.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

/** 2 行目が区切り行（`|---|:---:|`）なら表として読む */
export function parseTable(text: string): Table | null {
  const lines = text.split('\n');
  if (lines.length < 2 || !isRow(lines[0]) || !DELIMITER.test(lines[1])) return null;
  const header = splitRow(lines[0]);
  const align = splitRow(lines[1]).map((c): Align => {
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
  });
  const rows = lines.slice(2).map((l) => {
    const cells = splitRow(l);
    return header.map((_, i) => cells[i] ?? '');
  });
  return { header, align, rows };
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** セルの中の簡単な Markdown（太字・斜体・コード・リンク・改行）を HTML にする */
export function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a>$1</a>')
    .replace(/&lt;br\s*\/?&gt;/g, '<br>');
}

// ---- 編集操作 ----

/** 表の行なら、その行のセルの区切り `|` の位置（行頭からの文字位置）を返す */
function pipes(line: Line): number[] {
  const out: number[] = [];
  for (let i = 0; i < line.text.length; i++) {
    if (line.text[i] === '|' && line.text[i - 1] !== '\\') out.push(i);
  }
  return out;
}

function tableLine(state: EditorState): Line | null {
  // セル移動でセルの中身を選択した状態からも続けて Tab を押せるよう、1 行の中の選択は許す
  const { main } = state.selection;
  const line = state.doc.lineAt(main.head);
  if (main.from < line.from || main.to > line.to) return null;
  return isRow(line.text) ? line : null;
}

/** セルの中身の先頭（`| ` の後ろ）へカーソルを置き、セルの中身を選択する */
function selectCell(line: Line, from: number, to: number) {
  const text = line.text.slice(from, to);
  // 空のセルは `| ` の後ろにカーソルを置く
  if (!text.trim()) return EditorSelection.cursor(line.from + Math.min(from + 1, to));
  const start = from + (text.length - text.trimStart().length);
  const end = to - (text.length - text.trimEnd().length);
  return EditorSelection.range(line.from + start, line.from + end);
}

function emptyRow(columns: number) {
  return `|${'  |'.repeat(columns)}`;
}

export const nextCell: Command = (view) => {
  const line = tableLine(view.state);
  if (!line) return false;
  const col = view.state.selection.main.to - line.from;
  const ps = pipes(line);
  const next = ps.findIndex((p) => p >= col);
  // 同じ行の次のセル
  if (next >= 0 && next < ps.length - 1) {
    view.dispatch({ selection: selectCell(line, ps[next] + 1, ps[next + 1]) });
    return true;
  }
  // 次の行の最初のセル（区切り行は飛ばす）。最後の行なら行を足す
  let n = line.number + 1;
  if (n <= view.state.doc.lines && DELIMITER.test(view.state.doc.line(n).text)) n++;
  if (n <= view.state.doc.lines && isRow(view.state.doc.line(n).text)) {
    const target = view.state.doc.line(n);
    const tp = pipes(target);
    view.dispatch({ selection: selectCell(target, tp[0] + 1, tp[1] ?? target.length) });
    return true;
  }
  return addRow(view);
};

export const prevCell: Command = (view) => {
  const line = tableLine(view.state);
  if (!line) return false;
  const col = view.state.selection.main.from - line.from;
  const ps = pipes(line);
  const cur = ps.findIndex((p) => p >= col) - 1;
  if (cur > 0) {
    view.dispatch({ selection: selectCell(line, ps[cur - 1] + 1, ps[cur]) });
    return true;
  }
  let n = line.number - 1;
  if (n >= 1 && DELIMITER.test(view.state.doc.line(n).text)) n--;
  if (n >= 1 && isRow(view.state.doc.line(n).text)) {
    const target = view.state.doc.line(n);
    const tp = pipes(target);
    view.dispatch({ selection: selectCell(target, tp[tp.length - 2] + 1, tp[tp.length - 1]) });
    return true;
  }
  return true;
};

/** 今の行の下に空の行を足し、その最初のセルへ移る */
export const addRow: Command = (view) => {
  const current = tableLine(view.state);
  if (!current) return false;
  // 見出し行・区切り行にいるときは、区切り行の下に足す
  const { doc } = view.state;
  let line = current;
  if (DELIMITER.test(line.text)) line = doc.line(line.number - 1);
  if (line.number < doc.lines && DELIMITER.test(doc.line(line.number + 1).text)) line = doc.line(line.number + 1);
  const columns = Math.max(1, pipes(current).length - 1);
  const insert = `\n${emptyRow(columns)}`;
  view.dispatch({
    changes: { from: line.to, insert },
    selection: { anchor: line.to + 3 },
    scrollIntoView: true,
  });
  return true;
};

/** 新しい表のひな形（2列×2行） */
export const TABLE_TEMPLATE = '| 見出し1 | 見出し2 |\n|---|---|\n|  |  |\n|  |  |';
