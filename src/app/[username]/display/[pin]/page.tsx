'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageLoader from '@/components/ui/PageLoader';

/**
 * Legacy /{username}/display/{pin} → /{username}/{accessCode}/display
 */
export default function LegacyDisplayPinRedirect() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const pin = params.pin as string;

  useEffect(() => {
    if (username && pin) {
      router.replace(`/${username}/${pin}/display`);
    }
  }, [username, pin, router]);

  return <PageLoader label="Redirecting..." />;
}
