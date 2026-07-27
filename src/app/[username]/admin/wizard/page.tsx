'use client';

import { useParams } from 'next/navigation';
import ReadinessWizard from '@/components/admin/ReadinessWizard';

export default function AdminWizardPage() {
  const params = useParams();
  const username = String(params?.username || '');
  return <ReadinessWizard username={username} />;
}
