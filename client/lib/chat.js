'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from './api';
import { useAuth } from './auth';
import { useOnReconnect, useSocketEvent } from '@/components/SocketProvider';

const ChatContext = createContext(null);

const byRecent = (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt);

// Sidebar ka saara shared state: conversations, unread, presence, mobile drawer.
// (Ek conversation ke messages ChatView khud sambhalta hai.)
export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { id: activeId = null } = useParams();
  const [conversations, setConversations] = useState(null); // null = abhi load ho raha
  const [loadError, setLoadError] = useState('');
  const [online, setOnline] = useState(() => new Map()); // userId -> username
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // event handlers ko hamesha taaza values chahiye bina re-subscribe kiye
  const convsRef = useRef(null);
  const activeRef = useRef(activeId);
  const readTimer = useRef(null);
  useEffect(() => {
    convsRef.current = conversations;
    activeRef.current = activeId;
  });

  const refresh = useCallback(async () => {
    try {
      const { conversations: list } = await api('/conversations');
      setConversations(list.sort(byRecent));
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // reconnect ke baad unread/lastMessage purane ho sakte hain
  useOnReconnect(refresh);

  const markRead = useCallback((id) => {
    setConversations((prev) => prev && prev.map((c) => (c.id === id && c.unreadCount ? { ...c, unreadCount: 0 } : c)));
    api(`/conversations/${id}/read`, { method: 'POST' }).catch(() => {});
  }, []);

  // conversation kholte hi read mark
  useEffect(() => {
    if (activeId && conversations?.some((c) => c.id === activeId && c.unreadCount > 0)) markRead(activeId);
  }, [activeId, conversations, markRead]);

  useSocketEvent('message.new', ({ message }) => {
    const known = convsRef.current?.some((c) => c.id === message.conversation);
    if (convsRef.current && !known) return void refresh(); // kisi ne naya DM shuru kiya hoga

    const mine = message.sender.id === user.id;
    const isActive = activeRef.current === message.conversation;
    setConversations((prev) =>
      prev
        ?.map((c) =>
          c.id === message.conversation
            ? {
                ...c,
                lastMessage: message,
                lastMessageAt: message.createdAt,
                unreadCount: mine || isActive ? c.unreadCount : c.unreadCount + 1,
              }
            : c
        )
        .sort(byRecent)
    );
    if (isActive && !mine) {
      clearTimeout(readTimer.current);
      readTimer.current = setTimeout(() => markRead(message.conversation), 400);
    }
  });

  // edit/delete hone par sidebar preview bhi badle
  useSocketEvent('message.updated', ({ message }) => {
    setConversations((prev) =>
      prev?.map((c) => (c.lastMessage?.id === message.id ? { ...c, lastMessage: message } : c))
    );
  });

  useSocketEvent('conversation.new', ({ conversation }) => {
    setConversations((prev) => (prev && !prev.some((c) => c.id === conversation.id) ? [...prev, conversation].sort(byRecent) : prev));
  });

  useSocketEvent('presence.snapshot', ({ users }) => setOnline(new Map(users.map((u) => [u.id, u.username]))));
  useSocketEvent('presence', ({ userId, username, online: isOnline }) => {
    setOnline((prev) => {
      const next = new Map(prev);
      if (isOnline) next.set(userId, username);
      else next.delete(userId);
      return next;
    });
  });

  const onlineIds = useMemo(() => new Set(online.keys()), [online]);
  const onlineUsers = useMemo(
    () => [...online].map(([id, username]) => ({ id, username })).sort((a, b) => a.username.localeCompare(b.username)),
    [online]
  );

  const addConversation = useCallback((conv) => {
    setConversations((prev) => (prev && !prev.some((c) => c.id === conv.id) ? [...prev, conv].sort(byRecent) : prev));
  }, []);

  const createRoom = useCallback(
    async (name) => {
      const { conversation } = await api('/rooms', { method: 'POST', body: { name } });
      addConversation(conversation);
      return conversation;
    },
    [addConversation]
  );

  const startDm = useCallback(
    async (username) => {
      const { conversation } = await api('/dms', { method: 'POST', body: { username } });
      addConversation(conversation);
      return conversation;
    },
    [addConversation]
  );

  const value = useMemo(
    () => ({
      conversations,
      rooms: conversations?.filter((c) => c.type === 'room') ?? [],
      dms: conversations?.filter((c) => c.type === 'dm') ?? [],
      loadError,
      onlineIds,
      onlineUsers,
      activeId,
      sidebarOpen,
      setSidebarOpen,
      refresh,
      markRead,
      createRoom,
      startDm,
    }),
    [conversations, loadError, onlineIds, onlineUsers, activeId, sidebarOpen, refresh, markRead, createRoom, startDm]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}
