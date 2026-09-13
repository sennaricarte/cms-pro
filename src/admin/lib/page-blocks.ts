export interface HeroCta {
  label: string;
  href: string;
}

export interface HeroBlockData {
  type: 'hero';
  heading: string;
  subheading?: string;
  image: string;
  cta?: HeroCta;
}

export interface TextBlockData {
  type: 'text';
  heading?: string;
  body: string;
}

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface GalleryBlockData {
  type: 'gallery';
  images: GalleryImage[];
}

export interface CtaBlockData {
  type: 'cta';
  heading: string;
  body?: string;
  buttonLabel: string;
  buttonHref: string;
}

export type PageBlock = HeroBlockData | TextBlockData | GalleryBlockData | CtaBlockData;

export type PageBlockType = PageBlock['type'];

export interface BlockEditorProps<T extends PageBlock> {
  data: T;
  onChange: (next: T) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  disabled?: boolean;
  errors?: Record<string, string>;
  idPrefix?: string;
}

export function createEmptyBlock(type: PageBlockType): PageBlock {
  switch (type) {
    case 'hero':
      return { type: 'hero', heading: '', image: '' };
    case 'text':
      return { type: 'text', body: '' };
    case 'gallery':
      return { type: 'gallery', images: [{ src: '', alt: '' }] };
    case 'cta':
      return { type: 'cta', heading: '', buttonLabel: '', buttonHref: '' };
  }
}

export function blockTypeLabel(type: PageBlockType): string {
  switch (type) {
    case 'hero':
      return 'Hero';
    case 'text':
      return 'Texto';
    case 'gallery':
      return 'Galeria';
    case 'cta':
      return 'CTA';
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseCta(value: unknown): HeroCta | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const label = asString(value.label);
  const href = asString(value.href);

  if (!label && !href) {
    return undefined;
  }

  return { label, href };
}

export function parsePageBlocks(value: unknown): PageBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const blocks: PageBlock[] = [];

  for (const raw of value) {
    if (!isRecord(raw)) {
      continue;
    }

    const type = asString(raw.type);

    if (type === 'hero') {
      blocks.push({
        type: 'hero',
        heading: asString(raw.heading),
        subheading: asString(raw.subheading) || undefined,
        image: asString(raw.image),
        cta: parseCta(raw.cta),
      });
      continue;
    }

    if (type === 'text') {
      blocks.push({
        type: 'text',
        heading: asString(raw.heading) || undefined,
        body: asString(raw.body),
      });
      continue;
    }

    if (type === 'gallery') {
      const images = Array.isArray(raw.images)
        ? raw.images
            .filter(isRecord)
            .map((image) => ({ src: asString(image.src), alt: asString(image.alt) }))
        : [];

      blocks.push({
        type: 'gallery',
        images: images.length > 0 ? images : [{ src: '', alt: '' }],
      });
      continue;
    }

    if (type === 'cta') {
      blocks.push({
        type: 'cta',
        heading: asString(raw.heading),
        body: asString(raw.body) || undefined,
        buttonLabel: asString(raw.buttonLabel),
        buttonHref: asString(raw.buttonHref),
      });
    }
  }

  return blocks;
}

export function serializePageBlock(block: PageBlock): Record<string, unknown> {
  switch (block.type) {
    case 'hero': {
      const data: Record<string, unknown> = {
        type: 'hero',
        heading: block.heading.trim(),
        image: block.image.trim(),
      };

      if (block.subheading?.trim()) {
        data.subheading = block.subheading.trim();
      }

      if (block.cta?.label.trim() && block.cta.href.trim()) {
        data.cta = {
          label: block.cta.label.trim(),
          href: block.cta.href.trim(),
        };
      }

      return data;
    }

    case 'text': {
      const data: Record<string, unknown> = {
        type: 'text',
        body: block.body,
      };

      if (block.heading?.trim()) {
        data.heading = block.heading.trim();
      }

      return data;
    }

    case 'gallery':
      return {
        type: 'gallery',
        images: block.images.map((image) => ({
          src: image.src.trim(),
          alt: image.alt.trim(),
        })),
      };

    case 'cta': {
      const data: Record<string, unknown> = {
        type: 'cta',
        heading: block.heading.trim(),
        buttonLabel: block.buttonLabel.trim(),
        buttonHref: block.buttonHref.trim(),
      };

      if (block.body?.trim()) {
        data.body = block.body.trim();
      }

      return data;
    }
  }
}
