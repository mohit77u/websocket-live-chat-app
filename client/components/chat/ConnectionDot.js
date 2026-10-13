'use client';

import { useSocketStatus } from '@/components/SocketProvider';

const LABELS = {
  idle: ['Offline', 'bg-muted'],
  connecting: ['Connecting…', 'bg-amber-500'],
  online: ['Connected', 'bg-success'],
  reconnecting: ['Reconnecting…', 'bg-amber-500'],
  failed: ['Connection blocked', 'bg-danger'],
};

// sidebar footer mein chhota connection status
export default function ConnectionDot() {
  const status = useSocketStatus();
  const [label, color] = LABELS[status] ?? LABELS.idle;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted">
      <span className={`size-1.5 rounded-full ${color}`} aria-hidden />
      {label}
    </p>
  );
}
