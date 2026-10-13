'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChatProvider, useChat } from '@/lib/chat';
import Sidebar from './Sidebar';
import ConnectionBanner from './ConnectionBanner';

export default function ChatShell({ children }) {
  return (
    <ChatProvider>
      <Layout>{children}</Layout>
    </ChatProvider>
  );
}

function Layout({ children }) {
  const { sidebarOpen, setSidebarOpen } = useChat();
  const pathname = usePathname();
  const atRoot = pathname === '/chat';

  // route badalte hi mobile drawer band
  useEffect(() => setSidebarOpen(false), [pathname, setSidebarOpen]);

  // mobile pe /chat (koi conversation nahi) = sidebar hi pura screen; warna drawer
  const visible = sidebarOpen || atRoot;

  return (
    <div className="flex h-dvh overflow-hidden">
      {sidebarOpen && !atRoot && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 border-r border-border transition-transform duration-200 md:static md:w-80 md:max-w-none md:translate-x-0 md:shrink-0 ${
          atRoot ? 'w-full' : 'w-[85%] max-w-[22rem]'
        } ${visible ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Sidebar"
      >
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectionBanner />
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
