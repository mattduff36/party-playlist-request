'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/overview');
  }, [router]);

    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
          <div className="text-center">
        <div className="w-8 h-8 mx-auto mb-4 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted">Redirecting...</p>
                </div>
    </div>
  );
}