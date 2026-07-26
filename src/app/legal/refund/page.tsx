import LegalPageView from '@/components/legal/LegalPageView';
import { getLegalPage } from '@/lib/beta/legal';

export default async function RefundPage() {
  const page = await getLegalPage('refund');
  if (!page) return null;
  return <LegalPageView page={page} />;
}
