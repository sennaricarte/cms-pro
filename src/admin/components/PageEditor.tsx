import { useEffect, useState } from 'preact/hooks';
import { parseFrontmatter, serializeFrontmatter } from '../lib/frontmatter';
import { createOrUpdateFile, getFileContent } from '../lib/github-client';
import {
  blockTypeLabel,
  createEmptyBlock,
  parsePageBlocks,
  serializePageBlock,
  type PageBlock,
  type PageBlockType,
} from '../lib/page-blocks';
import { isRepoImagePath } from '../lib/media-client';
import { slugify } from '../lib/slugify';
import CtaBlockEditor from './blocks/CtaBlockEditor';
import GalleryBlockEditor from './blocks/GalleryBlockEditor';
import HeroBlockEditor from './blocks/HeroBlockEditor';
import TextBlockEditor from './blocks/TextBlockEditor';
import ImagePickerField from './ImagePickerField';

interface Props {
  token: string;
  mode: 'create' | 'edit';
  path?: string;
  onSaved: (deployWarning?: string) => void;
  onCancel: () => void;
}

interface FormBlock {
  uid: string;
  data: PageBlock;
}

interface FormState {
  title: string;
  slug: string;
  seoTitle: string;
  metaDescription: string;
  ogImage: string;
  publishedDate: string;
  updatedDate: string;
  blocks: FormBlock[];
}

const SEO_TITLE_WARN = 60;
const META_MAX = 160;

const BLOCK_OPTIONS: Array<{ type: PageBlockType; label: string }> = [
  { type: 'hero', label: 'Hero' },
  { type: 'text', label: 'Texto' },
  { type: 'gallery', label: 'Galeria' },
  { type: 'cta', label: 'CTA' },
];

const emptyForm = (): FormState => ({
  title: '',
  slug: '',
  seoTitle: '',
  metaDescription: '',
  ogImage: '',
  publishedDate: new Date().toISOString().slice(0, 10),
  updatedDate: '',
  blocks: [],
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

function newUid(): string {
  return crypto.randomUUID();
}

function withUid(data: PageBlock): FormBlock {
  return { uid: newUid(), data };
}

function validatePage(form: FormState): string[] {
  const errors: string[] = [];

  if (!form.title.trim()) {
    errors.push('Informe o título da página.');
  }

  if (!form.slug.trim()) {
    errors.push('Informe o slug da página.');
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
    errors.push('O slug deve usar apenas minúsculas, números e hífens.');
  }

  if (!form.seoTitle.trim()) {
    errors.push('Informe o título SEO.');
  }

  if (!form.metaDescription.trim()) {
    errors.push('Informe a meta description.');
  } else if (form.metaDescription.trim().length > META_MAX) {
    errors.push(`A meta description não pode passar de ${META_MAX} caracteres.`);
  }

  if (!form.publishedDate) {
    errors.push('Informe a data de publicação.');
  }

  form.blocks.forEach((block, index) => {
    const label = `Bloco ${index + 1} (${blockTypeLabel(block.data.type)})`;

    switch (block.data.type) {
      case 'hero':
        if (!block.data.heading.trim()) {
          errors.push(`${label}: informe o título.`);
        }

        if (!block.data.image.trim()) {
          errors.push(`${label}: escolha uma imagem.`);
        } else if (!isRepoImagePath(block.data.image.trim())) {
          errors.push(`${label}: a imagem precisa ser um arquivo em src/assets/uploads/.`);
        }

        if (block.data.cta) {
          if (!block.data.cta.label.trim()) {
            errors.push(`${label}: informe o rótulo do botão de ação.`);
          }

          if (!block.data.cta.href.trim()) {
            errors.push(`${label}: informe o link do botão de ação.`);
          }
        }
        break;

      case 'text':
        if (!block.data.body.trim()) {
          errors.push(`${label}: informe o corpo do texto.`);
        }
        break;

      case 'gallery':
        if (block.data.images.length === 0) {
          errors.push(`${label}: adicione pelo menos uma imagem.`);
          break;
        }

        block.data.images.forEach((image, imageIndex) => {
          if (!image.src.trim()) {
            errors.push(`${label}, imagem ${imageIndex + 1}: escolha uma imagem.`);
          } else if (!isRepoImagePath(image.src.trim())) {
            errors.push(`${label}, imagem ${imageIndex + 1}: a imagem precisa ser um arquivo em src/assets/uploads/.`);
          }

          if (!image.alt.trim()) {
            errors.push(`${label}, imagem ${imageIndex + 1}: informe o texto alternativo.`);
          }
        });
        break;

      case 'cta':
        if (!block.data.heading.trim()) {
          errors.push(`${label}: informe o título.`);
        }

        if (!block.data.buttonLabel.trim()) {
          errors.push(`${label}: informe o rótulo do botão.`);
        }

        if (!block.data.buttonHref.trim()) {
          errors.push(`${label}: informe o link do botão.`);
        }
        break;
    }
  });

  return errors;
}

function fieldErrorsFromMessages(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};

  form.blocks.forEach((block) => {
    switch (block.data.type) {
      case 'hero':
        if (!block.data.heading.trim()) {
          errors[`${block.uid}.heading`] = 'Informe o título.';
        }

        if (!block.data.image.trim()) {
          errors[`${block.uid}.image`] = 'Escolha uma imagem na biblioteca.';
        } else if (!isRepoImagePath(block.data.image.trim())) {
          errors[`${block.uid}.image`] = 'A imagem precisa ser um arquivo em src/assets/uploads/.';
        }

        if (block.data.cta && !block.data.cta.label.trim()) {
          errors[`${block.uid}.cta.label`] = 'Informe o rótulo do botão.';
        }

        if (block.data.cta && !block.data.cta.href.trim()) {
          errors[`${block.uid}.cta.href`] = 'Informe o link do botão.';
        }
        break;

      case 'text':
        if (!block.data.body.trim()) {
          errors[`${block.uid}.body`] = 'Informe o corpo do texto.';
        }
        break;

      case 'gallery':
        if (block.data.images.length === 0) {
          errors[`${block.uid}.images`] = 'Adicione pelo menos uma imagem.';
        }

        block.data.images.forEach((image, imageIndex) => {
          if (!image.src.trim()) {
            errors[`${block.uid}.images.${imageIndex}`] = 'Escolha uma imagem na biblioteca.';
          } else if (!isRepoImagePath(image.src.trim())) {
            errors[`${block.uid}.images.${imageIndex}`] = 'A imagem precisa ser um arquivo em src/assets/uploads/.';
          } else if (!image.alt.trim()) {
            errors[`${block.uid}.images.${imageIndex}`] = 'Informe o texto alternativo.';
          }
        });
        break;

      case 'cta':
        if (!block.data.heading.trim()) {
          errors[`${block.uid}.heading`] = 'Informe o título.';
        }

        if (!block.data.buttonLabel.trim()) {
          errors[`${block.uid}.buttonLabel`] = 'Informe o rótulo do botão.';
        }

        if (!block.data.buttonHref.trim()) {
          errors[`${block.uid}.buttonHref`] = 'Informe o link do botão.';
        }
        break;
    }
  });

  return errors;
}

function errorsForBlock(all: Record<string, string>, uid: string): Record<string, string> {
  const prefix = `${uid}.`;
  const scoped: Record<string, string> = {};

  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(prefix)) {
      scoped[key.slice(prefix.length)] = value;
    }
  }

  return scoped;
}

function toFrontmatterData(form: FormState): Record<string, unknown> {
  const data: Record<string, unknown> = {
    title: form.title.trim(),
    slug: form.slug.trim(),
    seoTitle: form.seoTitle.trim(),
    metaDescription: form.metaDescription.trim(),
    publishedDate: form.publishedDate,
    blocks: form.blocks.map((block) => serializePageBlock(block.data)),
  };

  if (form.ogImage.trim()) {
    data.ogImage = form.ogImage.trim();
  }

  if (form.updatedDate.trim()) {
    data.updatedDate = form.updatedDate.trim();
  }

  return data;
}

export default function PageEditor({ token, mode, path, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugManual, setSlugManual] = useState(mode === 'edit');
  const [sha, setSha] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [pageErrors, setPageErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [blockFieldErrors, setBlockFieldErrors] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  useEffect(() => {
    if (mode !== 'edit' || !path) {
      return;
    }

    let cancelled = false;

    async function loadPage() {
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
        const { data } = parseFrontmatter(result.content);

        setSha(result.sha);
        setForm({
          title: asString(data.title),
          slug: asString(data.slug) || path.replace(/^.*\//, '').replace(/\.md$/i, ''),
          seoTitle: asString(data.seoTitle),
          metaDescription: asString(data.metaDescription),
          ogImage: asString(data.ogImage),
          publishedDate: toDateInput(data.publishedDate),
          updatedDate: toDateInput(data.updatedDate),
          blocks: parsePageBlocks(data.blocks).map(withUid),
        });
      } catch {
        setFormError('Não foi possível ler o frontmatter desta página. O arquivo pode estar malformado.');
      }

      setLoading(false);
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [mode, path, token]);

  function updateField<K extends keyof Omit<FormState, 'blocks'>>(field: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'title' && mode === 'create' && !slugManual) {
        next.slug = slugify(String(value));
      }

      return next;
    });
  }

  function updateBlock(uid: string, data: PageBlock) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.uid === uid ? { ...block, data } : block)),
    }));
  }

  function moveBlock(uid: string, direction: -1 | 1) {
    setForm((current) => {
      const index = current.blocks.findIndex((block) => block.uid === uid);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.blocks.length) {
        return current;
      }

      const blocks = [...current.blocks];
      const [item] = blocks.splice(index, 1);
      blocks.splice(nextIndex, 0, item);
      return { ...current, blocks };
    });
  }

  function removeBlock(uid: string) {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.uid !== uid),
    }));
  }

  function addBlock(type: PageBlockType) {
    setForm((current) => ({
      ...current,
      blocks: [...current.blocks, withUid(createEmptyBlock(type))],
    }));
    setAddMenuOpen(false);
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    setFormError('');
    setRateLimitMessage('');

    const messages = validatePage(form);
    const nextPageErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.title.trim()) {
      nextPageErrors.title = 'Informe o título.';
    }

    if (!form.slug.trim()) {
      nextPageErrors.slug = 'Informe o slug.';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
      nextPageErrors.slug = 'Use apenas minúsculas, números e hífens.';
    }

    if (!form.seoTitle.trim()) {
      nextPageErrors.seoTitle = 'Informe o título SEO.';
    }

    if (!form.metaDescription.trim()) {
      nextPageErrors.metaDescription = 'Informe a meta description.';
    } else if (form.metaDescription.trim().length > META_MAX) {
      nextPageErrors.metaDescription = `A meta description não pode passar de ${META_MAX} caracteres.`;
    }

    if (!form.publishedDate) {
      nextPageErrors.publishedDate = 'Informe a data de publicação.';
    }

    setPageErrors(nextPageErrors);
    setBlockFieldErrors(fieldErrorsFromMessages(form));
    setFormErrors(messages);

    if (messages.length > 0) {
      return;
    }

    setSaving(true);

    const filePath = `src/content/pages/${form.slug.trim()}.md`;
    const content = serializeFrontmatter(toFrontmatterData(form), '');
    const message =
      mode === 'create' ? `cms: criar página ${form.slug.trim()}` : `cms: atualizar página ${form.slug.trim()}`;
    const writeSha = mode === 'edit' && path === filePath ? sha : undefined;

    const result = await createOrUpdateFile(token, filePath, content, message, writeSha);

    setSaving(false);

    if (!result.ok) {
      if (result.code === 'RATE_LIMIT') {
        setRateLimitMessage(result.error);
      }

      if (result.code === 'CONFLICT') {
        setFormError(
          'Esta página foi alterada por outro processo desde que você abriu — recarregue antes de salvar',
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
          Caminho da página não informado.
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
        <div class="admin-skeleton" aria-label="Carregando página">
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
          <p class="admin-dashboard__eyebrow">Páginas</p>
          <h1>{mode === 'create' ? 'Nova página' : 'Editar página'}</h1>
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

      {formErrors.length > 0 ? (
        <div class="admin-card" role="alert">
          <p class="admin-error">Corrija os itens abaixo antes de salvar:</p>
          <ul class="admin-error-list">
            {formErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form class="admin-card admin-form" onSubmit={handleSubmit} noValidate>
        <div class="admin-field">
          <label htmlFor="page-title">Título</label>
          <input
            id="page-title"
            type="text"
            value={form.title}
            onInput={(event) => updateField('title', (event.target as HTMLInputElement).value)}
            disabled={saving}
            required
          />
          {pageErrors.title ? <p class="admin-field__error">{pageErrors.title}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="page-slug">Slug</label>
          <input
            id="page-slug"
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
            Arquivo: <code>src/content/pages/{form.slug || 'slug'}.md</code>
          </p>
          {form.slug.trim() === 'home' ? (
            <p class="admin-banner admin-banner--info">Esta será a página inicial do site.</p>
          ) : null}
          {pageErrors.slug ? <p class="admin-field__error">{pageErrors.slug}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="page-seo-title">Título SEO</label>
          <input
            id="page-seo-title"
            type="text"
            value={form.seoTitle}
            onInput={(event) => updateField('seoTitle', (event.target as HTMLInputElement).value)}
            disabled={saving}
            required
          />
          <p class={`admin-field__count${form.seoTitle.length > SEO_TITLE_WARN ? ' admin-field__count--warn' : ''}`}>
            {form.seoTitle.length} caracteres
            {form.seoTitle.length > SEO_TITLE_WARN ? ' — acima de ~60, o Google tende a cortar' : ''}
          </p>
          {pageErrors.seoTitle ? <p class="admin-field__error">{pageErrors.seoTitle}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="page-meta">Meta description</label>
          <textarea
            id="page-meta"
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
          {pageErrors.metaDescription ? <p class="admin-field__error">{pageErrors.metaDescription}</p> : null}
        </div>

        <ImagePickerField
          label="Imagem OG"
          value={form.ogImage}
          altValue=""
          showAlt={false}
          disabled={saving}
          token={token}
          onChange={({ path }) => updateField('ogImage', path)}
        />

        <div class="admin-field">
          <label htmlFor="page-date">Data de publicação</label>
          <input
            id="page-date"
            type="date"
            value={form.publishedDate}
            onInput={(event) => updateField('publishedDate', (event.target as HTMLInputElement).value)}
            disabled={saving}
            required
          />
          {pageErrors.publishedDate ? <p class="admin-field__error">{pageErrors.publishedDate}</p> : null}
        </div>

        <div class="admin-field">
          <label htmlFor="page-updated">Data de atualização (opcional)</label>
          <input
            id="page-updated"
            type="date"
            value={form.updatedDate}
            onInput={(event) => updateField('updatedDate', (event.target as HTMLInputElement).value)}
            disabled={saving}
          />
        </div>

        <section class="admin-blocks">
          <div class="admin-section__header">
            <h2>Blocos de conteúdo</h2>
          </div>

          {form.blocks.length === 0 ? (
            <p class="admin-empty">Nenhum bloco ainda. Adicione Hero, Texto, Galeria ou CTA.</p>
          ) : (
            <div class="admin-block-list">
              {form.blocks.map((block, index) => {
                const shared = {
                  token,
                  onRemove: () => removeBlock(block.uid),
                  onMoveUp: () => moveBlock(block.uid, -1),
                  onMoveDown: () => moveBlock(block.uid, 1),
                  isFirst: index === 0,
                  isLast: index === form.blocks.length - 1,
                  disabled: saving,
                  errors: errorsForBlock(blockFieldErrors, block.uid),
                  idPrefix: block.uid,
                };

                switch (block.data.type) {
                  case 'hero':
                    return (
                      <HeroBlockEditor
                        key={block.uid}
                        data={block.data}
                        onChange={(data) => updateBlock(block.uid, data)}
                        {...shared}
                      />
                    );
                  case 'text':
                    return (
                      <TextBlockEditor
                        key={block.uid}
                        data={block.data}
                        onChange={(data) => updateBlock(block.uid, data)}
                        {...shared}
                      />
                    );
                  case 'gallery':
                    return (
                      <GalleryBlockEditor
                        key={block.uid}
                        data={block.data}
                        onChange={(data) => updateBlock(block.uid, data)}
                        {...shared}
                      />
                    );
                  case 'cta':
                    return (
                      <CtaBlockEditor
                        key={block.uid}
                        data={block.data}
                        onChange={(data) => updateBlock(block.uid, data)}
                        {...shared}
                      />
                    );
                }
              })}
            </div>
          )}

          <div class="admin-block-add">
            <button
              type="button"
              class="admin-button"
              disabled={saving}
              aria-expanded={addMenuOpen}
              onClick={() => setAddMenuOpen((open) => !open)}
            >
              Adicionar bloco
            </button>
            {addMenuOpen ? (
              <ul class="admin-block-menu">
                {BLOCK_OPTIONS.map((option) => (
                  <li key={option.type}>
                    <button
                      type="button"
                      class="admin-button admin-button--ghost"
                      disabled={saving}
                      onClick={() => addBlock(option.type)}
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        <div class="admin-editor__actions">
          <button type="submit" class="admin-button" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar página'}
          </button>
          <button type="button" class="admin-button admin-button--ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
