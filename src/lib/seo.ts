import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { SITE, SOCIAL } from '../config/site';

/** OGP・構造化データ用の画像 URL（SNS のクローラーが読める JPEG に変換した絶対 URL） */
export async function getOgImageUrl(image: ImageMetadata, site: URL): Promise<string> {
  const asset = await getImage({ src: image, ...SITE.ogImageSize, format: 'jpeg' });
  return new URL(asset.src, site).href;
}

/** サイトの作者（構造化データの Person）。sameAs は本人の SNS アカウントだけ */
function person(site: URL) {
  return {
    '@type': 'Person',
    '@id': new URL('/#person', site).href,
    name: SITE.author,
    url: new URL('/about/', site).href,
    sameAs: [SOCIAL.twitter, SOCIAL.instagram, SOCIAL.github, SOCIAL.note, SOCIAL.qiita].map((s) => s.href),
  };
}

/** トップページ用: WebSite と作者の Person */
export function homeSchema(site: URL) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': new URL('/#website', site).href,
        name: SITE.name,
        url: site.href,
        inLanguage: 'ja',
        author: { '@id': new URL('/#person', site).href },
      },
      person(site),
    ],
  };
}

/**
 * 記事ページ用: Works は Article、Blog は BlogPosting
 * https://developers.google.com/search/docs/appearance/structured-data/article
 */
export function articleSchema(entry: CollectionEntry<'works'> | CollectionEntry<'blog'>, url: string, imageUrl: string, site: URL) {
  const { title, description, date, tags } = entry.data;
  return {
    '@context': 'https://schema.org',
    '@type': entry.collection === 'blog' ? 'BlogPosting' : 'Article',
    headline: title,
    description,
    image: [imageUrl],
    datePublished: date.toISOString(),
    keywords: tags,
    inLanguage: 'ja',
    mainEntityOfPage: url,
    author: person(site),
  };
}
