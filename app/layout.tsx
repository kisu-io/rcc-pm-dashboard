import './globals.css';
import type { Metadata, Viewport } from 'next';
import Sidebar from '@/components/Sidebar';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 w-full min-w-0 p-4 md:p-6 pt-20 md:pt-6 overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}