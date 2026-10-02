'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingBlock } from '@/components/admin/AdminKit';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/overview');
  }, []);

  return <LoadingBlock label="Redirection" />;
}
