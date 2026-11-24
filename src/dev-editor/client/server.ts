/** dev エディタ API（src/dev-editor/api.ts）の呼び出し */
const BASE = '/__edit-api';

export interface ArticleData {
  frontmatter: Record<string, unknown>;
  body: string;
  mtime: number;
}

export interface ListEntry {
  file: string;
  collection: string;
  title: string;
  date: string;
  wip: boolean;
  unpublished: boolean;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `HTTP ${res.status}`);
  return data as T;
}

const q = (params: Record<string, string>) => `?${new URLSearchParams(params)}`;
const jsonBody = (method: string, body: unknown): RequestInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

export const api = {
  list: () => request<ListEntry[]>('/list'),
  read: (file: string) => request<ArticleData>(`/file${q({ file })}`),
  save: (file: string, data: { frontmatter: object; body: string; baseMtime: number; force?: boolean }) =>
    request<{ mtime: number }>(`/file${q({ file })}`, jsonBody('PUT', data)),
  create: (input: { collection: string; name: string; title: string }) =>
    request<{ file: string }>('/new', jsonBody('POST', input)),
  upload: (file: string, image: File) =>
    request<{ src: string }>(`/upload${q({ file, name: image.name || 'pasted.png' })}`, { method: 'POST', body: image }),
  /** 記事から見た相対パスの画像を、プレビューで表示できる URL にする */
  assetUrl: (file: string, src: string) =>
    /^https?:\/\//.test(src) ? src : `${BASE}/asset${q({ file, src })}`,
};
