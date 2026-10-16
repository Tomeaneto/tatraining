import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  block?: boolean;
};

const variants = {
  primary: 'bg-ta-gold text-ta-bg hover:bg-[#ffa543] active:bg-[#d97f1c]',
  secondary: 'border border-ta-border bg-ta-card2 text-ta-text hover:border-ta-gold/60',
  ghost: 'text-ta-gold hover:bg-ta-gold/10',
  danger: 'border border-red-500/50 text-red-400 hover:bg-red-500/10',
};

export function Button({ variant = 'primary', block, className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  );
}
