'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { socket } from './socket';
import { useOnReconnect, useSocketEvent } from '@/components/SocketProvider';

// ObjectId hex strings (24 chars) lexicographic order = creation order, to cursor compare seedha
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function appendUnique(list, message) {
  return list.some((m) => m.id === message.id) ? list : [...list, message].sort(byId);
}

// Reconnect ke baad latest page ko purani list ke saath jodna. Edits/deletes/reactions bhi
// taaza ho jate hain. Agar beech mein gap hai (50 se zyada miss) to purani list hata dete hain.
function mergeLatest(prev, fresh, freshHasMore) {
  const lastPrev = prev[prev.length - 1]?.id;
  const firstFresh = fresh[0]?.id;
  if (!lastPrev || !firstFresh) return { messages: fresh, hasMore: freshHasMore };
  if (firstFresh <= lastPrev) {
    const older = prev.filter((m) => m.id < firstFresh);
    return { messages: [...older, ...fresh], hasMore: null }; // hasMore pehle jaisa
  }
  return { messages: fresh, hasMore: true };
}

// Ek conversation ke messages. Component ko `key={id}` ke saath render karo, taaki id badalne par
// state apne aap reset ho.
export function useMessages(conversationId) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  });

  useEffect(() => {
    let cancelled = false;
    api(`/conversations/${conversationId}/messages`)
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setHasMore(data.hasMore);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useSocketEvent('message.new', ({ message }) => {
    if (message.conversation === conversationId) setMessages((prev) => appendUnique(prev, message));
  });

  useSocketEvent('message.updated', ({ message }) => {
    if (message.conversation !== conversationId) return;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
  });

  useOnReconnect(async () => {
    try {
      const data = await api(`/conversations/${conversationId}/messages`);
      const merged = mergeLatest(messagesRef.current, data.messages, data.hasMore);
      setMessages(merged.messages);
      if (merged.hasMore !== null) setHasMore(merged.hasMore);
    } catch {
      // agli reconnect/refresh pe theek ho jayega
    }
  });

  const loadOlder = useCallback(async () => {
    const first = messagesRef.current[0];
    if (!first || loadingOlderRef.current) return null;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const data = await api(`/conversations/${conversationId}/messages?before=${first.id}`);
      setMessages((prev) => [...data.messages.filter((m) => !prev.some((p) => p.id === m.id)), ...prev]);
      setHasMore(data.hasMore);
      return data.messages.length;
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [conversationId]);

  // socket.send false deta hai agar connection online nahi
  const send = useCallback((text) => socket.send({ type: 'message.send', conversationId, text }), [conversationId]);
  const edit = useCallback((messageId, text) => socket.send({ type: 'message.edit', messageId, text }), []);
  const remove = useCallback((messageId) => socket.send({ type: 'message.delete', messageId }), []);
  const react = useCallback((messageId, emoji) => socket.send({ type: 'reaction.toggle', messageId, emoji }), []);

  return { status, error, messages, hasMore, loadingOlder, loadOlder, send, edit, remove, react };
}
