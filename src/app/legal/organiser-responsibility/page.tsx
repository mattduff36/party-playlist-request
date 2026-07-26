import LegalPageView from '@/components/legal/LegalPageView';
import { getLegalPage } from '@/lib/beta/legal';

export default async function OrganiserResponsibilityPage() {
  const page = await getLegalPage('organiser_responsibility');
  if (!page) return null;
  return <LegalPageView page={page} />;
}
