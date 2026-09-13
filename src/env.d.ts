/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GITHUB_OWNER: string;
  readonly PUBLIC_GITHUB_REPO: string;
  readonly PUBLIC_GITHUB_BRANCH: string;
  readonly PUBLIC_DEPLOY_HOOK_URL: string;
  readonly PUBLIC_UPLOAD_ENDPOINT: string;
  readonly PUBLIC_CLIENT_PREFIX: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
