import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const works = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/works' }),
  schema: ({ image }) => z.object({
    title:       z.string(),
    description: z.string(),
    date:        z.coerce.date(),
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
    date:        z.coerce.date(),
    thumbnail:   image().optional(),
    tags:        z.array(z.string()).default([]),
    wip:         z.boolean().default(false),
    unpublished: z.boolean().default(false),
  }),
});

export const collections = { works, blog };
