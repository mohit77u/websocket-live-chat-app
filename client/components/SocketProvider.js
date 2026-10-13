'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { socket } from '@/lib/socket';
import { useAuth } from '@/lib/auth';

let pendingDisconnect = null;

// Login hone par socket connect, logout par disconnect. UI sirf hooks use karta hai.
export default function SocketProvider({ children }) {
  const { token, logout } = useAuth();

  useEffect(() => {
    if (!token) {
      socket.disconnect();
      return;
    }
    clearTimeout(pendingDisconnect);
    socket.connect(token); // same token pe no-op, to Strict Mode ka double-effect connection nahi todta
    return () => {
      // turant disconnect nahi: Strict Mode ka re-run isse cancel kar dega
      pendingDisconnect = setTimeout(() => socket.disconnect(), 50);
    };
  }, [token]);

  // server ne token reject kiya (expired/invalid) -> logout
  useEffect(() => socket.on('auth.failed', logout), [logout]);

  return children;
}

export function useSocketStatus() {
  return useSyncExternalStore(socket.subscribeStatus, socket.getStatus, () => 'idle');
}

export function useSocketFailReason() {
  return socket.failReason;
}

// Component ke andar server event sunna; handler hamesha latest rehta hai, unsubscribe auto
export function useSocketEvent(type, handler) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => socket.on(type, (data) => ref.current(data)), [type]);
}

export function useOnReconnect(handler) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => socket.onReconnect(() => ref.current()), []);
}
