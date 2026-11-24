/**
 * フロントマターの編集フォーム。項目は src/content.config.ts のスキーマに合わせる。
 * フォームにない項目はそのまま残す（frontmatter オブジェクトを直接書き換える）。
 */
import { EDITOR } from '../../config/editor';

interface Field {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'tags' | 'image' | 'checkbox' | 'number';
  collections?: string[];
}

const FIELDS: Field[] = [
  { key: 'title', label: 'タイトル', type: 'text' },
  { key: 'description', label: '概要（カードと検索結果に出る一文）', type: 'textarea' },
  { key: 'date', label: '日付', type: 'date' },
  { key: 'tags', label: 'タグ（Enter かカンマで追加／下の候補をクリック）', type: 'tags' },
  { key: 'thumbnail', label: 'サムネイル（画像をドロップ）', type: 'image' },
  { key: 'wip', label: '制作中（WIP）', type: 'checkbox' },
  { key: 'unpublished', label: '非公開（dev でのみ表示）', type: 'checkbox' },
  { key: 'featured', label: 'Featured の順位（0 で対象外）', type: 'number', collections: ['works'] },
];

interface FormOptions {
  collection: string;
  frontmatter: Record<string, unknown>;
  /** 他の記事で使われているタグ（よく使う順） */
  knownTags: string[];
  resolveImage: (src: string) => string;
  upload: (image: File) => Promise<string>;
  onChange: () => void;
  onError: (message: string) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props);
}

function imageField(field: Field, opts: FormOptions): HTMLElement {
  const { frontmatter: fm } = opts;
  const zone = el('div', { className: 'ed-thumb', tabIndex: 0 });
  const img = el('img', { alt: '' });
  const hint = el('span', { className: 'ed-thumb__hint', textContent: 'ここに画像をドロップ／クリックで選択' });
  const input = el('input', { type: 'file', accept: 'image/*', hidden: true });
  const show = () => {
    const src = typeof fm[field.key] === 'string' ? (fm[field.key] as string) : '';
    img.hidden = !src;
    if (src) img.src = opts.resolveImage(src);
    zone.title = src;
  };
  const use = async (file: File | undefined) => {
    if (!file?.type.startsWith('image/')) return;
    try {
      fm[field.key] = await opts.upload(file);
      show();
      opts.onChange();
    } catch (e) {
      opts.onError(`サムネイルを保存できませんでした：${e instanceof Error ? e.message : e}`);
    }
  };
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-over');
    void use(e.dataTransfer?.files[0]);
  });
  input.addEventListener('change', () => void use(input.files?.[0]));
  zone.append(img, hint, input);
  show();
  return zone;
}

/** タグ欄：付けたタグのチップ＋入力欄（補完あり）＋よく使うタグの候補 */
function tagsField(field: Field, opts: FormOptions): HTMLElement {
  const { frontmatter: fm } = opts;
  const tags = (): string[] => (Array.isArray(fm[field.key]) ? (fm[field.key] as unknown[]).map(String) : []);
  const wrap = el('div', { className: 'ed-tags' });
  const chips = el('span', { className: 'ed-tags__chips' });
  const listId = `ed-tags-list-${field.key}`;
  const input = el('input', { type: 'text', placeholder: 'タグを入力' });
  input.setAttribute('list', listId);
  const datalist = el('datalist', { id: listId });
  const suggest = el('div', { className: 'ed-tags__suggest' });

  const set = (next: string[]) => {
    fm[field.key] = next;
    render();
    opts.onChange();
  };
  const add = (raw: string) => {
    const added = raw.split(/[,，、]/).map((t) => t.trim()).filter((t) => t && !tags().includes(t));
    if (added.length) set([...tags(), ...added]);
  };

  function render() {
    const current = tags();
    chips.replaceChildren(...current.map((tag) => {
      const chip = el('button', { type: 'button', className: 'ed-tag is-on', textContent: `${tag} ×`, title: '外す' });
      chip.addEventListener('click', () => set(tags().filter((t) => t !== tag)));
      return chip;
    }));
    const rest = opts.knownTags.filter((t) => !current.includes(t));
    datalist.replaceChildren(...rest.map((t) => el('option', { value: t })));
    suggest.replaceChildren(...rest.slice(0, EDITOR.tagSuggestions).map((tag) => {
      const chip = el('button', { type: 'button', className: 'ed-tag', textContent: `+ ${tag}` });
      chip.addEventListener('click', () => add(tag));
      return chip;
    }));
  }

  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return; // 日本語変換の確定の Enter では追加しない
    if (e.key === 'Enter') {
      e.preventDefault();
      add(input.value);
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && tags().length) {
      set(tags().slice(0, -1));
    }
  });
  input.addEventListener('input', () => {
    // カンマを打つか、候補から選んだら追加する
    if (/[,，、]/.test(input.value) || opts.knownTags.includes(input.value)) {
      add(input.value);
      input.value = '';
    }
  });
  input.addEventListener('blur', () => { add(input.value); input.value = ''; });

  // 入力欄はチップと別の要素に置く（描き直しでフォーカスが外れないように）
  const box = el('div', { className: 'ed-tags__box' });
  box.append(chips, input);
  render();
  wrap.append(box, datalist, suggest);
  return wrap;
}

function inputField(field: Field, opts: FormOptions): HTMLElement {
  const { frontmatter: fm } = opts;
  const value = fm[field.key];
  let input: HTMLInputElement | HTMLTextAreaElement;

  switch (field.type) {
    case 'textarea':
      input = el('textarea', { rows: 2, value: String(value ?? '') });
      break;
    case 'checkbox':
      input = el('input', { type: 'checkbox', checked: value === true });
      break;
    case 'number':
      input = el('input', { type: 'number', value: String(value ?? 0), min: '0' });
      break;
    default:
      input = el('input', { type: field.type, value: String(value ?? '') });
  }

  input.addEventListener('input', () => {
    if (field.type === 'checkbox') fm[field.key] = (input as HTMLInputElement).checked;
    else if (field.type === 'number') fm[field.key] = Number(input.value) || 0;
    else fm[field.key] = input.value;
    opts.onChange();
  });
  return input;
}

export function renderForm(container: HTMLElement, opts: FormOptions) {
  container.replaceChildren();
  for (const field of FIELDS) {
    if (field.collections && !field.collections.includes(opts.collection)) continue;
    // 画像欄・タグ欄は中にボタンがあるので label にしない（label だとクリックが入力欄などに転送される）
    const label = el(field.type === 'image' || field.type === 'tags' ? 'div' : 'label', { className: `ed-field ed-field--${field.type}` });
    label.append(el('span', { className: 'ed-field__label', textContent: field.label }));
    const widget = field.type === 'image' ? imageField(field, opts) : field.type === 'tags' ? tagsField(field, opts) : inputField(field, opts);
    label.append(widget);
    container.append(label);
  }
}
