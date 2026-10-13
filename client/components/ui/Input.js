import { useId } from 'react';

// label + input + inline error ek saath (accessible: label htmlFor, aria-invalid, aria-describedby)
export default function Input({ label, error, hint, className = '', right, ...props }) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className={`h-10 w-full rounded-lg border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 ${
            error ? 'border-danger' : 'border-border'
          } ${right ? 'pr-10' : ''}`}
          {...props}
        />
        {right && <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{right}</div>}
      </div>
      {(error || hint) && (
        <p id={msgId} className={`mt-1.5 text-xs ${error ? 'text-danger' : 'text-muted'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
