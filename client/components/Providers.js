'use client';

import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';
import SocketProvider from '@/components/SocketProvider';

export default function Providers({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ToastProvider>
        <AuthProvider>
          <SocketProvider>{children}</SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
