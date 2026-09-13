import { useEffect, useState } from 'preact/hooks';
import {
  deleteMedia,
  getStoredUploadSecret,
  listMedia,
  uploadMedia,
  type MediaItem,
} from '../lib/media-client';

interface Props {
  selectMode?: boolean;
  onSelect?: (item: MediaItem) => void;
}

function filenameFromKey(key: string): string {
  const parts = key.split('/').filter(Boolean);
  return parts.at(-1) ?? key;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function MediaLibrary({ selectMode = false, onSelect }: Props) {
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
    const secret = getStoredUploadSecret();

    if (!secret) {
      setLoading(false);
      setErrorMessage('Upload Secret não encontrado. Recarregue e informe o código de novo.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const result = await listMedia(secret);

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
  }, []);

  async function handleUpload(event: Event) {
    event.preventDefault();

    const secret = getStoredUploadSecret();

    if (!secret || !file || !alt.trim()) {
      return;
    }

    setUploading(true);
    setActionMessage('');
    setErrorMessage('');

    const result = await uploadMedia(secret, file, file.name, alt.trim());

    if (!result.ok) {
      setUploading(false);
      setErrorMessage(result.error);
      return;
    }

    setFile(null);
    setAlt('');
    setUploading(false);
    setActionMessage('Imagem enviada.');
    await refreshList();
  }

  async function confirmDelete(item: MediaItem) {
    const secret = getStoredUploadSecret();

    if (!secret) {
      setErrorMessage('Upload Secret não encontrado. Recarregue e informe o código de novo.');
      return;
    }

    setDeletingKey(item.key);
    setActionMessage('');

    const result = await deleteMedia(secret, item.key);

    setDeletingKey(null);
    setPendingDelete(null);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    setItems((current) => current.filter((entry) => entry.key !== item.key));
    setActionMessage(`${filenameFromKey(item.key)} foi excluído.`);
  }

  async function handleCopy(item: MediaItem) {
    const ok = await copyText(item.url);
    setCopiedKey(ok ? item.key : null);
    setActionMessage(ok ? 'URL copiada.' : 'Não foi possível copiar a URL.');
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
          <p class="admin-field__hint">Obrigatório para habilitar o envio.</p>
        </div>
        <button type="submit" class="admin-button" disabled={!canUpload}>
          {uploading ? 'Enviando…' : 'Enviar'}
        </button>
        {uploading ? (
          <p class="admin-media-upload__status" aria-live="polite">
            <span class="admin-spinner" aria-hidden="true" />
            Enviando arquivo…
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
              <img src={item.url} alt={item.alt || filenameFromKey(item.key)} />
              <p class="admin-media-card__name">{filenameFromKey(item.key)}</p>
              <label class="admin-media-card__alt">
                <span>Texto alternativo</span>
                <input type="text" value={item.alt} readOnly />
              </label>
              <div class="admin-list__actions">
                {selectMode ? (
                  <button
                    type="button"
                    class="admin-button"
                    onClick={() => onSelect?.(item)}
                  >
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
                      {copiedKey === item.key ? 'Copiado' : 'Copiar URL'}
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
