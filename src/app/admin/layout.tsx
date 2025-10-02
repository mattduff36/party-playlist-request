import AdminLayout from '../../components/AdminLayout';
import { AdminDataProvider } from '@/contexts/AdminDataContext';
import { GlobalEventProvider } from '@/lib/state/global-event-client';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <GlobalEventProvider>
        <AdminDataProvider>
          <AdminLayout>{children}</AdminLayout>
        </AdminDataProvider>
      </GlobalEventProvider>
    </AdminAuthProvider>
  );
}
