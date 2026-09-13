/**
 * Biblioteca de mídia no próprio repositório (src/assets/uploads/),
 * gravada com o mesmo PAT do GitHub usado para artigos e páginas.
 */
import {
  createOrUpdateFile,
  deleteFile,
  getFileContent,
  getPublicRepoConfig,
  listDirectory,
  type GitHubDirEntry,
} from './github-client';
import { compressImage } from './image-compress';

export type MediaErrorCode = 'UNAUTHORIZED' | 'ERROR';

export interface MediaItem {
  key: string;
  path: string;
  url: string;
  sha: string;
  name: string;
  alt: string;
}

export interface MediaFailure {
  ok: false;
  code: MediaErrorCode;
  error: string;
}

export type MediaListResult = { ok: true; items: MediaItem[] } | MediaFailure;
export type MediaUploadResult = { ok: true; item: MediaItem } | MediaFailure;
export type MediaDeleteResult = { ok: true } | MediaFailure;

const UPLOADS_ROOT = 'src/assets/uploads';
const FRONTMATTER_PREFIX = '../../assets/uploads';
const IMAGE_EXT = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

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

export function isRepoImagePath(value: string): boolean {
  return /^(?:\.\.\/)+assets\/uploads\//.test(value.trim());
}

export function toFrontmatterPath(repoPath: string): string {
  const relative = repoPath.replace(/^src\/assets\/uploads\//, '');
  return `${FRONTMATTER_PREFIX}/${relative}`;
}

export function toRepoPath(frontmatterPath: string): string {
  const trimmed = frontmatterPath.trim();

  if (trimmed.startsWith(UPLOADS_ROOT)) {
    return trimmed;
  }

  const match = trimmed.match(/assets\/uploads\/(.+)$/);
  return match ? `${UPLOADS_ROOT}/${match[1]}` : trimmed;
}

export function toRawMediaUrl(path: string): string {
  const config = getPublicRepoConfig();
  const repoPath = toRepoPath(path);

  if (!config || !repoPath) {
    return '';
  }

  return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${repoPath}`;
}

export function toPreviewUrl(path: string): string {
  const trimmed = path.trim();

  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }

  return toRawMediaUrl(trimmed);
}

function missingConfig(): MediaFailure {
  return {
    ok: false,
    code: 'ERROR',
    error: 'PUBLIC_GITHUB_OWNER e PUBLIC_GITHUB_REPO não estão configurados.',
  };
}

function extensionForBlob(filename: string, blob: Blob): string {
  const sanitized = sanitizeFilename(filename);
  const base = sanitized.replace(/\.[^.]+$/, '') || 'arquivo';

  if (blob.type === 'image/svg+xml' || /\.svg$/i.test(filename)) {
    return sanitized.endsWith('.svg') ? sanitized : `${base}.svg`;
  }

  if (blob.type === 'image/webp') {
    return `${base}.webp`;
  }

  if (blob.type === 'image/jpeg') {
    return `${base}.jpg`;
  }

  return sanitized;
}

function yearMonthFolder(now = new Date()): { year: string; month: string } {
  return {
    year: String(now.getUTCFullYear()),
    month: String(now.getUTCMonth() + 1).padStart(2, '0'),
  };
}

function toMediaItem(entry: GitHubDirEntry, alt = ''): MediaItem {
  return {
    key: entry.path,
    path: toFrontmatterPath(entry.path),
    url: toRawMediaUrl(entry.path),
    sha: entry.sha,
    name: entry.name,
    alt,
  };
}

async function collectImages(token: string, dir: string): Promise<MediaListResult> {
  const listed = await listDirectory(token, dir);

  if (!listed.ok) {
    return listed;
  }

  const items: MediaItem[] = [];

  for (const entry of listed.entries) {
    if (entry.type === 'dir') {
      const nested = await collectImages(token, entry.path);

      if (!nested.ok) {
        return nested;
      }

      items.push(...nested.items);
      continue;
    }

    if (IMAGE_EXT.test(entry.name)) {
      items.push(toMediaItem(entry));
    }
  }

  return { ok: true, items };
}

export async function listMedia(token: string): Promise<MediaListResult> {
  if (!getPublicRepoConfig()) {
    return missingConfig();
  }

  return collectImages(token, UPLOADS_ROOT);
}

export async function uploadMedia(token: string, file: File, filename: string, alt = ''): Promise<MediaUploadResult> {
  if (!getPublicRepoConfig()) {
    return missingConfig();
  }

  try {
    const compressed = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
      ? { blob: file, width: 0, height: 0 }
      : await compressImage(file);

    const { year, month } = yearMonthFolder();
    const safeName = extensionForBlob(filename || file.name, compressed.blob);
    const repoPath = `${UPLOADS_ROOT}/${year}/${month}/${safeName}`;
    const bytes = new Uint8Array(await compressed.blob.arrayBuffer());
    const existing = await getFileContent(token, repoPath);
    const sha = existing.ok ? existing.sha : undefined;
    const result = await createOrUpdateFile(
      token,
      repoPath,
      bytes,
      `cms: enviar mídia ${safeName}`,
      sha,
    );

    if (!result.ok) {
      return result;
    }

    const item: MediaItem = {
      key: repoPath,
      path: toFrontmatterPath(repoPath),
      url: toRawMediaUrl(repoPath),
      sha: sha ?? '',
      name: safeName,
      alt: alt.trim(),
    };

    return { ok: true, item };
  } catch (error) {
    return {
      ok: false,
      code: 'ERROR',
      error: error instanceof Error ? error.message : 'Não foi possível enviar a imagem.',
    };
  }
}

export async function deleteMedia(token: string, path: string, sha: string): Promise<MediaDeleteResult> {
  const repoPath = toRepoPath(path);
  const name = repoPath.split('/').filter(Boolean).at(-1) ?? repoPath;
  return deleteFile(token, repoPath, sha, `cms: excluir mídia ${name}`);
}
