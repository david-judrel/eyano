'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatApp } from '@/components/ChatApp';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';

export function ConversationContent() {
  const params = useParams();
  const router = useRouter();
  const { setActiveConversationId, user } = useAppStore();

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/');
      return;
    }

    if (params.id) {
      setActiveConversationId(params.id as string);
    }
  }, [params.id, router]);

  return (
    <div className="h-full w-full overflow-hidden">
      <ChatApp />
    </div>
  );
}
