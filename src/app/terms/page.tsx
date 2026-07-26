import LegalPageView from '@/components/legal/LegalPageView';
import { getLegalPage } from '@/lib/beta/legal';

export default async function TermsPage() {
  const page = await getLegalPage('terms');
  if (!page) return null;
  return <LegalPageView page={page} />;
}
