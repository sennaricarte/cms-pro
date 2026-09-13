import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Informe um hex válido (#RGB ou #RRGGBB)');

const seoTitle = z.string();
const metaDescription = z.string().max(160);

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: ({ image }) => {
    const heroBlock = z.object({
      type: z.literal('hero'),
      heading: z.string(),
      subheading: z.string().optional(),
      image: image(),
      cta: z
        .object({
          label: z.string(),
          href: z.string(),
        })
        .optional(),
    });

    const textBlock = z.object({
      type: z.literal('text'),
      heading: z.string().optional(),
      body: z.string(),
    });

    const galleryBlock = z.object({
      type: z.literal('gallery'),
      images: z.array(
        z.object({
          src: image(),
          alt: z.string(),
        }),
      ),
    });

    const ctaBlock = z.object({
      type: z.literal('cta'),
      heading: z.string(),
      body: z.string().optional(),
      buttonLabel: z.string(),
      buttonHref: z.string(),
    });

    return z.object({
      title: z.string(),
      slug: z.string(),
      seoTitle,
      metaDescription,
      ogImage: z.string().optional(),
      blocks: z.array(z.discriminatedUnion('type', [heroBlock, textBlock, galleryBlock, ctaBlock])),
      publishedDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
    });
  },
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      slug: z.string(),
      seoTitle,
      metaDescription,
      ogImage: z.string(),
      excerpt: z.string(),
      featuredImage: z.object({
        src: image(),
        alt: z.string(),
      }),
      author: z.string(),
      tags: z.array(z.string()).optional(),
      publishedDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
    }),
});

const media = defineCollection({
  loader: file('src/data/media-index.json'),
  schema: z.object({
    id: z.string(),
    filename: z.string(),
    // file() não resolve image() contra src/assets como o glob() faz.
    // Este índice guarda o path público/CMS (ex.: /uploads/foo.jpg), não um ImageMetadata.
    path: z.string(),
    alt: z.string(),
    width: z.number(),
    height: z.number(),
    uploadedDate: z.coerce.date(),
  }),
});

const siteSettings = defineCollection({
  loader: file('src/data/site-settings.json'),
  schema: z.object({
    id: z.string(),
    siteName: z.string(),
    siteUrl: z.string().url(),
    logo: z.object({
      // SVG de favicon/marca: image() rasteriza e o <Image /> não otimiza SVG de forma útil.
      // Mantemos string para apontar a /public/uploads/logo.svg (ou URL) sem passar pelo pipeline.
      path: z.string(),
      alt: z.string(),
    }),
    colors: z.object({
      primary: hexColor,
      secondary: hexColor,
      accent: hexColor,
      background: hexColor,
      text: hexColor,
    }),
    fonts: z.object({
      primaryFamily: z.string(),
      primaryWeights: z.array(z.number()),
      secondaryFamily: z.string().optional(),
      secondaryWeights: z.array(z.number()).optional(),
    }),
    socialLinks: z
      .array(
        z.object({
          platform: z.string(),
          url: z.string().url(),
        }),
      )
      .optional(),
    organization: z.object({
      legalName: z.string().optional(),
      logo: z.string().optional(),
      sameAs: z.array(z.string()).optional(),
    }),
  }),
});

export const collections = {
  pages,
  articles,
  media,
  siteSettings,
};
