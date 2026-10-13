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

export default function SignupPage() {
  return (
    <RedirectIfAuthed>
      <SignupForm />
    </RedirectIfAuthed>
  );
}

// server jaisi hi rules; server phir bhi dobara check karta hai
function validate({ username, email, password }) {
  const errs = {};
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) errs.username = 'Username must be 3-20 chars: letters, numbers, _';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter a valid email';
  if (password.length < 8) errs.password = 'Password must be at least 8 characters';
  return errs;
}

function SignupForm() {
  const { signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const local = validate(form);
    setFields(local);
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      await signup(form.username, form.email, form.password);
      router.replace('/chat');
    } catch (err) {
      if (err.fields) setFields(err.fields);
      else if (err.field) setFields({ [err.field]: err.message });
      else setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Pick a username and start chatting."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          label="Username"
          autoComplete="username"
          autoFocus
          value={form.username}
          onChange={set('username')}
          error={fields.username}
          hint="Letters, numbers and _ (3-20 chars)"
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          error={fields.email}
        />
        <Input
          label="Password"
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={fields.password}
          hint="At least 8 characters"
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
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
