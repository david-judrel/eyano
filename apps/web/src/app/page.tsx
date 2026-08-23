'use client';

import { useEffect } from 'react';
import { ChatApp } from '@/components/ChatApp';
import { ToastContainer } from '@/components/Toast';
import { useAppStore } from '@/lib/store';

export default function Home() {
  const { setActiveConversationId, setMessages } = useAppStore();

  useEffect(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      <ToastContainer />
      <ChatApp />
    </div>
  );
}