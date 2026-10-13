import Link from 'next/link';
import { Hash } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { formatListTime, previewOf } from '@/lib/format';

export default function ConversationItem({ conv, active, myId, online }) {
  const isDm = conv.type === 'dm';
  const title = isDm ? conv.otherUser?.username ?? 'Unknown user' : conv.name;
  const unread = conv.unreadCount > 0;

  return (
    <Link
      href={`/chat/${conv.id}`}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
        active ? 'bg-primary/12 ring-1 ring-primary/25' : 'hover:bg-surface-2'
      }`}
    >
      {isDm ? (
        <Avatar name={title} online={online} />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Hash className="size-4" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm ${unread ? 'font-semibold' : 'font-medium'}`}>{title}</span>
          {conv.lastMessage && (
            <span className="shrink-0 text-[11px] text-muted">{formatListTime(conv.lastMessage.createdAt)}</span>
          )}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate text-xs ${unread ? 'text-foreground' : 'text-muted'}`}>
            {previewOf(conv, myId)}
          </span>
          {unread && (
            <span
              className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
              aria-label={`${conv.unreadCount} unread`}
            >
              {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
