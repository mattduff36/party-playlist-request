import AdminLayout from '../../components/AdminLayout';
import { AdminDataProvider } from '@/contexts/AdminDataContext';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminDataProvider>
      <AdminLayout>{children}</AdminLayout>
    </AdminDataProvider>
  );
}
