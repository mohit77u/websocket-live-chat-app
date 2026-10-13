'use client';

import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { useChat } from '@/lib/chat';
import Avatar from '@/components/ui/Avatar';

// Room header: "N online" button -> abhi online users ki list
export default function OnlinePopover() {
  const { onlineUsers } = useChat();
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
      >
        <span className="size-1.5 rounded-full bg-success" aria-hidden />
        <Users className="size-3.5 text-muted" aria-hidden />
        {onlineUsers.length} online
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
          <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Online now</p>
          <ul className="max-h-64 overflow-y-auto">
            {onlineUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm">
                <Avatar name={u.username} size="sm" online />
                <span className="truncate">{u.username}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
