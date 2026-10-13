'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { FullScreenSpinner } from '@/components/AuthGate';

// Sirf router: logged in -> /chat, warna /login
export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authed') router.replace('/chat');
    else if (status === 'anon') router.replace('/login');
  }, [status, router]);

  return <FullScreenSpinner />;
}
