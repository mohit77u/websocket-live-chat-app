import Brand from '@/components/Brand';
import ThemeToggle from '@/components/ThemeToggle';

// Login/Signup ka common layout: centered card + theme toggle
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <main className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand size="lg" />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </main>
    </div>
  );
}
