import { useEffect, useState } from 'preact/hooks';
import { createOrUpdateFile, getFileContent } from '../lib/github-client';
import {
  generateSalt,
  hashPassword,
  parseCmsUsers,
  type CmsUser,
} from '../lib/password-hash';

interface Props {
  token: string;
}

const USERS_PATH = 'src/data/users.json';
const MIN_PASSWORD = 8;

export default function UsersEditor({ token }: Props) {
  const [users, setUsers] = useState<CmsUser[]>([]);
  const [sha, setSha] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [newErrors, setNewErrors] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<string | null>(null);
  const [nextPassword, setNextPassword] = useState('');
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setFormError('');
      setRateLimitMessage('');

      const result = await getFileContent(token, USERS_PATH);

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setLoading(false);

        if (result.code === 'NOT_FOUND') {
          setUsers([]);
          setSha(undefined);
          return;
        }

        if (result.code === 'RATE_LIMIT') {
          setRateLimitMessage(result.error);
        }

        setFormError(result.error);
        return;
      }

      try {
        setSha(result.sha);
        setUsers(parseCmsUsers(JSON.parse(result.content)));
      } catch {
        setFormError('Não foi possível ler src/data/users.json. O arquivo pode estar malformado.');
      }

      setLoading(false);
    }

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function usernameTaken(username: string, except?: string): boolean {
    const key = username.trim().toLowerCase();
    return users.some(
      (user) => user.username.toLowerCase() === key && user.username.toLowerCase() !== except?.toLowerCase(),
    );
  }

  async function handleAdd(event: Event) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const username = newUsername.trim();

    if (!username) {
      errors.username = 'Informe o nome de usuário.';
    } else if (/\s/.test(username)) {
      errors.username = 'O usuário não pode ter espaços.';
    } else if (usernameTaken(username)) {
      errors.username = 'Este usuário já existe.';
    }

    if (newPassword.length < MIN_PASSWORD) {
      errors.password = `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
    }

    if (newPassword !== newPasswordConfirm) {
      errors.confirm = 'As senhas não coincidem.';
    }

    setNewErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const salt = generateSalt();
    const hash = await hashPassword(newPassword, salt);

    setUsers((current) => [
      ...current,
      {
        username,
        salt,
        hash,
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setNewUsername('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setActionMessage(`${username} foi adicionado. Salve para aplicar no próximo deploy.`);
  }

  async function handleChangePassword(username: string) {
    setPasswordError('');

    if (nextPassword.length < MIN_PASSWORD) {
      setPasswordError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }

    if (nextPassword !== nextPasswordConfirm) {
      setPasswordError('As senhas não coincidem.');
      return;
    }

    const salt = generateSalt();
    const hash = await hashPassword(nextPassword, salt);

    setUsers((current) =>
      current.map((user) => (user.username === username ? { ...user, salt, hash } : user)),
    );
    setPasswordTarget(null);
    setNextPassword('');
    setNextPasswordConfirm('');
    setActionMessage(`Senha de ${username} atualizada em memória. Salve para aplicar.`);
  }

  function handleDelete(username: string) {
    setUsers((current) => current.filter((user) => user.username !== username));
    setPendingDelete(null);
    setActionMessage(`${username} foi removido. Salve para aplicar.`);
  }

  async function handleSave(event: Event) {
    event.preventDefault();
    setFormError('');
    setRateLimitMessage('');
    setActionMessage('');
    setSaving(true);

    const content = `${JSON.stringify(users, null, 2)}\n`;
    const result = await createOrUpdateFile(token, USERS_PATH, content, 'cms: atualizar usuários do admin', sha);

    if (!result.ok) {
      setSaving(false);

      if (result.code === 'RATE_LIMIT') {
        setRateLimitMessage(result.error);
      }

      if (result.code === 'CONFLICT') {
        setFormError(
          'A lista de usuários foi alterada por outro processo desde que você abriu — recarregue antes de salvar',
        );
        return;
      }

      setFormError(result.error);
      return;
    }

    const refreshed = await getFileContent(token, USERS_PATH);

    if (refreshed.ok) {
      setSha(refreshed.sha);
    }

    setSaving(false);
    setActionMessage(result.deployWarning ?? 'Usuários salvos. O Basic Auth novo vale após o deploy (~1 min).');
  }

  if (loading) {
    return (
      <section class="admin-card" aria-busy="true">
        <div class="admin-skeleton" aria-label="Carregando usuários">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  return (
    <div class="admin-settings">
      <p class="admin-banner" role="status">
        Alterações aqui exigem um novo deploy (automático) para funcionar — pode levar cerca de 1 minuto.
      </p>

      {rateLimitMessage ? (
        <p class="admin-banner" role="alert">
          {rateLimitMessage}
        </p>
      ) : null}

      {formError ? (
        <p class="admin-error" role="alert">
          {formError}
        </p>
      ) : null}

      {actionMessage ? (
        <p class="admin-banner admin-banner--info" role="status">
          {actionMessage}
        </p>
      ) : null}

      <section class="admin-card">
        <h2>Usuários</h2>
        {users.length === 0 ? (
          <p class="admin-empty">Nenhum usuário ainda. A conta mestre das variáveis da Vercel continua valendo.</p>
        ) : (
          <ul class="admin-list">
            {users.map((user) => (
              <li key={user.username} class="admin-list__item">
                <div>
                  <p class="admin-list__name">{user.username}</p>
                  <p class="admin-field__hint">Criado em {user.createdAt}</p>
                </div>
                <div class="admin-list__actions">
                  {passwordTarget === user.username ? (
                    <form
                      class="admin-repeat-row"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleChangePassword(user.username);
                      }}
                    >
                      <div class="admin-field">
                        <label htmlFor={`pw-${user.username}`}>Nova senha</label>
                        <input
                          id={`pw-${user.username}`}
                          type="password"
                          value={nextPassword}
                          onInput={(event) => setNextPassword((event.target as HTMLInputElement).value)}
                          disabled={saving}
                          minLength={MIN_PASSWORD}
                          required
                        />
                      </div>
                      <div class="admin-field">
                        <label htmlFor={`pw2-${user.username}`}>Confirmar senha</label>
                        <input
                          id={`pw2-${user.username}`}
                          type="password"
                          value={nextPasswordConfirm}
                          onInput={(event) => setNextPasswordConfirm((event.target as HTMLInputElement).value)}
                          disabled={saving}
                          minLength={MIN_PASSWORD}
                          required
                        />
                      </div>
                      {passwordError ? <p class="admin-field__error">{passwordError}</p> : null}
                      <div class="admin-list__actions">
                        <button type="submit" class="admin-button" disabled={saving}>
                          Atualizar senha
                        </button>
                        <button
                          type="button"
                          class="admin-button admin-button--ghost"
                          disabled={saving}
                          onClick={() => {
                            setPasswordTarget(null);
                            setPasswordError('');
                            setNextPassword('');
                            setNextPasswordConfirm('');
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : pendingDelete === user.username ? (
                    <>
                      <span class="admin-list__confirm">Excluir {user.username}?</span>
                      <button
                        type="button"
                        class="admin-button admin-button--danger"
                        disabled={saving}
                        onClick={() => handleDelete(user.username)}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        class="admin-button admin-button--ghost"
                        disabled={saving}
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
                        disabled={saving}
                        onClick={() => {
                          setPasswordTarget(user.username);
                          setPendingDelete(null);
                          setPasswordError('');
                          setNextPassword('');
                          setNextPasswordConfirm('');
                        }}
                      >
                        Trocar senha
                      </button>
                      <button
                        type="button"
                        class="admin-button admin-button--ghost"
                        disabled={saving}
                        onClick={() => {
                          setPendingDelete(user.username);
                          setPasswordTarget(null);
                        }}
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

      <form class="admin-card admin-form" onSubmit={(event) => void handleAdd(event)}>
        <h2>Novo usuário</h2>
        <div class="admin-field">
          <label htmlFor="new-username">Usuário</label>
          <input
            id="new-username"
            type="text"
            value={newUsername}
            onInput={(event) => setNewUsername((event.target as HTMLInputElement).value)}
            disabled={saving}
            autoComplete="off"
            required
          />
          {newErrors.username ? <p class="admin-field__error">{newErrors.username}</p> : null}
        </div>
        <div class="admin-field">
          <label htmlFor="new-password">Senha</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onInput={(event) => setNewPassword((event.target as HTMLInputElement).value)}
            disabled={saving}
            minLength={MIN_PASSWORD}
            required
          />
          {newErrors.password ? <p class="admin-field__error">{newErrors.password}</p> : null}
        </div>
        <div class="admin-field">
          <label htmlFor="new-password-confirm">Confirmar senha</label>
          <input
            id="new-password-confirm"
            type="password"
            value={newPasswordConfirm}
            onInput={(event) => setNewPasswordConfirm((event.target as HTMLInputElement).value)}
            disabled={saving}
            minLength={MIN_PASSWORD}
            required
          />
          {newErrors.confirm ? <p class="admin-field__error">{newErrors.confirm}</p> : null}
        </div>
        <button type="submit" class="admin-button" disabled={saving}>
          Adicionar à lista
        </button>
      </form>

      <form class="admin-card" onSubmit={(event) => void handleSave(event)}>
        <button type="submit" class="admin-button" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  );
}
