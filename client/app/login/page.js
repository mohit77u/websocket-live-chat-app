'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import AuthShell from '@/components/AuthShell';
import { RedirectIfAuthed } from '@/components/AuthGate';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function LoginPage() {
  return (
    <RedirectIfAuthed>
      <LoginForm />
    </RedirectIfAuthed>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setFields({});
    setBusy(true);
    try {
      await login(email, password);
      router.replace('/chat');
    } catch (err) {
      setFields(err.fields || {});
      setError(err.fields ? '' : err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue chatting."
      footer={
        <>
          New here?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fields.email}
        />
        <Input
          label="Password"
          type={showPw ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fields.password}
          right={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          }
        />
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
    </AuthShell>
  );
}
