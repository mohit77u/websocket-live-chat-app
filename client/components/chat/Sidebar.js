'use client';

import { useState } from 'react';
import { AlertCircle, LogOut, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useChat } from '@/lib/chat';
import Brand from '@/components/Brand';
import ThemeToggle from '@/components/ThemeToggle';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import ConversationItem from './ConversationItem';
import NewRoomModal from './NewRoomModal';
import UserSearch from './UserSearch';
import ConnectionDot from './ConnectionDot';

function SectionHeader({ title, action }) {
  return (
    <div className="mb-1 mt-4 flex items-center justify-between px-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {action}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1 px-1" role="status" aria-label="Loading conversations">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-1.5 py-2">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { conversations, rooms, dms, loadError, refresh, onlineIds, activeId } = useChat();
  const [roomModal, setRoomModal] = useState(false);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <Brand />
        <ThemeToggle />
      </div>

      <div className="px-3 pt-1">
        <UserSearch />
      </div>

      <nav aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {conversations === null && !loadError && <ListSkeleton />}

        {loadError && (
          <div className="m-2 flex flex-col items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
            <span className="flex items-center gap-2">
              <AlertCircle className="size-4" aria-hidden /> {loadError}
            </span>
            <Button size="sm" variant="outline" onClick={refresh}>
              Retry
            </Button>
          </div>
        )}

        {conversations !== null && (
          <>
            <SectionHeader
              title="Rooms"
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => setRoomModal(true)}
                  aria-label="Create room"
                  title="Create room"
                >
                  <Plus className="size-4" />
                </Button>
              }
            />
            <div className="space-y-0.5">
              {rooms.map((c) => (
                <ConversationItem key={c.id} conv={c} active={c.id === activeId} myId={user.id} />
              ))}
            </div>

            <SectionHeader title="Direct messages" />
            <div className="space-y-0.5">
              {dms.length === 0 ? (
                <p className="px-2.5 py-2 text-sm text-muted">No direct messages yet. Search for someone above to say hi.</p>
              ) : (
                dms.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conv={c}
                    active={c.id === activeId}
                    myId={user.id}
                    online={onlineIds.has(c.otherUser?.id)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </nav>

      <div className="flex items-center gap-3 border-t border-border p-3">
        <Avatar name={user.username} online />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.username}</p>
          <ConnectionDot />
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out" title="Log out">
          <LogOut className="size-4" />
        </Button>
      </div>

      <NewRoomModal open={roomModal} onClose={() => setRoomModal(false)} />
    </div>
  );
}
