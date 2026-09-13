import { useEffect, useState } from 'preact/hooks';
import { clearToken, getStoredToken, storeToken, validateToken } from '../lib/github-client';

// O PAT fica no localStorage deste navegador. Use um token fine-grained,
// só neste repositório, Contents read/write, com data de expiração.

type Status = 'idle' | 'validating' | 'error' | 'success';

interface Props {
  onAuthenticated?: (token: string, repoName: string) => void;
}

export default function LoginScreen({ onAuthenticated }: Props) {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status>('validating');
  const [errorMessage, setErrorMessage] = useState('');

  async function authenticate(value: string, persist: boolean) {
    setStatus('validating');
    setErrorMessage('');

    const result = await validateToken(value);

    if (!result.valid) {
      if (!persist) {
        clearToken();
      }
      setStatus('error');
      setErrorMessage(result.error ?? 'Não foi possível validar o token.');
      return;
    }

    if (!result.canPush) {
      if (!persist) {
        clearToken();
      }
      setStatus('error');
      setErrorMessage('Token válido mas sem permissão de escrita neste repositório.');
      return;
    }

    if (persist) {
      // PAT fica só no localStorage deste navegador — nunca em env de build.
      storeToken(value.trim());
    }

    setStatus('success');
    onAuthenticated?.(value.trim(), result.repoName ?? '');
  }

  useEffect(() => {
    const stored = getStoredToken();

    if (!stored) {
      setStatus('idle');
      return;
    }

    void authenticate(stored, false);
  }, []);

  function handleSubmit(event: Event) {
    event.preventDefault();
    void authenticate(token, true);
  }

  const isCheckingStoredToken = status === 'validating' && token === '' && !errorMessage;

  if (isCheckingStoredToken) {
    return (
      <section class="admin-card" aria-busy="true" aria-live="polite">
        <p>Validando sessão salva…</p>
      </section>
    );
  }

  return (
    <section class="admin-card">
      <h1>Entrar no admin</h1>
      <p>Cole um Personal Access Token fine-grained com acesso só a este repositório.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="github-pat">Personal Access Token</label>
        <input
          id="github-pat"
          type="password"
          name="token"
          autoComplete="off"
          spellCheck={false}
          value={token}
          onInput={(event) => setToken((event.target as HTMLInputElement).value)}
          disabled={status === 'validating'}
          required
        />
        <button type="submit" class="admin-button" disabled={status === 'validating'}>
          {status === 'validating' ? 'Conectando…' : 'Conectar'}
        </button>
      </form>
      {status === 'error' && errorMessage ? (
        <p class="admin-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
