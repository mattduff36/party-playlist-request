'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function AdminRedirect() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  useEffect(() => {
    // Redirect to username-specific admin overview (multi-tenant routing)
    router.replace(`/${username}/admin/overview`);
  }, [router, username]);

    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center">
        <div className="w-8 h-8 mx-auto mb-4 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400">Redirecting...</p>
                </div>
    </div>
  );
}