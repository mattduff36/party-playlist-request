'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function AdminRedirect() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  useEffect(() => {
    router.replace(`/${username}/admin/spotify`);
  }, [router, username]);

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 mx-auto mb-4 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted">Redirecting...</p>
      </div>
    </div>
  );
}
