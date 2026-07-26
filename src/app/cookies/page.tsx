import LegalPageView from '@/components/legal/LegalPageView';
import { getLegalPage } from '@/lib/beta/legal';

export default async function CookiesPage() {
  const page = await getLegalPage('cookies');
  if (!page) return null;
  return <LegalPageView page={page} />;
}
