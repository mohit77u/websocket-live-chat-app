'use client';

import { Loader2, ShieldAlert } from 'lucide-react';
import { useSocketFailReason, useSocketStatus } from '@/components/SocketProvider';

// Connection "online" na ho to content ke upar patti dikhe
export default function ConnectionBanner() {
  const status = useSocketStatus();
  const reason = useSocketFailReason();

  if (status === 'online' || status === 'idle') return null;

  if (status === 'failed') {
    return (
      <div role="alert" className="flex items-center gap-2 bg-danger px-4 py-2 text-sm text-white">
        <ShieldAlert className="size-4 shrink-0" aria-hidden />
        {reason || 'Cannot connect to the server.'}
      </div>
    );
  }

  return (
    <div role="status" className="flex items-center gap-2 bg-amber-500 px-4 py-1.5 text-sm font-medium text-black">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {status === 'connecting' ? 'Connecting…' : 'Reconnecting… messages will sync when you are back online'}
    </div>
  );
}
