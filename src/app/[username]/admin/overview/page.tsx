'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

/**
 * Legacy Overview route — permanently superseded by /admin/requests.
 * next.config also redirects /overview → /requests; this is a client fallback.
 */
export default function AdminOverviewRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    router.replace(`/${username}/admin/requests${search}`);
  }, [router, username]);

  return (
    <div className="text-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
      <p className="text-muted mt-4">Redirecting...</p>
    </div>
  );
}
