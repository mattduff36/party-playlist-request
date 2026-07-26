import LegalPageView from '@/components/legal/LegalPageView';
import { getLegalPage } from '@/lib/beta/legal';

export default async function RetentionPage() {
  const page = await getLegalPage('retention');
  if (!page) return null;
  return <LegalPageView page={page} />;
}
