'use client';

import { useParams } from 'next/navigation';
import RecoveryCentre from '@/components/admin/RecoveryCentre';

export default function AdminRecoveryPage() {
  const params = useParams();
  const username = String(params?.username || '');
  return <RecoveryCentre username={username} />;
}
