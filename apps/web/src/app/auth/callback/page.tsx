'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Logo } from '@/components/ui/logo';
import { ToastContainer } from '@/components/Toast';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAppStore();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      router.replace('/login?error=oauth_failed');
      return;
    }

    if (!token) {
      router.replace('/login');
      return;
    }

    api.setToken(token);
    api.getMe()
      .then((user) => {
        setUser(user);
        const pendingMessage = sessionStorage.getItem('eyano_pending_message');
        sessionStorage.removeItem('eyano_pending_message');
        if (pendingMessage) {
          useAppStore.setState({ pendingGuestMessage: pendingMessage });
        }
        router.replace('/');
      })
      .catch(() => {
        api.setToken(null);
        router.replace('/login?error=oauth_failed');
      });
  }, [searchParams, router, setUser]);

  return (
    <div className="flex flex-col items-center gap-4">
      <Logo size="lg" className="animate-spin opacity-60" />
      <p className="text-muted text-sm">Connexion en cours...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen w-full bg-background items-center justify-center">
      <ToastContainer />
      <Suspense fallback={
        <div className="flex flex-col items-center gap-4">
          <Logo size="lg" className="animate-spin opacity-60" />
          <p className="text-muted text-sm">Chargement...</p>
        </div>
      }>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
