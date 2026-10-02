'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatApp } from '@/components/ChatApp';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { MessageSquareOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';

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
        <EmptyState
          icon={MessageSquareOff}
          title="Conversation introuvable"
          description="Elle n'existe pas ou vous n'y avez pas accès."
          action={<Button onClick={() => router.push('/')}>Retour à l&apos;accueil</Button>}
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <ChatApp />
    </div>
  );
}
