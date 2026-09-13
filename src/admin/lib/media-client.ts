/**
 * Cliente do Worker de upload (R2), usado só no browser (admin).
 *
 * O Upload Secret nunca entra em env de build. Ele é colado pelo usuário e
 * fica no localStorage deste navegador — é diferente do PAT do GitHub.
 */

export type MediaErrorCode = 'UNAUTHORIZED' | 'ERROR';

export interface MediaItem {
  key: string;
  url: string;
  size: number;
  uploaded: string;
  alt: string;
}

export interface MediaFailure {
  ok: false;
  code: MediaErrorCode;
  error: string;
}

export type MediaListResult = { ok: true; items: MediaItem[] } | MediaFailure;
export type MediaUploadResult = { ok: true; item: Pick<MediaItem, 'key' | 'url'> } | MediaFailure;
export type MediaDeleteResult = { ok: true } | MediaFailure;

const MAX_LIST_PAGES = 50;

function getUploadConfig(): { endpoint: string; clientPrefix: string } | null {
  const endpoint = import.meta.env.PUBLIC_UPLOAD_ENDPOINT?.replace(/\/+$/, '');
  const clientPrefix = import.meta.env.PUBLIC_CLIENT_PREFIX?.trim();

  if (!endpoint || !clientPrefix) {
    return null;
  }

  return { endpoint, clientPrefix };
}

export function getUploadSecretStorageKey(): string {
  const prefix = import.meta.env.PUBLIC_CLIENT_PREFIX?.trim() || 'unconfigured';
  return `cms_admin_upload_secret_${prefix}`;
}

export function getStoredUploadSecret(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem(getUploadSecretStorageKey());
}

export function storeUploadSecret(secret: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(getUploadSecretStorageKey(), secret.trim());
}

export function clearUploadSecret(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(getUploadSecretStorageKey());
}

export function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim();
  const lastDot = trimmed.lastIndexOf('.');
  const rawName = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const rawExt = lastDot > 0 ? trimmed.slice(lastDot) : '';

  const name = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase();

  const ext = rawExt.toLowerCase().replace(/[^a-z0-9.]/g, '');

  return `${name || 'arquivo'}${ext}`;
}

function missingConfig(): MediaFailure {
  return {
    ok: false,
    code: 'ERROR',
    error: 'PUBLIC_UPLOAD_ENDPOINT e PUBLIC_CLIENT_PREFIX não estão configurados.',
  };
}

function unauthorized(): MediaFailure {
  return {
    ok: false,
    code: 'UNAUTHORIZED',
    error: 'Upload Secret inválido ou este cliente ainda não foi provisionado.',
  };
}

function failureFromResponse(status: number, bodyMessage?: string): MediaFailure {
  if (status === 401) {
    return unauthorized();
  }

  return {
    ok: false,
    code: 'ERROR',
    error: bodyMessage || `Não foi possível completar a operação (HTTP ${status}).`,
  };
}

function authHeaders(secret: string, extra?: HeadersInit): HeadersInit {
  return {
    'X-Upload-Secret': secret.trim(),
    ...extra,
  };
}

function asMediaItem(value: unknown): MediaItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (typeof item.key !== 'string' || typeof item.url !== 'string') {
    return null;
  }

  return {
    key: item.key,
    url: item.url,
    size: typeof item.size === 'number' ? item.size : 0,
    uploaded: typeof item.uploaded === 'string' ? item.uploaded : '',
    alt: typeof item.alt === 'string' ? item.alt : '',
  };
}

export async function listMedia(secret: string): Promise<MediaListResult> {
  const config = getUploadConfig();

  if (!config) {
    return missingConfig();
  }

  const items: MediaItem[] = [];
  let cursor: string | undefined;

  try {
    for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
      const url = new URL(`${config.endpoint}/list`);
      url.searchParams.set('clientPrefix', config.clientPrefix);

      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }

      const response = await fetch(url, {
        headers: authHeaders(secret),
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> | unknown[];

      if (!response.ok) {
        return failureFromResponse(
          response.status,
          !Array.isArray(payload) && typeof payload.error === 'string' ? payload.error : undefined,
        );
      }

      const rawItems = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.objects)
          ? payload.objects
          : Array.isArray(payload.items)
            ? payload.items
            : [];

      for (const raw of rawItems) {
        const item = asMediaItem(raw);

        if (item) {
          items.push(item);
        }
      }

      const nextCursor =
        !Array.isArray(payload) && typeof payload.cursor === 'string' && payload.cursor
          ? payload.cursor
          : undefined;
      const truncated = !Array.isArray(payload) && payload.truncated === true;

      if (!truncated || !nextCursor) {
        break;
      }

      cursor = nextCursor;
    }

    return { ok: true, items };
  } catch {
    return {
      ok: false,
      code: 'ERROR',
      error: 'Falha de rede ao listar a mídia. Verifique a conexão e tente de novo.',
    };
  }
}

export async function uploadMedia(
  secret: string,
  file: File,
  filename: string,
  alt: string,
): Promise<MediaUploadResult> {
  const config = getUploadConfig();

  if (!config) {
    return missingConfig();
  }

  const form = new FormData();
  form.set('file', file);
  form.set('clientPrefix', config.clientPrefix);
  form.set('filename', sanitizeFilename(filename));
  form.set('alt', alt.trim());

  try {
    const response = await fetch(`${config.endpoint}/upload`, {
      method: 'POST',
      headers: authHeaders(secret),
      body: form,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return failureFromResponse(response.status, typeof payload.error === 'string' ? payload.error : undefined);
    }

    if (typeof payload.key !== 'string' || typeof payload.url !== 'string') {
      return { ok: false, code: 'ERROR', error: 'O Worker não devolveu a URL do arquivo enviado.' };
    }

    return { ok: true, item: { key: payload.key, url: payload.url } };
  } catch {
    return {
      ok: false,
      code: 'ERROR',
      error: 'Falha de rede ao enviar o arquivo. Verifique a conexão e tente de novo.',
    };
  }
}

export async function deleteMedia(secret: string, key: string): Promise<MediaDeleteResult> {
  const config = getUploadConfig();

  if (!config) {
    return missingConfig();
  }

  try {
    const response = await fetch(`${config.endpoint}/upload`, {
      method: 'DELETE',
      headers: authHeaders(secret, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        clientPrefix: config.clientPrefix,
        key,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return failureFromResponse(response.status, typeof payload.error === 'string' ? payload.error : undefined);
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      code: 'ERROR',
      error: 'Falha de rede ao excluir o arquivo. Verifique a conexão e tente de novo.',
    };
  }
}
