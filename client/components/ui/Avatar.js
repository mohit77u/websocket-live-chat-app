import { hueFor, initials } from '@/lib/format';

const sizes = {
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-xs',
  lg: 'size-11 text-sm',
};

// online: true/false dot dikhata hai; undefined = koi dot nahi
export default function Avatar({ name, size = 'md', online }) {
  return (
    <span className="relative inline-flex shrink-0">
      <span
        aria-hidden
        className={`inline-flex select-none items-center justify-center rounded-full font-semibold text-white ${sizes[size]}`}
        style={{ background: `hsl(${hueFor(name)} 55% 42%)` }}
      >
        {initials(name)}
      </span>
      {online !== undefined && (
        <span
          title={online ? 'Online' : 'Offline'}
          className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface ${
            online ? 'bg-success' : 'bg-muted/50'
          }`}
        >
          <span className="sr-only">{online ? 'online' : 'offline'}</span>
        </span>
      )}
    </span>
  );
}
