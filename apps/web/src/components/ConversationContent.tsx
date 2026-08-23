'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatApp } from '@/components/ChatApp';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Logo } from '@/components/ui/logo';

export function ConversationContent() {
  const params = useParams();
  const router = useRouter();
  const { setActiveConversationId } = useAppStore();
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/');
      return;
    }

    if (params.id) {
      api.getConversations()
        .then((convos) => {
          const owns = convos.some((c: any) => c.id === params.id);
          if (!owns) {
            setError(true);
            return;
          }
          setActiveConversationId(params.id as string);
        })
        .catch(() => {
          setError(true);
        });
    }
  }, [params.id, router]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Logo size="lg" className="opacity-40" />
          <p className="text-foreground/60 text-sm">Conversation introuvable ou acces refuse.</p>
          <button onClick={() => router.push('/')} className="text-brand text-sm font-medium hover:underline">
            Retour a l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <ChatApp />
    </div>
  );
}
