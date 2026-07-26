import LegalPageView from '@/components/legal/LegalPageView';
import { getLegalPage } from '@/lib/beta/legal';

export default async function SpotifyDisconnectLegalPage() {
  const page = await getLegalPage('spotify_disconnect');
  if (!page) return null;
  return <LegalPageView page={page} />;
}
