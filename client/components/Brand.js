import { MessageCircle } from 'lucide-react';

export default function Brand({ size = 'md' }) {
  const box = size === 'lg' ? 'size-12 rounded-2xl' : 'size-8 rounded-lg';
  const icon = size === 'lg' ? 'size-6' : 'size-4';
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex items-center justify-center bg-primary text-primary-foreground ${box}`}>
        <MessageCircle className={icon} aria-hidden />
      </div>
      <span className={`font-semibold tracking-tight ${size === 'lg' ? 'text-2xl' : 'text-base'}`}>Pulse Chat</span>
    </div>
  );
}
