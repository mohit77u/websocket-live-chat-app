'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/lib/chat';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const NAME_RE = /^[a-z0-9_-]{3,30}$/;

export default function NewRoomModal({ open, onClose }) {
  // Modal band hone par NewRoomForm unmount hota hai, to form state apne aap reset
  return (
    <Modal open={open} onClose={onClose} title="Create a room">
      <NewRoomForm onClose={onClose} />
    </Modal>
  );
}

function NewRoomForm({ onClose }) {
  const { createRoom, setSidebarOpen } = useChat();
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const clean = name.trim().toLowerCase();
    if (!NAME_RE.test(clean)) return setError('3-30 chars: lowercase letters, numbers, - or _');
    setBusy(true);
    setError('');
    try {
      const conv = await createRoom(clean);
      onClose();
      setSidebarOpen(false);
      router.push(`/chat/${conv.id}`);
    } catch (err) {
      setError(err.fields?.name || err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Input
        label="Room name"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. project-alpha"
        error={error}
        hint="Public: everyone can see and join"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Create
        </Button>
      </div>
    </form>
  );
}
