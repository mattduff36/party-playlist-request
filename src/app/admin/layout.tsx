import AdminLayout from '../../components/AdminLayout';
import { AdminDataProvider } from '@/contexts/AdminDataContext';
import { GlobalEventProvider } from '@/lib/state/global-event-client';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <NotificationProvider>
        <GlobalEventProvider>
          <AdminDataProvider>
            <AdminLayout>{children}</AdminLayout>
          </AdminDataProvider>
        </GlobalEventProvider>
      </NotificationProvider>
    </AdminAuthProvider>
  );
}
