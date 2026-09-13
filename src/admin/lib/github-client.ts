/**
 * Cliente GitHub usado só no browser (admin).
 *
 * O PAT nunca entra em env de build. Ele é colado pelo usuário e fica no
 * localStorage deste navegador — use um token fine-grained, só neste repo,
 * com Contents: Read and write, e data de expiração definida no GitHub.
 */

export type GitHubErrorCode = 'CONFLICT' | 'RATE_LIMIT' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'ERROR';

export interface TokenValidation {
  valid: boolean;
  repoName?: string;
  canPush?: boolean;
  error?: string;
  code?: GitHubErrorCode;
}

export interface GitHubDirEntry {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
}

export interface GitHubFileContent {
  content: string;
  sha: string;
}

export interface ApiFailure {
  ok: false;
  code: GitHubErrorCode;
  error: string;
}

export type ListDirectoryResult = { ok: true; entries: GitHubDirEntry[] } | ApiFailure;
export type GetFileResult = { ok: true; content: string; sha: string } | ApiFailure;
export type WriteFileResult = { ok: true; deployWarning?: string } | ApiFailure;
export type DeployResult = { ok: true } | { ok: false; error: string };

interface GitHubRepoResponse {
  full_name?: string;
  name?: string;
  permissions?: {
    push?: boolean;
  };
  message?: string;
}

interface GitHubContentItem {
  name?: string;
  path?: string;
  sha?: string;
  type?: string;
  content?: string;
  encoding?: string;
  message?: string;
}

function getPublicRepoConfig(): { owner: string; repo: string; branch: string } | null {
  const owner = import.meta.env.PUBLIC_GITHUB_OWNER;
  const repo = import.meta.env.PUBLIC_GITHUB_REPO;

  if (!owner || !repo) {
    return null;
  }

  return {
    owner,
    repo,
    branch: import.meta.env.PUBLIC_GITHUB_BRANCH || 'main',
  };
}

export function getTokenStorageKey(): string {
  const config = getPublicRepoConfig();

  if (!config) {
    return 'cms_admin_pat_unconfigured';
  }

  return `cms_admin_pat_${config.owner}_${config.repo}`;
}

export function getStoredToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem(getTokenStorageKey());
}

export function storeToken(token: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(getTokenStorageKey(), token);
}

export function clearToken(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(getTokenStorageKey());
}

function encodeRepoPath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function authHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token.trim()}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function isRateLimited(response: Response, bodyMessage?: string): boolean {
  return (
    response.status === 403 &&
    (response.headers.get('x-ratelimit-remaining') === '0' ||
      (bodyMessage ?? '').toLowerCase().includes('rate limit'))
  );
}

function messageForHttpStatus(status: number, bodyMessage?: string): string {
  if (status === 401) {
    return 'Token inválido ou expirado. Gere um novo PAT no GitHub.';
  }

  if (status === 404) {
    return 'Repositório não encontrado ou o token não tem acesso a ele.';
  }

  if (status === 409) {
    return 'Conflito ao salvar: o arquivo mudou no GitHub. Recarregue e tente de novo.';
  }

  if (status === 403) {
    const rateLimited = bodyMessage?.toLowerCase().includes('rate limit');
    return rateLimited
      ? 'A API do GitHub atingiu o limite de requisições. Aguarde alguns minutos e tente de novo.'
      : 'Acesso negado. Confira as permissões do token neste repositório.';
  }

  return bodyMessage || `Não foi possível completar a operação (HTTP ${status}).`;
}

function failureFromResponse(response: Response, bodyMessage?: string): ApiFailure {
  if (isRateLimited(response, bodyMessage)) {
    return {
      ok: false,
      code: 'RATE_LIMIT',
      error: 'A API do GitHub atingiu o limite de requisições. Aguarde alguns minutos e tente de novo.',
    };
  }

  if (response.status === 409) {
    return {
      ok: false,
      code: 'CONFLICT',
      error: messageForHttpStatus(409, bodyMessage),
    };
  }

  if (response.status === 401) {
    return { ok: false, code: 'UNAUTHORIZED', error: messageForHttpStatus(401, bodyMessage) };
  }

  if (response.status === 404) {
    return { ok: false, code: 'NOT_FOUND', error: messageForHttpStatus(404, bodyMessage) };
  }

  return { ok: false, code: 'ERROR', error: messageForHttpStatus(response.status, bodyMessage) };
}

function missingConfig(): ApiFailure {
  return {
    ok: false,
    code: 'ERROR',
    error: 'PUBLIC_GITHUB_OWNER e PUBLIC_GITHUB_REPO não estão configurados.',
  };
}

/**
 * GitHub Contents API devolve `content` em Base64 de bytes UTF-8.
 * atob() devolve uma binary string Latin-1 (um byte por char); o
 * TextDecoder remonta o UTF-8 original.
 */
export function decodeBase64Utf8(encoded: string): string {
  const binary = atob(encoded.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0) & 0xff);
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * GitHub Contents API exige `content` em Base64 dos bytes UTF-8 do arquivo.
 * btoa() só aceita Latin-1 (código 0–255). Passar a string JS direto
 * ("Comunicação") corrompe ou lança. Codificamos com TextEncoder e só
 * então fazemos btoa da binary string (um char por byte).
 */
export function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const chunkSize = 0x2000;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function validateToken(token: string): Promise<TokenValidation> {
  const trimmed = token.trim();

  if (!trimmed) {
    return { valid: false, error: 'Cole um Personal Access Token para continuar.' };
  }

  const config = getPublicRepoConfig();

  if (!config) {
    return {
      valid: false,
      error: 'PUBLIC_GITHUB_OWNER e PUBLIC_GITHUB_REPO não estão configurados.',
    };
  }

  const { owner, repo } = config;

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: authHeaders(trimmed),
    });

    const payload = (await response.json().catch(() => ({}))) as GitHubRepoResponse;

    if (isRateLimited(response, payload.message)) {
      return {
        valid: false,
        code: 'RATE_LIMIT',
        error: 'A API do GitHub atingiu o limite de requisições. Aguarde alguns minutos e tente de novo.',
      };
    }

    if (!response.ok) {
      return {
        valid: false,
        error: messageForHttpStatus(response.status, payload.message),
      };
    }

    const repoName = payload.full_name ?? payload.name ?? `${owner}/${repo}`;
    const canPush = payload.permissions?.push === true;

    return {
      valid: true,
      repoName,
      canPush,
    };
  } catch {
    return {
      valid: false,
      error: 'Falha de rede ao falar com a API do GitHub. Verifique a conexão e tente de novo.',
    };
  }
}

export async function listDirectory(token: string, path: string): Promise<ListDirectoryResult> {
  const config = getPublicRepoConfig();

  if (!config) {
    return missingConfig();
  }

  const { owner, repo, branch } = config;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(branch)}`;

  try {
    const response = await fetch(url, { headers: authHeaders(token) });

    if (response.status === 404) {
      return { ok: true, entries: [] };
    }

    const payload = (await response.json().catch(() => null)) as
      | GitHubContentItem
      | GitHubContentItem[]
      | { message?: string };

    if (!response.ok) {
      return failureFromResponse(response, (payload as { message?: string })?.message);
    }

    const items = Array.isArray(payload) ? payload : [payload];
    const entries = items
      .filter((item): item is GitHubContentItem => Boolean(item && (item.type === 'file' || item.type === 'dir')))
      .map((item) => ({
        name: item.name ?? '',
        path: item.path ?? '',
        sha: item.sha ?? '',
        type: item.type === 'dir' ? 'dir' : 'file',
      }));

    return { ok: true, entries };
  } catch {
    return {
      ok: false,
      code: 'ERROR',
      error: 'Falha de rede ao listar a pasta no GitHub.',
    };
  }
}

export async function getFileContent(token: string, path: string): Promise<GetFileResult> {
  const config = getPublicRepoConfig();

  if (!config) {
    return missingConfig();
  }

  const { owner, repo, branch } = config;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(branch)}`;

  try {
    const response = await fetch(url, { headers: authHeaders(token) });
    const payload = (await response.json().catch(() => ({}))) as GitHubContentItem;

    if (!response.ok) {
      return failureFromResponse(response, payload.message);
    }

    if (payload.type === 'dir' || Array.isArray(payload)) {
      return { ok: false, code: 'ERROR', error: 'O caminho apontado é uma pasta, não um arquivo.' };
    }

    if (!payload.sha || typeof payload.content !== 'string') {
      return { ok: false, code: 'ERROR', error: 'A API do GitHub não devolveu conteúdo ou SHA.' };
    }

    return {
      ok: true,
      sha: payload.sha,
      content: decodeBase64Utf8(payload.content),
    };
  } catch {
    return {
      ok: false,
      code: 'ERROR',
      error: 'Falha de rede ao ler o arquivo no GitHub.',
    };
  }
}

export async function triggerDeploy(): Promise<DeployResult> {
  const hookUrl = import.meta.env.PUBLIC_DEPLOY_HOOK_URL;

  if (!hookUrl) {
    return {
      ok: false,
      error: 'PUBLIC_DEPLOY_HOOK_URL não está configurado. O commit já foi salvo — dispare o rebuild manualmente.',
    };
  }

  try {
    const response = await fetch(hookUrl, { method: 'POST' });

    if (!response.ok) {
      return {
        ok: false,
        error: 'O hook de deploy falhou. O commit já foi salvo — dispare o rebuild manualmente.',
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Não foi possível acionar o deploy. O commit já foi salvo — dispare o rebuild manualmente.',
    };
  }
}

async function afterWrite(): Promise<string | undefined> {
  const deploy = await triggerDeploy();
  return deploy.ok ? undefined : deploy.error;
}

export async function createOrUpdateFile(
  token: string,
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<WriteFileResult> {
  const config = getPublicRepoConfig();

  if (!config) {
    return missingConfig();
  }

  const { owner, repo, branch } = config;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: encodeBase64Utf8(content),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (response.status === 409) {
      return {
        ok: false,
        code: 'CONFLICT',
        error: messageForHttpStatus(409, payload.message),
      };
    }

    if (!response.ok) {
      return failureFromResponse(response, payload.message);
    }

    return { ok: true, deployWarning: await afterWrite() };
  } catch {
    return {
      ok: false,
      code: 'ERROR',
      error: 'Falha de rede ao salvar o arquivo no GitHub.',
    };
  }
}

export async function deleteFile(
  token: string,
  path: string,
  sha: string,
  message: string,
): Promise<WriteFileResult> {
  const config = getPublicRepoConfig();

  if (!config) {
    return missingConfig();
  }

  const { owner, repo, branch } = config;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sha,
        branch,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      return failureFromResponse(response, payload.message);
    }

    return { ok: true, deployWarning: await afterWrite() };
  } catch {
    return {
      ok: false,
      code: 'ERROR',
      error: 'Falha de rede ao excluir o arquivo no GitHub.',
    };
  }
}
