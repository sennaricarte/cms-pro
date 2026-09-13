import { useEffect, useState } from 'preact/hooks';
import { parseFrontmatter, serializeFrontmatter } from '../lib/frontmatter';
import { createOrUpdateFile, getFileContent } from '../lib/github-client';
import { slugify } from '../lib/slugify';

interface Props {
  token: string;
  mode: 'create' | 'edit';
  path?: string;
  onSaved: (deployWarning?: string) => void;
  onCancel: () => void;
}

interface FormState {
  title: string;
  slug: string;
  seoTitle: string;
  metaDescription: string;
  ogImage: string;
  excerpt: string;
  featuredImageSrc: string;
  featuredImageAlt: string;
  author: string;
  tags: string;
  publishedDate: string;
  body: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const SEO_TITLE_WARN = 60;
const META_MAX = 160;

const emptyForm = (): FormState => ({
  title: '',
  slug: '',
  seoTitle: '',
  metaDescription: '',
  ogImage: '',
  excerpt: '',
  featuredImageSrc: '',
  featuredImageAlt: '',
  author: '',
  tags: '',
  publishedDate: new Date().toISOString().slice(0, 10),
  body: '',
});

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toDateInput(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1] ?? '';
  }

  return '';
}

function tagsToInput(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }

  return value.filter((tag): tag is string => typeof tag === 'string').join(', ');
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function featuredImageFromData(data: Record<string, unknown>): { src: string; alt: string } {
  const featured = data.featuredImage;

  if (featured && typeof featured === 'object' && !Array.isArray(featured)) {
    const image = featured as Record<string, unknown>;
    return { src: asString(image.src), alt: asString(image.alt) };
  }

  return { src: '', alt: '' };
}

function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.title.trim()) {
    errors.title = 'Informe o título.';
  }

  if (!form.slug.trim()) {
    errors.slug = 'Informe o slug.';
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
    errors.slug = 'Use apenas minúsculas, números e hífens.';
  }

  if (!form.seoTitle.trim()) {
    errors.seoTitle = 'Informe o título SEO.';
  }

  if (!form.metaDescription.trim()) {
    errors.metaDescription = 'Informe a meta description.';
  } else if (form.metaDescription.trim().length > META_MAX) {
    errors.metaDescription = `A meta description não pode passar de ${META_MAX} caracteres.`;
  }

  if (!form.ogImage.trim()) {
    errors.ogImage = 'Informe o caminho público da imagem OG.';
  }

  if (!form.excerpt.trim()) {
    errors.excerpt = 'Informe o excerpt.';
  }

  if (!form.featuredImageSrc.trim()) {
    errors.featuredImageSrc = 'Informe o caminho relativo da imagem de destaque.';
  }

  if (!form.featuredImageAlt.trim()) {
    errors.featuredImageAlt = 'Informe o texto alternativo da imagem de destaque.';
  }

  if (!form.author.trim()) {
    errors.author = 'Informe o autor.';
  }

  if (!form.publishedDate) {
    errors.publishedDate = 'Informe a data de publicação.';
  }

  return errors;
}

function toFrontmatterData(form: FormState, mode: 'create' | 'edit'): Record<string, unknown> {
  const tags = parseTags(form.tags);
  const data: Record<string, unknown> = {
    title: form.title.trim(),
    slug: form.slug.trim(),
    seoTitle: form.seoTitle.trim(),
    metaDescription: form.metaDescription.trim(),
    ogImage: form.ogImage.trim(),
    excerpt: form.excerpt.trim(),
    featuredImage: {
      src: form.featuredImageSrc.trim(),
      alt: form.featuredImageAlt.trim(),
    },
    author: form.author.trim(),
    publishedDate: form.publishedDate,
  };

  if (tags.length > 0) {
    data.tags = tags;
  }

  if (mode === 'edit') {
    data.updatedDate = new Date().toISOString().slice(0, 10);
  }

  return data;
}

export default function ArticleEditor({ token, mode, path, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugManual, setSlugManual] = useState(mode === 'edit');
  const [sha, setSha] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [rateLimitMessage, setRateLimitMessage] = useState('');

  useEffect(() => {
    if (mode !== 'edit' || !path) {
      return;
    }

    let cancelled = false;

    async function loadArticle() {
      setLoading(true);
      setFormError('');
      setRateLimitMessage('');

      const result = await getFileContent(token, path);

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setLoading(false);

        if (result.code === 'RATE_LIMIT') {
          setRateLimitMessage(result.error);
        }

        setFormError(result.error);
        return;
      }

      try {
        const { data, body } = parseFrontmatter(result.content);
        const image = featuredImageFromData(data);

        setSha(result.sha);
        setForm({
          title: asString(data.title),
          slug: asString(data.slug) || path.replace(/^.*\//, '').replace(/\.md$/i, ''),
          seoTitle: asString(data.seoTitle),
          metaDescription: asString(data.metaDescription),
          ogImage: asString(data.ogImage),
          excerpt: asString(data.excerpt),
          featuredImageSrc: image.src,
          featuredImageAlt: image.alt,
          author: asString(data.author),
          tags: tagsToInput(data.tags),
          publishedDate: toDateInput(data.publishedDate),
          body,
        });
      } catch {
        setFormError('Não foi possível ler o frontmatter deste artigo. O arquivo pode estar malformado.');
      }

      setLoading(false);
    }

    void loadArticle();

    return () => {
      cancelled = true;
    };
  }, [mode, path, token]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'title' && mode === 'create' && !slugManual) {
        next.slug = slugify(String(value));
      }

      return next;
    });
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    setFormError('');
    setRateLimitMessage('');

    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);

    const filePath = `src/content/articles/${form.slug.trim()}.md`;
    const content = serializeFrontmatter(toFrontmatterData(form, mode), form.body);
    const message =
      mode === 'create' ? `cms: criar artigo ${form.slug.trim()}` : `cms: atualizar artigo ${form.slug.trim()}`;
    const writeSha = mode === 'edit' && path === filePath ? sha : undefined;

    const result = await createOrUpdateFile(token, filePath, content, message, writeSha);

    setSaving(false);

    if (!result.ok) {
      if (result.code === 'RATE_LIMIT') {
        setRateLimitMessage(result.error);
      }

      if (result.code === 'CONFLICT') {
        setFormError(
          'Este artigo foi alterado por outro processo desde que você abriu — recarregue antes de salvar',
        );
        return;
      }

      setFormError(result.error);
      return;
    }

    onSaved(result.deployWarning);
  }

  if (mode === 'edit' && !path) {
    return (
      <section class="admin-card">
        <p class="admin-error" role="alert">
          Caminho do artigo não informado.
        </p>
        <button type="button" class="admin-button admin-button--ghost" onClick={onCancel}>
          Voltar
        </button>
      </section>
    );
  }

  if (loading) {
    return (
      <section class="admin-card" aria-busy="true">
        <div class="admin-skeleton" aria-label="Carregando artigo">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  return (
    <div class="admin-editor">
      <header class="admin-editor__header">
        <div>
          <p class="admin-dashboard__eyebrow">Artigos</p>
          <h1>{mode === 'create' ? 'Novo artigo' : 'Editar artigo'}</h1>
        </div>
        <button type="button" class="admin-button admin-button--ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </header>

      {rateLimitMessage ? (
        <p class="admin-banner" role="alert">
          {rateLimitMessage}
        </p>
      ) : null}

      {formError ? (
        <p class="admin-error" role="alert">
          {formError}
        </p>
      ) : null}

      <form class="admin-card admin-form" onSubmit={handleSubmit} noValidate>
        <div class="admin-field">
          <label htmlFor="article-title">Título</label>
          <input
            id="article-title"
            type="text"
            value={form.title}
            onInput={(event) => updateField('title', (event.target as HTMLInputElement).value)}
            disabled={saving}
            required
          />
          {errors.title ? <p class="admin-field__error">{errors.title}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="article-slug">Slug</label>
          <input
            id="article-slug"
            type="text"
            value={form.slug}
            onInput={(event) => {
              setSlugManual(true);
              updateField('slug', (event.target as HTMLInputElement).value);
            }}
            disabled={saving}
            required
            spellCheck={false}
          />
          <p class="admin-field__hint">
            Arquivo: <code>src/content/articles/{form.slug || 'slug'}.md</code>
          </p>
          {errors.slug ? <p class="admin-field__error">{errors.slug}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="article-seo-title">Título SEO</label>
          <input
            id="article-seo-title"
            type="text"
            value={form.seoTitle}
            onInput={(event) => updateField('seoTitle', (event.target as HTMLInputElement).value)}
            disabled={saving}
            required
          />
          <p
            class={`admin-field__count${form.seoTitle.length > SEO_TITLE_WARN ? ' admin-field__count--warn' : ''}`}
          >
            {form.seoTitle.length} caracteres
            {form.seoTitle.length > SEO_TITLE_WARN ? ' — acima de ~60, o Google tende a cortar' : ''}
          </p>
          {errors.seoTitle ? <p class="admin-field__error">{errors.seoTitle}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="article-meta">Meta description</label>
          <textarea
            id="article-meta"
            class="admin-textarea"
            rows={3}
            value={form.metaDescription}
            onInput={(event) => updateField('metaDescription', (event.target as HTMLTextAreaElement).value)}
            disabled={saving}
            required
          />
          <p
            class={`admin-field__count${form.metaDescription.length > META_MAX ? ' admin-field__count--warn' : ''}`}
          >
            {form.metaDescription.length}/{META_MAX}
            {form.metaDescription.length > META_MAX ? ' — acima do limite do schema; o save está bloqueado' : ''}
          </p>
          {errors.metaDescription ? <p class="admin-field__error">{errors.metaDescription}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="article-og">Imagem OG</label>
          <input
            id="article-og"
            type="text"
            value={form.ogImage}
            onInput={(event) => updateField('ogImage', (event.target as HTMLInputElement).value)}
            disabled={saving}
            spellCheck={false}
            placeholder="/uploads/og-artigo.jpg"
            required
          />
          <p class="admin-field__hint">Caminho público (pasta public), não o path do pipeline de assets.</p>
          {errors.ogImage ? <p class="admin-field__error">{errors.ogImage}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="article-excerpt">Excerpt</label>
          <textarea
            id="article-excerpt"
            class="admin-textarea"
            rows={3}
            value={form.excerpt}
            onInput={(event) => updateField('excerpt', (event.target as HTMLTextAreaElement).value)}
            disabled={saving}
            required
          />
          {errors.excerpt ? <p class="admin-field__error">{errors.excerpt}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="article-image-src">Imagem de destaque (caminho relativo)</label>
          <input
            id="article-image-src"
            type="text"
            value={form.featuredImageSrc}
            onInput={(event) => updateField('featuredImageSrc', (event.target as HTMLInputElement).value)}
            disabled={saving}
            spellCheck={false}
            placeholder="../../assets/uploads/2026/09/arquivo.jpg"
            required
          />
          <p class="admin-field__hint">
            Upload de mídia chega no próximo passo. Por agora, cole o caminho relativo ao arquivo .md (o
            `image()` do Astro resolve a partir do markdown, não da raiz do projeto).
          </p>
          {errors.featuredImageSrc ? <p class="admin-field__error">{errors.featuredImageSrc}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="article-image-alt">Texto alternativo da imagem</label>
          <input
            id="article-image-alt"
            type="text"
            value={form.featuredImageAlt}
            onInput={(event) => updateField('featuredImageAlt', (event.target as HTMLInputElement).value)}
            disabled={saving}
            required
          />
          {errors.featuredImageAlt ? <p class="admin-field__error">{errors.featuredImageAlt}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="article-author">Autor</label>
          <input
            id="article-author"
            type="text"
            value={form.author}
            onInput={(event) => updateField('author', (event.target as HTMLInputElement).value)}
            disabled={saving}
            required
          />
          {errors.author ? <p class="admin-field__error">{errors.author}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="article-tags">Tags</label>
          <input
            id="article-tags"
            type="text"
            value={form.tags}
            onInput={(event) => updateField('tags', (event.target as HTMLInputElement).value)}
            disabled={saving}
            placeholder="exemplo, cms"
          />
          <p class="admin-field__hint">Separe por vírgula. Vira array de strings no YAML.</p>
        </div>

        <div class="admin-field">
          <label htmlFor="article-date">Data de publicação</label>
          <input
            id="article-date"
            type="date"
            value={form.publishedDate}
            onInput={(event) => updateField('publishedDate', (event.target as HTMLInputElement).value)}
            disabled={saving}
            required
          />
          {errors.publishedDate ? <p class="admin-field__error">{errors.publishedDate}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="article-body">Corpo do artigo (Markdown)</label>
          <textarea
            id="article-body"
            class="admin-textarea admin-textarea--body"
            rows={16}
            value={form.body}
            onInput={(event) => updateField('body', (event.target as HTMLTextAreaElement).value)}
            disabled={saving}
            spellCheck={true}
          />
        </div>

        <div class="admin-editor__actions">
          <button type="submit" class="admin-button" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar artigo'}
          </button>
          <button type="button" class="admin-button admin-button--ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
