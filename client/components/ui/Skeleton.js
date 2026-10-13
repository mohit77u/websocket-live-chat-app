export default function Skeleton({ className = '' }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}
