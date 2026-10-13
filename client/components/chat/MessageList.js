'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, Loader2, MessageSquareText } from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';
import { dayKey, formatDayLabel } from '@/lib/format';
import MessageItem from './MessageItem';

const GROUP_GAP_MS = 5 * 60 * 1000; // 5 min se zyada gap pe naya group (naam + time dobara)
const NEAR_BOTTOM_PX = 80;

function MessagesSkeleton() {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-hidden p-4" role="status" aria-label="Loading messages">
      {[false, true, false, false, true].map((mine, i) => (
        <div key={i} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
          {!mine && <Skeleton className="size-7 rounded-full" />}
          <Skeleton className={`h-10 rounded-2xl ${mine ? 'w-40' : 'w-56'}`} />
        </div>
      ))}
    </div>
  );
}

export default function MessageList({ status, messages, myId, hasMore, loadingOlder, onLoadOlder, onReact, onEdit, onDelete }) {
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true); // user neeche hai to naye messages ke saath neeche hi rahe
  const lastIdRef = useRef(null);
  const olderSnapshot = useRef(null); // purane messages prepend karte waqt scroll position bachane ke liye
  const [newCount, setNewCount] = useState(0);

  const scrollToBottom = (smooth) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  function onScroll() {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (stickToBottom.current) setNewCount(0);
  }

  async function loadOlder() {
    const el = scrollRef.current;
    olderSnapshot.current = el.scrollHeight - el.scrollTop; // neeche se kitna door
    const added = await onLoadOlder();
    if (!added) olderSnapshot.current = null;
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (olderSnapshot.current !== null) {
      el.scrollTop = el.scrollHeight - olderSnapshot.current;
      olderSnapshot.current = null;
      return;
    }

    const last = messages[messages.length - 1];
    if (!last) return;
    const firstRender = lastIdRef.current === null;
    const isNewTail = last.id !== lastIdRef.current;
    lastIdRef.current = last.id;

    if (firstRender) {
      scrollToBottom(false);
    } else if (isNewTail) {
      if (stickToBottom.current || last.sender.id === myId) scrollToBottom(true);
      else setNewCount((n) => n + 1);
    }
  }, [messages, myId]);

  if (status === 'loading') return <MessagesSkeleton />;

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <MessageSquareText className="size-9 text-muted" aria-hidden />
        <p className="font-medium">No messages yet</p>
        <p className="text-sm text-muted">Be the first to say hello 👋</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-3 py-3 md:px-5" role="log" aria-live="polite" aria-label="Messages">
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium hover:bg-surface-2 disabled:opacity-60"
            >
              {loadingOlder && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          const showHeader =
            newDay || prev.sender.id !== m.sender.id || new Date(m.createdAt) - new Date(prev.createdAt) > GROUP_GAP_MS;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex items-center gap-3 text-[11px] font-medium text-muted" role="separator">
                  <span className="h-px flex-1 bg-border" />
                  {formatDayLabel(m.createdAt)}
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <MessageItem
                message={m}
                mine={m.sender.id === myId}
                myId={myId}
                showHeader={showHeader}
                onReact={onReact}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          );
        })}
      </div>

      {newCount > 0 && (
        <button
          type="button"
          onClick={() => {
            scrollToBottom(true);
            setNewCount(0);
          }}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg"
        >
          <ArrowDown className="size-3.5" aria-hidden />
          {newCount} new {newCount === 1 ? 'message' : 'messages'}
        </button>
      )}
    </div>
  );
}
