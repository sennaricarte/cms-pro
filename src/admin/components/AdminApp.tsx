import { useState } from 'preact/hooks';
import { clearToken } from '../lib/github-client';
import ArticleEditor from './ArticleEditor';
import Dashboard from './Dashboard';
import LoginScreen from './LoginScreen';
import MediaLibrary from './MediaLibrary';
import PageEditor from './PageEditor';
import SiteSettingsEditor from './SiteSettingsEditor';

type View =
  | { name: 'dashboard' }
  | { name: 'media' }
  | { name: 'settings' }
  | { name: 'article-editor'; mode: 'create' | 'edit'; path?: string }
  | { name: 'page-editor'; mode: 'create' | 'edit'; path?: string };

export default function AdminApp() {
  const [session, setSession] = useState<{ token: string; repoName: string } | null>(null);
  const [view, setView] = useState<View>({ name: 'dashboard' });
  const [flash, setFlash] = useState('');

  if (!session) {
    return (
      <LoginScreen
        onAuthenticated={(token, repoName) => {
          setSession({ token, repoName });
          setView({ name: 'dashboard' });
        }}
      />
    );
  }

  function logout() {
    clearToken();
    setSession(null);
    setView({ name: 'dashboard' });
  }

  if (view.name === 'article-editor') {
    return (
      <ArticleEditor
        token={session.token}
        mode={view.mode}
        path={view.path}
        onCancel={() => setView({ name: 'dashboard' })}
        onSaved={(warning) => {
          setFlash(warning ?? 'Artigo salvo.');
          setView({ name: 'dashboard' });
        }}
      />
    );
  }

  if (view.name === 'page-editor') {
    return (
      <PageEditor
        token={session.token}
        mode={view.mode}
        path={view.path}
        onCancel={() => setView({ name: 'dashboard' })}
        onSaved={(warning) => {
          setFlash(warning ?? 'Página salva.');
          setView({ name: 'dashboard' });
        }}
      />
    );
  }

  return (
    <div class="admin-app">
      <nav class="admin-tabs" aria-label="Seções do admin">
        <button
          type="button"
          class={`admin-tabs__item${view.name === 'dashboard' ? ' is-active' : ''}`}
          aria-current={view.name === 'dashboard' ? 'page' : undefined}
          onClick={() => {
            setFlash('');
            setView({ name: 'dashboard' });
          }}
        >
          Dashboard
        </button>
        <button
          type="button"
          class={`admin-tabs__item${view.name === 'media' ? ' is-active' : ''}`}
          aria-current={view.name === 'media' ? 'page' : undefined}
          onClick={() => {
            setFlash('');
            setView({ name: 'media' });
          }}
        >
          Mídia
        </button>
        <button
          type="button"
          class={`admin-tabs__item${view.name === 'settings' ? ' is-active' : ''}`}
          aria-current={view.name === 'settings' ? 'page' : undefined}
          onClick={() => {
            setFlash('');
            setView({ name: 'settings' });
          }}
        >
          Configurações
        </button>
      </nav>

      {view.name === 'settings' ? (
        <div class="admin-dashboard">
          <header class="admin-dashboard__header">
            <div>
              <p class="admin-dashboard__eyebrow">Admin</p>
              <h1>Configurações do site</h1>
            </div>
            <button type="button" class="admin-button admin-button--ghost" onClick={logout}>
              Sair
            </button>
          </header>
          <SiteSettingsEditor token={session.token} />
        </div>
      ) : view.name === 'media' ? (
        <div class="admin-dashboard">
          <header class="admin-dashboard__header">
            <div>
              <p class="admin-dashboard__eyebrow">Admin</p>
              <h1>Biblioteca de mídia</h1>
            </div>
            <button type="button" class="admin-button admin-button--ghost" onClick={logout}>
              Sair
            </button>
          </header>
          <MediaLibrary token={session.token} />
        </div>
      ) : (
        <Dashboard
          token={session.token}
          repoName={session.repoName}
          onLogout={logout}
          flashMessage={flash}
          onNewArticle={() => {
            setFlash('');
            setView({ name: 'article-editor', mode: 'create' });
          }}
          onEditArticle={(path) => {
            setFlash('');
            setView({ name: 'article-editor', mode: 'edit', path });
          }}
          onNewPage={() => {
            setFlash('');
            setView({ name: 'page-editor', mode: 'create' });
          }}
          onEditPage={(path) => {
            setFlash('');
            setView({ name: 'page-editor', mode: 'edit', path });
          }}
        />
      )}
    </div>
  );
}
