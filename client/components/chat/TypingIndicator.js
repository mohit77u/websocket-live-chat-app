'use client';

import { useEffect, useState } from 'react';
import { useSocketEvent } from '@/components/SocketProvider';

const TYPING_TTL_MS = 3500; // is se zyada "typing" event na aaye to indicator hata do

function label(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}

export default function TypingIndicator({ conversationId }) {
  const [typing, setTyping] = useState({}); // userId -> {username, until}

  useSocketEvent('typing', (e) => {
    if (e.conversationId !== conversationId) return;
    setTyping((t) => ({ ...t, [e.userId]: { username: e.username, until: Date.now() + TYPING_TTL_MS } }));
  });

  // message aate hi us user ka typing hata do
  useSocketEvent('message.new', ({ message }) => {
    if (message.conversation !== conversationId) return;
    setTyping((t) => {
      if (!t[message.sender.id]) return t;
      const { [message.sender.id]: _gone, ...rest } = t;
      return rest;
    });
  });

  useEffect(() => {
    if (Object.keys(typing).length === 0) return;
    const timer = setInterval(() => {
      setTyping((t) => {
        const now = Date.now();
        const entries = Object.entries(t).filter(([, v]) => v.until > now);
        return entries.length === Object.keys(t).length ? t : Object.fromEntries(entries);
      });
    }, 500);
    return () => clearInterval(timer);
  }, [typing]);

  const names = Object.values(typing).map((v) => v.username);

  // height fixed rakhi hai taaki indicator aane-jaane se layout na hile
  return (
    <div className="h-5 px-5 text-xs text-muted" aria-live="polite">
      {names.length > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="flex gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </span>
          {label(names)}
        </span>
      )}
    </div>
  );
}
