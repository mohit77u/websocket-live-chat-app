import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  outline: 'border border-border bg-surface hover:bg-surface-2',
  ghost: 'hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90',
};

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  icon: 'size-9',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}) {
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
