'use client';

import { useEffect, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { socket } from '@/lib/socket';
import { useSocketStatus } from '@/components/SocketProvider';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';

const MAX = 1000;
const TYPING_THROTTLE_MS = 2000;

export default function Composer({ conversationId, onSend, placeholder }) {
  const [text, setText] = useState('');
  const ref = useRef(null);
  const lastTyping = useRef(0);
  const status = useSocketStatus();
  const toast = useToast();
  const online = status === 'online';
  const trimmed = text.trim();

  // textarea content ke hisaab se badhe (max ~6 lines)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [text]);

  function submit() {
    if (!trimmed) return;
    if (!onSend(trimmed)) return toast.error('Not connected. Your message was not sent.'); // draft bacha rehta hai
    setText('');
    lastTyping.current = 0;
  }

  function onChange(e) {
    setText(e.target.value);
    const now = Date.now();
    // har key pe nahi, 2s mein ek baar "typing" bhejo
    if (e.target.value && now - lastTyping.current > TYPING_THROTTLE_MS) {
      lastTyping.current = now;
      socket.send({ type: 'typing', conversationId });
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-border bg-surface p-3 md:px-5"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
        <textarea
          ref={ref}
          value={text}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={MAX}
          placeholder={online ? placeholder : 'Waiting for connection…'}
          aria-label="Message"
          className="max-h-36 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted"
        />
        <Button
          type="submit"
          size="icon"
          className="mb-0.5 size-8 shrink-0 rounded-full"
          disabled={!trimmed || !online}
          aria-label="Send message"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
      <div className="mt-1 flex justify-between px-2 text-[11px] text-muted">
        <span>Enter to send · Shift+Enter for a new line</span>
        {text.length > MAX * 0.8 && (
          <span className={text.length >= MAX ? 'text-danger' : ''}>
            {text.length}/{MAX}
          </span>
        )}
      </div>
    </form>
  );
}
