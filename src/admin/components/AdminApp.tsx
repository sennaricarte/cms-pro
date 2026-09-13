import { useState } from 'preact/hooks';
import { clearToken } from '../lib/github-client';
import ArticleEditor from './ArticleEditor';
import Dashboard from './Dashboard';
import LoginScreen from './LoginScreen';

type View =
  | { name: 'dashboard' }
  | { name: 'article-editor'; mode: 'create' | 'edit'; path?: string };

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

  return (
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
    />
  );
}
