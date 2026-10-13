'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Hash, Lock, Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useChat } from '@/lib/chat';
import { useMessages } from '@/lib/useMessages';
import { useSocketEvent } from '@/components/SocketProvider';
import { useToast } from '@/components/ui/Toast';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Composer from './Composer';
import MessageList from './MessageList';
import OnlinePopover from './OnlinePopover';
import TypingIndicator from './TypingIndicator';

export default function ChatView() {
  const { id } = useParams();
  const { conversations } = useChat();
  const conv = conversations?.find((c) => c.id === id);

  if (conversations && !conv) {
    return (
      <Message
        title="Conversation not found"
        text="It may not exist, or you don't have access to it."
      />
    );
  }

  return (
    <section className="flex h-full flex-col bg-background" aria-label="Conversation">
      <Header conv={conv} />
      {/* key: conversation badalte hi messages ka state naya */}
      <Conversation key={id} id={id} conv={conv} />
    </section>
  );
}

function Message({ title, text }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Lock className="size-8 text-muted" aria-hidden />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted">{text}</p>
      <Link href="/chat" className="text-sm font-medium text-primary hover:underline">
        Back to chats
      </Link>
    </div>
  );
}

function Header({ conv }) {
  const { setSidebarOpen, onlineIds } = useChat();
  const isDm = conv?.type === 'dm';
  const title = conv ? (isDm ? conv.otherUser?.username : conv.name) : '';
  const otherOnline = isDm && onlineIds.has(conv.otherUser?.id);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 md:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open conversations"
      >
        <Menu className="size-5" />
      </Button>
      {conv &&
        (isDm ? (
          <Avatar name={title} size="sm" online={otherOnline} />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-muted">
            <Hash className="size-4" aria-hidden />
          </span>
        ))}
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
        {isDm && <p className="text-xs text-muted">{otherOnline ? 'Online' : 'Offline'}</p>}
        {conv && !isDm && <p className="text-xs text-muted">Public room</p>}
      </div>
      {conv && !isDm && <OnlinePopover />}
    </header>
  );
}

function Conversation({ id, conv }) {
  const { user } = useAuth();
  const toast = useToast();
  const m = useMessages(id);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // server ne kisi action ko reject kiya (jaise doosre ka message edit karna)
  useSocketEvent('error', (e) => toast.error(e.message || 'Something went wrong'));

  if (m.status === 'error') {
    return (
      <Message
        title={m.error?.status === 403 ? 'No access' : 'Could not load messages'}
        text={m.error?.status === 403 ? "This conversation is private and you're not a member." : m.error?.message}
      />
    );
  }

  const offlineToast = (ok) => ok || toast.error('Not connected. Try again in a moment.');

  return (
    <>
      <MessageList
        status={m.status}
        messages={m.messages}
        myId={user.id}
        hasMore={m.hasMore}
        loadingOlder={m.loadingOlder}
        onLoadOlder={m.loadOlder}
        onReact={(msg, emoji) => offlineToast(m.react(msg.id, emoji))}
        onEdit={(msg, text) => offlineToast(m.edit(msg.id, text))}
        onDelete={setDeleteTarget}
      />
      <TypingIndicator conversationId={id} />
      <Composer
        conversationId={id}
        onSend={m.send}
        placeholder={conv ? (conv.type === 'dm' ? `Message ${conv.otherUser?.username}` : `Message #${conv.name}`) : 'Message'}
      />

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete message?">
        <p className="mb-4 text-sm text-muted">
          This removes the message for everyone in this conversation. This can&apos;t be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              offlineToast(m.remove(deleteTarget.id));
              setDeleteTarget(null);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
