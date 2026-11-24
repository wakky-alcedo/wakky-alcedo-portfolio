/**
 * フロントマターの編集フォーム。項目は src/content.config.ts のスキーマに合わせる。
 * フォームにない項目はそのまま残す（frontmatter オブジェクトを直接書き換える）。
 */
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
  { key: 'tags', label: 'タグ（カンマ区切り）', type: 'tags' },
  { key: 'thumbnail', label: 'サムネイル（画像をドロップ）', type: 'image' },
  { key: 'wip', label: '制作中（WIP）', type: 'checkbox' },
  { key: 'unpublished', label: '非公開（dev でのみ表示）', type: 'checkbox' },
  { key: 'featured', label: 'Featured の順位（0 で対象外）', type: 'number', collections: ['works'] },
];

interface FormOptions {
  collection: string;
  frontmatter: Record<string, unknown>;
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
    case 'tags':
      input = el('input', { type: 'text', value: Array.isArray(value) ? value.join(', ') : '' });
      break;
    default:
      input = el('input', { type: field.type, value: String(value ?? '') });
  }

  input.addEventListener('input', () => {
    if (field.type === 'checkbox') fm[field.key] = (input as HTMLInputElement).checked;
    else if (field.type === 'number') fm[field.key] = Number(input.value) || 0;
    else if (field.type === 'tags') fm[field.key] = input.value.split(/[,，、]/).map((t) => t.trim()).filter(Boolean);
    else fm[field.key] = input.value;
    opts.onChange();
  });
  return input;
}

export function renderForm(container: HTMLElement, opts: FormOptions) {
  container.replaceChildren();
  for (const field of FIELDS) {
    if (field.collections && !field.collections.includes(opts.collection)) continue;
    // 画像欄は自前でファイル選択を開くので label にしない（label だとクリックが二重になる）
    const label = el(field.type === 'image' ? 'div' : 'label', { className: `ed-field ed-field--${field.type}` });
    label.append(el('span', { className: 'ed-field__label', textContent: field.label }));
    label.append(field.type === 'image' ? imageField(field, opts) : inputField(field, opts));
    container.append(label);
  }
}
