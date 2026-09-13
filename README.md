# CMS Pro

Site Astro 7 estático (`output: 'static'`) com admin Preact. O deploy previsto é na Vercel.

## Admin (`/admin`)

O painel fica em `/admin`. Em produção ele é protegido por HTTP Basic via **Vercel Edge Middleware** (`middleware.ts` na raiz).

- O `matcher` é só `/admin/:path*`. Rotas públicas (`/`, `/blog`, etc.) não passam pelo middleware e não pedem usuário/senha.
- Usuário e senha vêm de `ADMIN_BASIC_AUTH_USER` e `ADMIN_BASIC_AUTH_PASSWORD` — **sem** prefixo `PUBLIC_`. Elas existem só no ambiente de execução do middleware, não no JS do browser.
- Configure essas variáveis em **Vercel → Project Settings → Environment Variables**, não em um `.env` commitado.

### Teste pós-deploy

O Edge Middleware da Vercel **não roda** no `pnpm dev` nem no `pnpm preview` da mesma forma que em produção. A validação completa só acontece depois do deploy real:

1. Abra `https://SEU-DOMINIO/admin` (e `/admin/`) em uma janela anônima.
2. O navegador deve mostrar o prompt nativo de usuário/senha.
3. Credencial errada ou Cancelar → 401.
4. Credencial correta → o admin carrega.
5. Abra `/` e `/blog` na mesma janela anônima: **não** deve pedir autenticação.
