'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, WifiOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import Button from '@/components/ui/Button';

export function FullScreenSpinner({ label = 'Loading' }) {
  return (
    <div className="flex h-dvh items-center justify-center" role="status" aria-label={label}>
      <Loader2 className="size-6 animate-spin text-muted" />
    </div>
  );
}

// Logged-in users ke liye. Anon -> /login. Server unreachable -> retry screen (session safe rehta hai)
export function RequireAuth({ children }) {
  const { status, retry } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anon') router.replace('/login');
  }, [status, router]);

  if (status === 'authed') return children;
  if (status === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <WifiOff className="size-8 text-muted" aria-hidden />
        <p className="font-medium">Can&apos;t reach the server</p>
        <p className="max-w-xs text-sm text-muted">
          It may be waking up (free hosting sleeps when idle). Wait a few seconds and try again.
        </p>
        <Button onClick={retry}>Try again</Button>
      </div>
    );
  }
  return <FullScreenSpinner />;
}

// Login/Signup pages ke liye: pehle se logged-in ho to chat pe bhejo
export function RedirectIfAuthed({ children }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authed') router.replace('/chat');
  }, [status, router]);

  if (status === 'loading' || status === 'authed') return <FullScreenSpinner />;
  return children;
}
