import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  clearUploadSecret,
  getStoredUploadSecret,
  listMedia,
  storeUploadSecret,
} from '../lib/media-client';

type Status = 'checking' | 'locked' | 'validating' | 'ready';

interface Props {
  children: ComponentChildren;
}

export default function MediaAuthGate({ children }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [secret, setSecret] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function authenticate(value: string, persist: boolean) {
    setStatus('validating');
    setErrorMessage('');

    const result = await listMedia(value);

    if (!result.ok) {
      if (result.code === 'UNAUTHORIZED') {
        clearUploadSecret();
      }

      setStatus('locked');
      setErrorMessage(result.error);
      return;
    }

    if (persist) {
      storeUploadSecret(value.trim());
    }

    setStatus('ready');
  }

  useEffect(() => {
    const stored = getStoredUploadSecret();

    if (!stored) {
      setStatus('locked');
      return;
    }

    void authenticate(stored, false);
  }, []);

  function handleSubmit(event: Event) {
    event.preventDefault();
    void authenticate(secret, true);
  }

  if (status === 'checking' || (status === 'validating' && !errorMessage && !secret)) {
    return (
      <section class="admin-card" aria-busy="true" aria-live="polite">
        <p>Validando acesso à biblioteca…</p>
      </section>
    );
  }

  if (status !== 'ready') {
    return (
      <section class="admin-card">
        <h2>Upload Secret</h2>
        <p>
          Este código é diferente do Personal Access Token do GitHub. Ele é fornecido pela agência
          para este cliente e libera o envio de imagens ao armazenamento remoto.
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="upload-secret">Upload Secret</label>
          <input
            id="upload-secret"
            type="password"
            name="upload-secret"
            autoComplete="off"
            spellCheck={false}
            value={secret}
            onInput={(event) => setSecret((event.target as HTMLInputElement).value)}
            disabled={status === 'validating'}
            required
          />
          <button type="submit" class="admin-button" disabled={status === 'validating'}>
            {status === 'validating' ? 'Validando…' : 'Entrar na biblioteca'}
          </button>
        </form>
        {errorMessage ? (
          <p class="admin-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>
    );
  }

  return <>{children}</>;
}
