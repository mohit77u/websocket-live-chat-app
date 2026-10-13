'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useChat } from '@/lib/chat';
import { useToast } from '@/components/ui/Toast';
import Avatar from '@/components/ui/Avatar';

// username search -> click par DM shuru
export default function UserSearch() {
  const { startDm, onlineIds, setSidebarOpen } = useChat();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null); // null = search nahi hui
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      seq.current++; // pending response ignore ho
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { users } = await api(`/users?q=${encodeURIComponent(term)}`);
        if (mine === seq.current) setResults(users);
      } catch (err) {
        if (mine === seq.current) toast.error(err.message);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 250); // typing ke dauran har key pe request nahi
    return () => clearTimeout(t);
  }, [q, toast]);

  async function open(username) {
    try {
      const conv = await startDm(username);
      setQ('');
      setResults(null);
      setSidebarOpen(false);
      router.push(`/chat/${conv.id}`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  const showPanel = q.trim() && results !== null;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (!e.target.value.trim()) setResults(null);
        }}
        placeholder="Find people to message"
        aria-label="Find people to message"
        className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-primary"
      />
      {showPanel && (
        <ul
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
          aria-busy={loading}
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">No users found</li>
          ) : (
            results.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => open(u.username)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                >
                  <Avatar name={u.username} size="sm" online={onlineIds.has(u.id)} />
                  <span className="truncate">{u.username}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
