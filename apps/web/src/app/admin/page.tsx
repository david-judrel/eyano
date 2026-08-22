'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/overview');
  }, []);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#39FF14]/20 border-t-[#39FF14]" />
    </div>
  );
}
