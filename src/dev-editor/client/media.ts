/**
 * 画像のドラッグ＆ドロップ・貼り付けと、YouTube / X の URL の貼り付け。
 *
 * - 画像：保存して `![](パス)` を入れる。画像ブロックの上に落とすと、その右に横並びで追加する
 * - URL：埋め込みになるよう、独立した段落として入れる
 */
import { EditorView } from '@codemirror/view';
import { parseEmbedUrl } from '../../lib/embeds';
import { blockAt } from './blocks';

interface MediaOptions {
  upload: (image: File) => Promise<string>;
  onError: (message: string) => void;
}

const imageFiles = (list: FileList | null | undefined) =>
  [...(list ?? [])].filter((f) => f.type.startsWith('image/'));

/** pos の位置に、前後を空行で区切った独立した段落として text を入れる */
export function insertBlock(view: EditorView, pos: number, text: string) {
  const { doc } = view.state;
  const line = doc.lineAt(pos);
  const prevBlank = line.number === 1 || !doc.line(line.number - 1).text.trim();
  const nextBlank = line.number === doc.lines || !doc.line(line.number + 1).text.trim();
  let from = pos;
  let to = pos;
  let before: string;
  let after: string;

  if (!line.text.trim()) {
    from = line.from;
    to = line.to;
    before = prevBlank ? '' : '\n';
    after = nextBlank ? '' : '\n';
  } else if (pos === line.from) {
    before = prevBlank ? '' : '\n';
    after = '\n\n';
  } else if (pos === line.to) {
    before = '\n\n';
    after = nextBlank ? '' : '\n';
  } else {
    before = '\n\n';
    after = '\n\n';
  }
  const insert = before + text + after;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + before.length + text.length },
    scrollIntoView: true,
  });
}

async function insertImages(view: EditorView, pos: number, files: File[], opts: MediaOptions) {
  const lines: string[] = [];
  for (const file of files) {
    try {
      lines.push(`![](${await opts.upload(file)})`);
    } catch (e) {
      opts.onError(`画像を保存できませんでした：${e instanceof Error ? e.message : e}`);
    }
  }
  if (!lines.length) return;
  const text = lines.join('\n');

  // 画像ブロックの上なら、そのブロックの末尾に続けて横並びにする
  const block = blockAt(view.state.doc, pos);
  if (block?.kind === 'images') {
    view.dispatch({ changes: { from: block.to, insert: `\n${text}` }, selection: { anchor: block.to + 1 + text.length } });
    return;
  }
  insertBlock(view, pos, text);
}

export function mediaHandlers(opts: MediaOptions) {
  return EditorView.domEventHandlers({
    dragover(e) {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        return true;
      }
      return false;
    },
    drop(e, view) {
      const files = imageFiles(e.dataTransfer?.files);
      if (!files.length) return false;
      e.preventDefault();
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? view.state.selection.main.head;
      void insertImages(view, pos, files, opts);
      return true;
    },
    paste(e, view) {
      const files = imageFiles(e.clipboardData?.files);
      if (files.length) {
        e.preventDefault();
        void insertImages(view, view.state.selection.main.head, files, opts);
        return true;
      }
      // 文字を選択して URL を貼ったときはリンクにする（lang-markdown の pasteURLAsLink に任せる）
      const text = e.clipboardData?.getData('text/plain').trim() ?? '';
      const { main } = view.state.selection;
      if (main.empty && !text.includes('\n') && parseEmbedUrl(text)) {
        e.preventDefault();
        insertBlock(view, main.head, text);
        return true;
      }
      return false;
    },
  });
}
