import { useEffect, useState } from 'preact/hooks';
import { parseFrontmatter } from '../lib/frontmatter';
import { deleteFile, getFileContent, listDirectory, type GitHubDirEntry } from '../lib/github-client';

interface Props {
  token: string;
  repoName: string;
  onLogout: () => void;
  onNewArticle: () => void;
  onEditArticle: (path: string) => void;
  flashMessage?: string;
}

interface ContentItem {
  name: string;
  path: string;
  sha: string;
  title: string;
}

interface SectionState {
  loading: boolean;
  items: ContentItem[];
  error: string;
}

const emptySection: SectionState = { loading: true, items: [], error: '' };

function fileTitle(name: string): string {
  return name.replace(/\.md$/i, '').replace(/-/g, ' ');
}

function isMarkdownFile(entry: GitHubDirEntry): boolean {
  return entry.type === 'file' && entry.name.toLowerCase().endsWith('.md');
}

function titleFromFrontmatter(raw: string, fallback: string): string {
  try {
    const { data } = parseFrontmatter(raw);
    return typeof data.title === 'string' && data.title.trim() ? data.title.trim() : fallback;
  } catch {
    return fallback;
  }
}

async function hydrateTitles(
  token: string,
  entries: GitHubDirEntry[],
): Promise<{ items: ContentItem[]; rateLimit?: string }> {
  const files = entries.filter(isMarkdownFile);

  const results = await Promise.allSettled(
    files.map(async (entry) => {
      const file = await getFileContent(token, entry.path);

      if (!file.ok) {
        const error = new Error(file.error) as Error & { code?: string };
        error.code = file.code;
        throw error;
      }

      return {
        name: entry.name,
        path: entry.path,
        sha: file.sha,
        title: titleFromFrontmatter(file.content, fileTitle(entry.name)),
      };
    }),
  );

  let rateLimit: string | undefined;
  const items = results.map((result, index) => {
    const entry = files[index];

    if (result.status === 'fulfilled') {
      return result.value;
    }

    const reason = result.reason as { code?: string; message?: string } | undefined;

    if (reason?.code === 'RATE_LIMIT' && reason.message) {
      rateLimit = reason.message;
    }

    return {
      name: entry.name,
      path: entry.path,
      sha: entry.sha,
      title: fileTitle(entry.name),
    };
  });

  return { items, rateLimit };
}

export default function Dashboard({
  token,
  repoName,
  onLogout,
  onNewArticle,
  onEditArticle,
  flashMessage,
}: Props) {
  const [pages, setPages] = useState<SectionState>(emptySection);
  const [articles, setArticles] = useState<SectionState>(emptySection);
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState(flashMessage ?? '');

  async function loadLists() {
    setPages((current) => ({ ...current, loading: true, error: '' }));
    setArticles((current) => ({ ...current, loading: true, error: '' }));
    setRateLimitMessage('');

    const [pagesResult, articlesResult] = await Promise.all([
      listDirectory(token, 'src/content/pages'),
      listDirectory(token, 'src/content/articles'),
    ]);

    if (!pagesResult.ok && pagesResult.code === 'RATE_LIMIT') {
      setRateLimitMessage(pagesResult.error);
    } else if (!articlesResult.ok && articlesResult.code === 'RATE_LIMIT') {
      setRateLimitMessage(articlesResult.error);
    }

    const pageEntries = pagesResult.ok ? pagesResult.entries : [];
    const articleEntries = articlesResult.ok ? articlesResult.entries : [];

    const [pageHydrated, articleHydrated] = await Promise.all([
      hydrateTitles(token, pageEntries),
      hydrateTitles(token, articleEntries),
    ]);

    if (pageHydrated.rateLimit) {
      setRateLimitMessage(pageHydrated.rateLimit);
    } else if (articleHydrated.rateLimit) {
      setRateLimitMessage(articleHydrated.rateLimit);
    }

    setPages({
      loading: false,
      items: pageHydrated.items,
      error: pagesResult.ok || pagesResult.code === 'RATE_LIMIT' ? '' : pagesResult.error,
    });

    setArticles({
      loading: false,
      items: articleHydrated.items,
      error: articlesResult.ok || articlesResult.code === 'RATE_LIMIT' ? '' : articlesResult.error,
    });
  }

  useEffect(() => {
    void loadLists();
  }, [token]);

  async function confirmDelete(item: ContentItem) {
    setDeletingPath(item.path);
    setActionMessage('');

    const result = await deleteFile(token, item.path, item.sha, `cms: excluir ${item.name}`);

    setDeletingPath(null);
    setPendingDelete(null);

    if (!result.ok) {
      if (result.code === 'RATE_LIMIT') {
        setRateLimitMessage(result.error);
      }
      setActionMessage(result.error);
      return;
    }

    setActionMessage(result.deployWarning ?? `${item.title} foi excluído.`);
    await loadLists();
  }

  return (
    <div class="admin-dashboard">
      <header class="admin-dashboard__header">
        <div>
          <p class="admin-dashboard__eyebrow">Admin</p>
          <h1>Conectado a {repoName}</h1>
        </div>
        <button type="button" class="admin-button admin-button--ghost" onClick={onLogout}>
          Sair
        </button>
      </header>

      {rateLimitMessage ? (
        <p class="admin-banner" role="alert">
          {rateLimitMessage}
        </p>
      ) : null}

      {actionMessage ? (
        <p class="admin-banner admin-banner--info" role="status">
          {actionMessage}
        </p>
      ) : null}

      <ContentSection
        title="Páginas"
        emptyLabel="Nenhuma página ainda"
        createLabel="Nova Página"
        state={pages}
        pendingDelete={pendingDelete}
        deletingPath={deletingPath}
        onAskDelete={setPendingDelete}
        onCancelDelete={() => setPendingDelete(null)}
        onConfirmDelete={confirmDelete}
      />

      <ContentSection
        title="Artigos"
        emptyLabel="Nenhum artigo ainda"
        createLabel="Novo Artigo"
        state={articles}
        pendingDelete={pendingDelete}
        deletingPath={deletingPath}
        onAskDelete={setPendingDelete}
        onCancelDelete={() => setPendingDelete(null)}
        onConfirmDelete={confirmDelete}
        onCreate={onNewArticle}
        onEdit={onEditArticle}
      />
    </div>
  );
}

interface ContentSectionProps {
  title: string;
  emptyLabel: string;
  createLabel: string;
  state: SectionState;
  pendingDelete: string | null;
  deletingPath: string | null;
  onAskDelete: (path: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (item: ContentItem) => void;
  onCreate?: () => void;
  onEdit?: (path: string) => void;
}

function ContentSection({
  title,
  emptyLabel,
  createLabel,
  state,
  pendingDelete,
  deletingPath,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onCreate,
  onEdit,
}: ContentSectionProps) {
  return (
    <section class="admin-card admin-section">
      <div class="admin-section__header">
        <h2>{title}</h2>
        <button type="button" class="admin-button" onClick={onCreate}>
          {createLabel}
        </button>
      </div>

      {state.loading ? (
        <div class="admin-skeleton" aria-busy="true" aria-label={`Carregando ${title.toLowerCase()}`}>
          <span />
          <span />
          <span />
        </div>
      ) : state.error ? (
        <p class="admin-error" role="alert">
          {state.error}
        </p>
      ) : state.items.length === 0 ? (
        <p class="admin-empty">{emptyLabel}</p>
      ) : (
        <ul class="admin-list">
          {state.items.map((item) => (
            <li key={item.path} class="admin-list__item">
              <span class="admin-list__name">{item.title}</span>
              <div class="admin-list__actions">
                {pendingDelete === item.path ? (
                  <>
                    <span class="admin-list__confirm">Excluir este arquivo?</span>
                    <button
                      type="button"
                      class="admin-button admin-button--danger"
                      disabled={deletingPath === item.path}
                      onClick={() => onConfirmDelete(item)}
                    >
                      {deletingPath === item.path ? 'Excluindo…' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      class="admin-button admin-button--ghost"
                      disabled={deletingPath === item.path}
                      onClick={onCancelDelete}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      class="admin-button admin-button--ghost"
                      onClick={onEdit ? () => onEdit(item.path) : undefined}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      class="admin-button admin-button--ghost"
                      onClick={() => onAskDelete(item.path)}
                    >
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
