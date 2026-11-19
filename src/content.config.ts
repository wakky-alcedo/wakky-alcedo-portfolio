import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * date は YYYY-MM-DD のみ（works: 作品の時期 / blog: 投稿日）。
 * YAML は `2023-11-07` を Date、`2024-5-18` や時刻付きを文字列として読むため、Date は日付部分に戻してから形式を検査する。
 */
const dateOnly = z
  .preprocess(
    (value) => {
      if (!(value instanceof Date)) return value;
      // 時刻付きの Date は ISO 文字列のまま渡して下の形式チェックで落とす
      const iso = value.toISOString();
      return value.getTime() % 86_400_000 === 0 ? iso.slice(0, 10) : iso;
    },
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date は YYYY-MM-DD 形式で書く（時刻なし・ゼロ埋め）'),
  )
  .transform((value) => new Date(value));

const works = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/works' }),
  schema: ({ image }) => z.object({
    title:       z.string(),
    description: z.string(),
    date:        dateOnly,
    thumbnail:   image(),
    tags:        z.array(z.string()).default([]),
    wip:         z.boolean().default(false),
    unpublished: z.boolean().default(false),
    featured:    z.number().default(0),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) => z.object({
    title:       z.string(),
    description: z.string(),
    date:        dateOnly,
    thumbnail:   image().optional(),
    tags:        z.array(z.string()).default([]),
    wip:         z.boolean().default(false),
    unpublished: z.boolean().default(false),
  }),
});

export const collections = { works, blog };
