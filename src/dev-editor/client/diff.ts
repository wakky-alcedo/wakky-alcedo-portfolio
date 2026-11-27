/**
 * 本文の差分表示。比較元（最後に自分で書いた版・過去のコミット・開いたときの内容）との違いを本文に重ねて見せる。
 * @codemirror/merge の unifiedMergeView を使う（https://codemirror.net/docs/ref/#merge.unifiedMergeView）。
 *
 * - 差分を出したままでも本文は編集でき、差分はその場で計算し直される
 * - 変更ごとに「残す」（比較元をいまの内容に合わせて印を消す）と「元に戻す」（本文を比較元の内容に戻す）を選べる
 * - フロントマターはフォームで編集するので、変わった項目の名前だけを出す
 * - 「最後に自分で書いた版」の仕組みは src/dev-editor/api.ts の冒頭を参照
 */
import { Compartment, type EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { getChunks, goToNextChunk, goToPreviousChunk, unifiedMergeView } from '@codemirror/merge';
import { EDITOR } from '../../config/editor';
import { api, type Commit, type Mine, type Revision } from './server';

const OFF = 'off';
const MINE = 'mine';
const OPENED = 'opened';

interface DiffElements {
  select: HTMLSelectElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  collapse: HTMLInputElement;
  finish: HTMLButtonElement;
  count: HTMLElement;
  meta: HTMLElement;
}

interface DiffOptions {
  file: string;
  /** エディタで開いたときの内容（「開いたときの内容」と比べる用） */
  opened: Revision;
  /** いまのフロントマター */
  frontmatter: () => Record<string, unknown>;
  elements: DiffElements;
  onError: (message: string) => void;
}

/** 本文の中で変更がある範囲（ライブプレビューが、変更のあるブロックを整形せずに見せるため） */
export function changedRanges(state: EditorState): { from: number; to: number }[] {
  return getChunks(state)?.chunks.map((c) => ({ from: c.fromB, to: c.toB })) ?? [];
}

/** 変更ごとのボタン（既定の英語表記の代わり） */
function control(type: 'accept' | 'reject', action: (e: MouseEvent) => void): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.name = type;
  button.textContent = type === 'accept' ? '残す' : '元に戻す';
  button.title = type === 'accept' ? 'この変更を残す（印を消す）' : 'この部分を比較元の内容に戻す';
  button.onmousedown = action;
  return button;
}

const formatDate = (time: string | number) => {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const option = (value: string, label: string) => Object.assign(document.createElement('option'), { value, textContent: label });

export class DiffView {
  /** エディタの拡張に入れておく入れ物。比較元を選ぶと中身を差し替える */
  readonly extension;
  private readonly compartment = new Compartment();
  private readonly revisions = new Map<string, Revision>();
  private view: EditorView | null = null;
  private mine: Mine | null = null;
  private commits: Commit[] = [];
  private base: Revision | null = null;

  constructor(private readonly opts: DiffOptions) {
    this.extension = this.compartment.of([]);
    const { select, prev, next, collapse, finish } = opts.elements;
    select.addEventListener('change', () => void this.choose(select.value));
    collapse.addEventListener('change', () => this.apply());
    finish.addEventListener('click', () => void this.finishReview());
    const jump = (command: typeof goToNextChunk) => (e: MouseEvent) => {
      e.preventDefault(); // エディタのフォーカスを保ったまま移動する
      if (this.view) command(this.view);
      this.view?.focus();
    };
    prev.addEventListener('mousedown', jump(goToPreviousChunk));
    next.addEventListener('mousedown', jump(goToNextChunk));
  }

  /** 比較元の候補を読み、最後に自分で書いた版があればそれと比べる */
  async start(view: EditorView) {
    this.view = view;
    [this.mine, this.commits] = await Promise.all([
      api.mine(this.opts.file).catch(() => null),
      api.history(this.opts.file).catch(() => [] as Commit[]),
    ]);
    this.renderOptions();
    await this.choose(this.mine ? MINE : OFF);
  }

  /** ファイルを読み直したとき（エディタの外で変更されたとき）、新しくできた「自分で書いた版」があれば切り替える */
  async reloaded() {
    if (!this.view || this.mine) return;
    this.mine = await api.mine(this.opts.file).catch(() => null);
    if (!this.mine) return;
    this.renderOptions();
    await this.choose(MINE);
  }

  private renderOptions() {
    const { select, finish } = this.opts.elements;
    const current = select.value;
    select.replaceChildren(
      option(OFF, '比較しない'),
      ...(this.mine ? [option(MINE, `最後に自分で書いた版（${formatDate(this.mine.savedAt)}）`)] : []),
      option(OPENED, '開いたときの内容'),
      ...this.commits.map((c) => option(c.hash, `${formatDate(c.date)} のコミット：${c.subject}`)),
    );
    if ([...select.options].some((o) => o.value === current)) select.value = current;
    finish.hidden = !this.mine;
  }

  private async choose(value: string) {
    this.opts.elements.select.value = value;
    try {
      if (value === OFF) this.base = null;
      else if (value === MINE) this.base = this.mine;
      else if (value === OPENED) this.base = this.opts.opened;
      else {
        if (!this.revisions.has(value)) this.revisions.set(value, await api.revision(this.opts.file, value));
        this.base = this.revisions.get(value)!;
      }
    } catch (e) {
      this.base = null;
      this.opts.elements.select.value = OFF;
      this.opts.onError(`比較元を読み込めませんでした：${e instanceof Error ? e.message : e}`);
    }
    this.apply();
  }

  /** 「確認を終える」：最後に自分で書いた版を消す（次にエディタの外で変更されるまで、比較元はなくなる） */
  private async finishReview() {
    if (!confirm('確認を終えますか？「最後に自分で書いた版」を消し、次にエディタの外で変更されるまで差分を出しません。')) return;
    try {
      await api.finishReview(this.opts.file);
    } catch (e) {
      this.opts.onError(`確認を終えられませんでした：${e instanceof Error ? e.message : e}`);
      return;
    }
    this.mine = null;
    this.renderOptions();
    await this.choose(OFF);
  }

  /** 比較元・折りたたみの設定でエディタの拡張を差し替える */
  private apply() {
    if (!this.view) return;
    const { collapse } = this.opts.elements;
    this.view.dispatch({
      effects: this.compartment.reconfigure(this.base ? unifiedMergeView({
        original: this.base.body,
        mergeControls: control,
        gutter: false,
        collapseUnchanged: collapse.checked
          ? { margin: EDITOR.diff.collapseMargin, minSize: EDITOR.diff.collapseMinSize }
          : undefined,
      }) : []),
    });
    this.refresh();
  }

  /** 変更の数と、フロントマターの変わった項目を表示し直す（本文やフォームが変わるたびに呼ぶ） */
  refresh() {
    const { prev, next, collapse, count, meta } = this.opts.elements;
    const on = !!this.base && !!this.view;
    for (const el of [prev, next, collapse]) el.disabled = !on;
    if (!on) {
      count.textContent = '';
      meta.hidden = true;
      return;
    }
    const n = getChunks(this.view!.state)?.chunks.length ?? 0;
    count.textContent = n ? `本文の変更 ${n} か所` : '本文の変更なし';

    const now = this.opts.frontmatter();
    const before = this.base!.frontmatter;
    const changed = [...new Set([...Object.keys(before), ...Object.keys(now)])]
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(now[key]));
    meta.textContent = `記事の情報で変わった項目：${changed.join('，')}`;
    meta.hidden = changed.length === 0;
  }
}
