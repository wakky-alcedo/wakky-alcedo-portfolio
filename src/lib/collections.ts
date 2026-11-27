import { getCollection, type CollectionEntry } from 'astro:content';

type EntryCollection = 'works' | 'blog';

/** dev サーバーでは unpublished のエントリも表示する（build では常に除外） */
export const SHOW_UNPUBLISHED = import.meta.env.DEV;

/** 一覧・詳細ページに出すエントリ（Works / Blog 共通の公開判定） */
export function getVisibleEntries<C extends EntryCollection>(collection: C): Promise<CollectionEntry<C>[]> {
  return getCollection(collection, ({ data }) => SHOW_UNPUBLISHED || !data.unpublished);
}
