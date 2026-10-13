'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setApiToken, setUnauthorizedHandler } from './api';
import { readStorage, writeStorage } from './storage';

const TOKEN_KEY = 'chat.token';
const AuthContext = createContext(null);

// status: loading (token check ho raha) | anon | authed | error (server unreachable, session safe hai)
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, token: null });

  const clear = useCallback(() => {
    setApiToken(null);
    writeStorage(TOKEN_KEY, null);
    setState({ status: 'anon', user: null, token: null });
  }, []);

  const restore = useCallback(async () => {
    const token = readStorage(TOKEN_KEY);
    if (!token) return setState({ status: 'anon', user: null, token: null });
    setApiToken(token);
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const { user } = await api('/me');
      setState({ status: 'authed', user, token });
    } catch (err) {
      // 401 pe api.js khud clear() chala deta hai. Network error pe session mat todo.
      if (err.status !== 401) setState({ status: 'error', user: null, token });
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    restore();
    // doosre tab mein logout/login ho to yahan bhi sync
    const onStorage = (e) => {
      if (e.key !== TOKEN_KEY) return;
      if (!e.newValue) clear();
      else restore();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [clear, restore]);

  const authenticate = useCallback(async (path, body) => {
    const { token, user } = await api(path, { method: 'POST', body, auth: false });
    setApiToken(token);
    writeStorage(TOKEN_KEY, token);
    setState({ status: 'authed', user, token });
    return user;
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login: (email, password) => authenticate('/auth/login', { email, password }),
      signup: (username, email, password) => authenticate('/auth/signup', { username, email, password }),
      logout: clear,
      retry: restore,
    }),
    [state, authenticate, clear, restore]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
