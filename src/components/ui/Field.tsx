import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const control =
  'min-h-[44px] w-full rounded-xl border border-ta-border bg-ta-card2 px-3 text-base text-ta-text placeholder:text-ta-muted/60 focus:border-ta-gold focus:outline-none';

type FieldProps = { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string };

/** Rótulo envolvendo o controle + dica/erro. */
export function Field({ label, hint, error, children, className = '' }: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ta-muted">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm text-red-400" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-sm text-ta-muted">{hint}</span>
      )}
    </label>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${control} tabular ${className}`} {...rest} />;
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${control} appearance-none ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${control} min-h-[88px] py-2 ${className}`} {...rest} />;
}
