import './globals.css';
import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';
import { getModuleAvailability } from '@/lib/data-server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RCC Project Management',
  description: 'Construction Project Management Dashboard',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0F1B3D',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Decides whether Budget and Materials appear in the nav at all. Cheap head
  // counts — see lib/data-server.ts::getModuleAvailability.
  const modules = await getModuleAvailability();

  return (
    <html lang="vi">
      <body>
        <AuthProvider>
          <AppShell modules={modules}>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}