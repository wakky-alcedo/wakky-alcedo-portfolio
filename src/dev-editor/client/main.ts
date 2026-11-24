/**
 * dev エディタの画面（/_edit）。?file=works/x.mdx があれば編集画面、なければ記事一覧。
 */
import { EditorState, Annotation, Prec } from '@codemirror/state';
import { EditorView, keymap, drawSelection, type Command } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { search, searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';
import { EDITOR } from '../../config/editor';
import { api, ApiError, type ArticleData, type ListEntry } from './server';
import { livePreview } from './livePreview';
import { mediaHandlers } from './media';
import { renderForm } from './form';
import { addRow, nextCell, prevCell } from './tables';
import { bold, code, formattingKeymap, insertLink, insertTable, italic, strike } from './formatting';

/** ツールバーのボタン（data-cmd）と実行するコマンド */
const TOOLBAR: Record<string, Command> = {
  bold, italic, strike, code, link: insertLink, table: insertTable, undo, redo, search: openSearchPanel,
};

// 記事を保存すると Astro が全ページを再読み込みさせるので、この画面だけは再読み込みしない
// （Vite は .html で終わる path の再読み込みを、そのページのときだけ行う）
import.meta.hot?.on('vite:beforeFullReload', (payload: { path?: string }) => {
  payload.path = '/__dev-editor-keeps-open.html';
});

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

/** 外から読み込んだ内容で置き換えるときの印（自動保存しない） */
const external = Annotation.define<boolean>();

function setStatus(text: string, state: 'saved' | 'dirty' | 'saving' | 'error' = 'saved') {
  const el = $('#ed-status');
  el.textContent = text;
  el.dataset.state = state;
}

function showNotice(message: string, actions: { label: string; run: () => void }[] = []) {
  const box = $('#ed-notice');
  box.replaceChildren(Object.assign(document.createElement('span'), { textContent: message }));
  for (const a of actions) {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: a.label });
    b.addEventListener('click', () => { box.hidden = true; a.run(); });
    box.append(b);
  }
  const close = Object.assign(document.createElement('button'), { type: 'button', textContent: '✕', className: 'ed-notice__close' });
  close.addEventListener('click', () => { box.hidden = true; });
  box.append(close);
  box.hidden = false;
}

/** 全記事のタグを、使われている記事が多い順に並べる（同数なら名前順） */
function tagsByUse(entries: ListEntry[]): string[] {
  const count = new Map<string, number>();
  for (const e of entries) for (const t of e.tags) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja')).map(([t]) => t);
}

async function openEditor(file: string) {
  $('#ed-list').hidden = true;
  $('#ed-editor').hidden = false;
  const collection = file.split('/')[0];
  const slug = file.split('/')[1].replace(/\.mdx$/, '');
  $('#ed-file').textContent = file;
  const viewLink = $<HTMLAnchorElement>('#ed-view');
  viewLink.href = `/${collection}/${slug}`;
  viewLink.hidden = false;

  const [first, entries] = await Promise.all([api.read(file), api.list()]);
  let data: ArticleData = first;
  const knownTags = tagsByUse(entries);
  let frontmatter = data.frontmatter;
  let mtime = data.mtime;
  let timer: number | undefined;
  let saving: Promise<void> | null = null;
  let dirty = false;

  const resolveImage = (src: string) => api.assetUrl(file, src);
  const upload = async (image: File) => (await api.upload(file, image)).src;
  const onError = (message: string) => { setStatus('エラー', 'error'); showNotice(message); };

  const save = async (force = false) => {
    if (saving) await saving;
    if (!dirty && !force) return;
    dirty = false;
    setStatus('保存中…', 'saving');
    saving = (async () => {
      try {
        ({ mtime } = await api.save(file, { frontmatter, body: view.state.doc.toString(), baseMtime: mtime, force }));
        setStatus(dirty ? '未保存' : '保存済み', dirty ? 'dirty' : 'saved');
      } catch (e) {
        dirty = true;
        if (e instanceof ApiError && e.status === 409) {
          setStatus('競合', 'error');
          showNotice('このファイルはエディタの外で変更されています。', [
            { label: '外の変更を読み込む（ここでの変更は捨てる）', run: () => void reload() },
            { label: 'ここでの内容で上書き', run: () => void save(true) },
          ]);
        } else {
          onError(`保存できませんでした：${e instanceof Error ? e.message : e}`);
        }
      } finally {
        saving = null;
      }
    })();
    await saving;
  };

  const schedule = () => {
    dirty = true;
    setStatus('未保存', 'dirty');
    clearTimeout(timer);
    timer = window.setTimeout(() => void save(), EDITOR.autosaveDelayMs);
  };

  const renderFrontmatter = () => renderForm($('#ed-form'), {
    collection, frontmatter, knownTags, resolveImage, upload, onError, onChange: schedule,
  });

  /** ファイルの内容で画面を置き換える（外で編集されたとき） */
  const reload = async () => {
    data = await api.read(file);
    frontmatter = data.frontmatter;
    mtime = data.mtime;
    dirty = false;
    const head = Math.min(view.state.selection.main.head, data.body.length);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: data.body },
      selection: { anchor: head },
      annotations: [external.of(true)],
    });
    renderFrontmatter();
    setStatus('保存済み');
  };

  const view = new EditorView({
    parent: $('#ed-body'),
    state: EditorState.create({
      doc: data.body,
      extensions: [
        history(),
        drawSelection(),
        search({ top: true }),
        highlightSelectionMatches(),
        // 表のセル移動・書式は Markdown の Enter（箇条書きの継続）より先に効かせる
        Prec.highest(keymap.of([
          { key: 'Tab', run: nextCell, shift: prevCell },
          { key: 'Enter', run: addRow },
          ...formattingKeymap,
          { key: 'Mod-s', preventDefault: true, run: () => { clearTimeout(timer); void save(); return true; } },
        ])),
        // Ctrl+F はエディタの検索（ブラウザの検索は画面付近の行しか探せないため）
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        markdown({ base: markdownLanguage }),
        EditorView.lineWrapping,
        livePreview(resolveImage),
        mediaHandlers({ upload, onError }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !u.transactions.some((t) => t.annotation(external))) schedule();
        }),
      ],
    }),
  });

  $('#ed-toolbar').addEventListener('mousedown', (e) => {
    const cmd = TOOLBAR[(e.target as HTMLElement).closest<HTMLElement>('[data-cmd]')?.dataset.cmd ?? ''];
    if (!cmd) return;
    e.preventDefault(); // エディタのフォーカスと選択範囲を保ったまま実行する
    cmd(view);
    view.focus();
  });

  renderFrontmatter();
  setStatus('保存済み');
  document.title = `編集: ${String(frontmatter.title ?? file)}`;

  // 他のタブやエディタで編集されていたら、戻ってきたときに読み直す
  window.addEventListener('focus', async () => {
    if (dirty || saving) return;
    const latest = await api.read(file).catch(() => null);
    if (latest && latest.mtime !== mtime) void reload();
  });
  window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
  view.focus();
}

async function openList() {
  $('#ed-list').hidden = false;
  $('#ed-editor').hidden = true;
  $('#ed-file').textContent = '記事一覧';
  setStatus('');

  const entries = await api.list();
  for (const collection of EDITOR.collections) {
    const ul = $(`#ed-list-${collection}`);
    ul.replaceChildren(...entries.filter((e) => e.collection === collection).map((entry) => {
      const li = document.createElement('li');
      const a = Object.assign(document.createElement('a'), { href: `/_edit?file=${encodeURIComponent(entry.file)}`, textContent: entry.title });
      const meta = Object.assign(document.createElement('span'), {
        className: 'ed-list__meta',
        textContent: [entry.date, entry.unpublished && '非公開', entry.wip && 'WIP', entry.file].filter(Boolean).join(' · '),
      });
      li.append(a, meta);
      return li;
    }));
  }

  const form = $<HTMLFormElement>('#ed-new');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const { file } = await api.create({
        collection: String(fd.get('collection')), name: String(fd.get('name')).trim(), title: String(fd.get('title')).trim(),
      });
      location.href = `/_edit?file=${encodeURIComponent(file)}`;
    } catch (err) {
      showNotice(`作成できませんでした：${err instanceof Error ? err.message : err}`);
    }
  });
}

const file = new URLSearchParams(location.search).get('file');
(file ? openEditor(file) : openList()).catch((e) => {
  setStatus('エラー', 'error');
  showNotice(e instanceof Error ? e.message : String(e));
});
