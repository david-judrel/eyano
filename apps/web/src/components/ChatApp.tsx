'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './layout/Sidebar';
import { TopBar } from './layout/TopBar';
import { ChatView } from './ChatView';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Logo } from './ui/logo';

export function ChatApp() {
  const router = useRouter();
  const { user, setUser, setConversations, authInitialized, setAuthInitialized } = useAppStore();

  useEffect(() => {
    if (authInitialized) return;

    const token = api.getToken();
    if (token) {
      api.getMe()
        .then((u) => {
          setUser(u);
          return api.getConversations();
        })
        .then((convos) => setConversations(convos))
        .catch(() => {
          api.setToken(null);
          setUser(null);
        })
        .finally(() => setAuthInitialized(true));
    } else {
      setAuthInitialized(true);
    }
  }, [authInitialized]);

  const handleRequireLogin = (message: string) => {
    if (message) {
      sessionStorage.setItem('eyano_pending_message', message);
    }
    router.push('/login');
  };

  if (!authInitialized) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background" role="status" aria-label="Chargement">
        <Logo size="lg" className="animate-pulse-subtle" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {user && <Sidebar />}
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <TopBar onLoginClick={() => router.push('/login')} />
        <ChatView onRequireLogin={handleRequireLogin} />
      </div>
    </div>
  );
}
