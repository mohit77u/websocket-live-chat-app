import { MessagesSquare } from 'lucide-react';

// Desktop pe jab koi conversation select nahi hai
export default function EmptyChat() {
  return (
    <div className="hidden h-full flex-col items-center justify-center gap-3 px-6 text-center md:flex">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-surface-2 text-muted">
        <MessagesSquare className="size-8" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold">Welcome to Pulse Chat</h1>
      <p className="max-w-xs text-sm text-muted">
        Pick a room from the sidebar, or search for someone to start a direct message.
      </p>
    </div>
  );
}
