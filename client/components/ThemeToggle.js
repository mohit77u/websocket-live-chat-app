'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import Button from '@/components/ui/Button';

const noopSubscribe = () => () => {};

export default function ThemeToggle({ className = '' }) {
  const { resolvedTheme, setTheme } = useTheme();
  // server pe theme pata nahi hoti; mount ke baad hi icon dikhao (hydration mismatch se bachne ke liye)
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
    >
      {mounted ? isDark ? <Sun className="size-4" /> : <Moon className="size-4" /> : <span className="size-4" />}
    </Button>
  );
}
