import LegalPageView from '@/components/legal/LegalPageView';
import { getLegalPage } from '@/lib/beta/legal';

export default async function PrivacyPage() {
  const page = await getLegalPage('privacy');
  if (!page) return null;
  return <LegalPageView page={page} />;
}
