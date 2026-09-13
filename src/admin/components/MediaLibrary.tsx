import { useEffect, useState } from 'preact/hooks';
import { deleteMedia, listMedia, uploadMedia, type MediaItem } from '../lib/media-client';

interface Props {
  token: string;
  selectMode?: boolean;
  onSelect?: (item: MediaItem) => void;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function MediaLibrary({ token, selectMode = false, onSelect }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  async function refreshList() {
    setLoading(true);
    setErrorMessage('');

    const result = await listMedia(token);

    if (!result.ok) {
      setLoading(false);
      setErrorMessage(result.error);
      return;
    }

    setItems(result.items);
    setLoading(false);
  }

  useEffect(() => {
    void refreshList();
  }, [token]);

  async function handleUpload(event: Event) {
    event.preventDefault();

    if (!file || !alt.trim()) {
      return;
    }

    setUploading(true);
    setActionMessage('');
    setErrorMessage('');

    const result = await uploadMedia(token, file, file.name, alt.trim());

    if (!result.ok) {
      setUploading(false);
      setErrorMessage(result.error);
      return;
    }

    setFile(null);
    setAlt('');
    setUploading(false);
    setActionMessage('Imagem enviada e commitada no repositório.');
    await refreshList();
  }

  async function confirmDelete(item: MediaItem) {
    if (!item.sha) {
      setErrorMessage('Não foi possível excluir: SHA do arquivo ausente. Recarregue a lista.');
      return;
    }

    setDeletingKey(item.key);
    setActionMessage('');

    const result = await deleteMedia(token, item.key, item.sha);

    setDeletingKey(null);
    setPendingDelete(null);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    setItems((current) => current.filter((entry) => entry.key !== item.key));
    setActionMessage(`${item.name} foi excluído.`);
  }

  async function handleCopy(item: MediaItem) {
    const ok = await copyText(item.path);
    setCopiedKey(ok ? item.key : null);
    setActionMessage(ok ? 'Caminho copiado.' : 'Não foi possível copiar o caminho.');
  }

  const canUpload = Boolean(file && alt.trim()) && !uploading;

  return (
    <section class="admin-card admin-section">
      <div class="admin-section__header">
        <h2>{selectMode ? 'Escolher imagem' : 'Arquivos'}</h2>
      </div>

      <form class="admin-media-upload" onSubmit={handleUpload}>
        <div class="admin-field">
          <label htmlFor="media-file">Enviar arquivo</label>
          <input
            id="media-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
            onChange={(event) => {
              const next = (event.target as HTMLInputElement).files?.[0] ?? null;
              setFile(next);
            }}
            disabled={uploading}
          />
        </div>
        <div class="admin-field">
          <label htmlFor="media-alt">Texto alternativo</label>
          <input
            id="media-alt"
            type="text"
            value={alt}
            onInput={(event) => setAlt((event.target as HTMLInputElement).value)}
            disabled={uploading}
            required
          />
          <p class="admin-field__hint">
            Raster (JPG/PNG/WebP) é comprimido no navegador para WebP antes do commit. SVG segue
            intacto.
          </p>
        </div>
        <button type="submit" class="admin-button" disabled={!canUpload}>
          {uploading ? 'Enviando…' : 'Enviar'}
        </button>
        {uploading ? (
          <p class="admin-media-upload__status" aria-live="polite">
            <span class="admin-spinner" aria-hidden="true" />
            Comprimindo e commitando…
          </p>
        ) : null}
      </form>

      {actionMessage ? (
        <p class="admin-banner admin-banner--info" role="status">
          {actionMessage}
        </p>
      ) : null}

      {loading ? (
        <div class="admin-skeleton" aria-busy="true" aria-label="Carregando biblioteca de mídia">
          <span />
          <span />
          <span />
        </div>
      ) : errorMessage ? (
        <p class="admin-error" role="alert">
          {errorMessage}
        </p>
      ) : items.length === 0 ? (
        <p class="admin-empty">Nenhuma imagem ainda. Envie a primeira pelo formulário acima.</p>
      ) : (
        <ul class="admin-media-grid">
          {items.map((item) => (
            <li key={item.key} class="admin-media-card">
              <div class="admin-media-card__thumb">
                <img src={item.url} alt={item.alt || item.name} />
              </div>
              <p class="admin-media-card__name">{item.name}</p>
              <p class="admin-field__hint">{item.path}</p>
              <div class="admin-list__actions">
                {selectMode ? (
                  <button type="button" class="admin-button" onClick={() => onSelect?.(item)}>
                    Usar esta imagem
                  </button>
                ) : pendingDelete === item.key ? (
                  <>
                    <span class="admin-list__confirm">Excluir este arquivo?</span>
                    <button
                      type="button"
                      class="admin-button admin-button--danger"
                      disabled={deletingKey === item.key}
                      onClick={() => void confirmDelete(item)}
                    >
                      {deletingKey === item.key ? 'Excluindo…' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      class="admin-button admin-button--ghost"
                      disabled={deletingKey === item.key}
                      onClick={() => setPendingDelete(null)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      class="admin-button admin-button--ghost"
                      onClick={() => void handleCopy(item)}
                    >
                      {copiedKey === item.key ? 'Copiado' : 'Copiar caminho'}
                    </button>
                    <button
                      type="button"
                      class="admin-button admin-button--ghost"
                      onClick={() => setPendingDelete(item.key)}
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
