# CMS Pro

## O que é este projeto

Template Astro 7 estático (`output: 'static'`) com CMS custom. O admin é Preact (`client:only`), sem banco de dados: artigos, páginas e configurações do site vivem em Markdown/JSON no repositório. O cliente edita pelo `/admin`, o painel grava via GitHub Contents API e a Vercel reconstrói o site. A mídia fica em um bucket Cloudflare R2 compartilhado, servida por um Worker de upload (`decola-seo-upload-worker`) que autentica cada cliente por um prefixo e um segredo no KV.

## Pré-requisitos (uma vez só, não repete por cliente)

Estes itens já existem e são compartilhados. O passo a passo de criá-los do zero está no README do repositório **decola-seo-upload-worker** — aqui só se assume que eles estão no ar.

- Worker de upload já deployado (repositório separado: `decola-seo-upload-worker`)
- Bucket R2 compartilhado já criado, com acesso público habilitado
- Namespace Workers KV `CLIENT_SECRETS` já criado e ligado ao Worker

## Passo a passo para um cliente novo

### 1. Criar o repositório a partir deste template

No GitHub, abra este repositório e use **Use this template**. Crie o repo novo na conta ou organização do cliente (nome sugerido: o slug do cliente, o mesmo que você vai usar no KV e em `PUBLIC_CLIENT_PREFIX`).

### 2. Provisionar o segredo do cliente no KV compartilhado

Gere um segredo (`openssl rand -hex 32`) e grave-o no KV **a partir do repositório do Worker**, não deste:

```bash
wrangler kv key put --binding=CLIENT_SECRETS "{slug-do-cliente}" "{segredo-gerado-com-openssl-rand}" --remote
```

O `{slug-do-cliente}` precisa ser o mesmo valor que você vai colocar em `PUBLIC_CLIENT_PREFIX` na Vercel. O admin guarda o segredo no `localStorage` do navegador na primeira autenticação de mídia; o Worker compara com o KV.

### 3. Criar o projeto na Vercel

Na Vercel, **Add New Project** apontando para o repositório criado no passo 1. Framework: Astro. Não precisa de comando de build customizado (`pnpm build` / output `dist`).

### 4. Environment Variables na Vercel

Cadastre em **Project Settings → Environment Variables** (Production, Preview e Development, salvo quando fizer sentido restringir):

| Variável | O que é |
|---|---|
| `PUBLIC_GITHUB_OWNER` | Dono (user ou org) do repositório GitHub deste cliente. Vai para o bundle do admin, que chama a Contents API. |
| `PUBLIC_GITHUB_REPO` | Nome do repositório deste cliente. Precisa ser o repo criado no passo 1. |
| `PUBLIC_GITHUB_BRANCH` | Branch que o admin lê e grava (em geral `main`). |
| `PUBLIC_UPLOAD_ENDPOINT` | URL pública do Worker compartilhado (a mesma para todos os clientes). |
| `PUBLIC_CLIENT_PREFIX` | Slug único deste cliente. Tem que ser idêntico à chave gravada no KV no passo 2. |
| `ADMIN_BASIC_AUTH_USER` | Usuário do HTTP Basic que protege `/admin` no Edge da Vercel. **Sem** prefixo `PUBLIC_`. Gere um valor único por cliente. |
| `ADMIN_BASIC_AUTH_PASSWORD` | Senha do HTTP Basic. **Sem** prefixo `PUBLIC_`. Gere um valor único por cliente; não commite em `.env`. |
| `PUBLIC_DEPLOY_HOOK_URL` | URL do Deploy Hook da Vercel. **Deixe vazio no primeiro deploy** e preencha no passo 6. |

O Personal Access Token do GitHub **não** é variável de ambiente. O cliente cola o PAT no `/admin`; ele fica só no `localStorage` daquele navegador.

### 5. Primeiro deploy manual

Dispare o primeiro deploy na Vercel (o que o import do projeto já faz, ou um Redeploy). Confirme que o site público sobe e que `https://SEU-DOMINIO/admin` pede o Basic Auth.

O Edge Middleware (`middleware.ts`, matcher `/admin/:path*`) **não se comporta igual** em `pnpm dev` / `pnpm preview`. A proteção Basic só vale no deploy real.

### 6. Deploy Hook (rebuild depois que o admin salva)

1. Na Vercel: **Settings → Git → Deploy Hooks**
2. Crie um hook (nome livre, branch = `PUBLIC_GITHUB_BRANCH`)
3. Cole a URL em `PUBLIC_DEPLOY_HOOK_URL`
4. Faça um **redeploy** para o admin passar a enxergar o hook

Sem esse passo, o commit do admin funciona, mas o site não reconstrói sozinho.

### 7. Liberar o domínio do cliente no CORS do Worker

No repositório **decola-seo-upload-worker**, acrescente o domínio de produção deste cliente em `ALLOWED_ORIGINS` (`wrangler.toml`). Commit e rode `wrangler deploy` de novo. Sem isso, o upload no browser falha por CORS.

### 8. PAT do cliente

O cliente gera um Personal Access Token **fine-grained** no GitHub:

- Escopo: **somente** o repositório deste cliente
- Permissão: **Contents** (read and write)
- Data de expiração definida

Esse PAT é o segundo login do `/admin` (depois do Basic Auth). Não compartilhe o PAT entre clientes e não o coloque na Vercel.

### 9. Testar o fluxo completo

1. Janela anônima em `https://SEU-DOMINIO/admin` → prompt Basic Auth (`ADMIN_BASIC_AUTH_*`).
2. Credencial errada ou Cancelar → 401. Credencial certa → o admin carrega.
3. `/` e `/blog` na mesma janela **não** pedem Basic Auth.
4. Login com o PAT (passo 8).
5. Autenticar a mídia com o segredo provisionado no KV; enviar uma imagem.
6. Criar ou editar um artigo (acentos inclusos) e salvar.
7. Confirmar o commit no GitHub e o rebuild automático na Vercel (passo 6).

## Variáveis e onde vivem

| Nome da variável | Onde é configurada | Compartilhada entre clientes ou única por cliente | Vai para o bundle público? |
|---|---|---|---|
| `PUBLIC_GITHUB_OWNER` | Vercel (Environment Variables) | Única por cliente | Sim |
| `PUBLIC_GITHUB_REPO` | Vercel | Única por cliente | Sim |
| `PUBLIC_GITHUB_BRANCH` | Vercel | Única por cliente (quase sempre `main`) | Sim |
| `PUBLIC_UPLOAD_ENDPOINT` | Vercel | Compartilhada (URL do mesmo Worker) | Sim |
| `PUBLIC_CLIENT_PREFIX` | Vercel | Única por cliente (bate com a chave no KV) | Sim |
| `PUBLIC_DEPLOY_HOOK_URL` | Vercel (depois do passo 6) | Única por cliente (hook daquele projeto) | Sim |
| `ADMIN_BASIC_AUTH_USER` | Vercel | Única por cliente | Não (só o Edge Middleware) |
| `ADMIN_BASIC_AUTH_PASSWORD` | Vercel | Única por cliente | Não (só o Edge Middleware) |
| Segredo de upload (KV) | `wrangler kv key put` no repo do Worker | Única por cliente (chave = slug) | Não |
| PAT fine-grained do GitHub | Gerado pelo cliente; `localStorage` do browser | Único por pessoa/cliente | Não (nunca entra no build) |
| `CLIENT_SECRETS` (binding KV) | Worker compartilhado | Infra compartilhada | Não |
| `ALLOWED_ORIGINS` | `wrangler.toml` do Worker | Lista compartilhada; cada cliente acrescenta o próprio domínio | Não (config do Worker) |

## Solução de problemas comuns

- **"PUBLIC_DEPLOY_HOOK_URL não está configurado" no admin:** falta o passo 6. O arquivo já foi commitado; dispare um rebuild manual na Vercel e preencha a variável antes do próximo save.
- **Upload de mídia falha com erro de CORS:** o domínio de produção não está em `ALLOWED_ORIGINS`. Volte ao passo 7 e faça `wrangler deploy`.
- **Upload retorna 401 "Cliente não provisionado":** falta o passo 2, ou `PUBLIC_CLIENT_PREFIX` na Vercel é diferente da chave gravada no KV.
- **`git push` rejeitado (non-fast-forward):** o admin também commita neste repositório. Rode `git pull` (ou `git pull --rebase`) antes de enviar de novo; não use force push em `main`.
- **Basic Auth não aparece em `pnpm dev` / `pnpm preview`:** esperado. O `middleware.ts` só roda no Edge da Vercel após o deploy.
