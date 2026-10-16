import type { HTMLAttributes } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'raised' | 'highlight';
};

const variants = {
  default: 'bg-ta-card border-ta-border',
  raised: 'bg-ta-card2 border-ta-border',
  highlight: 'bg-ta-card2 border-ta-gold/60 shadow-glow',
};

export function Card({ variant = 'default', className = '', ...rest }: Props) {
  return <div className={`rounded-card border p-4 ${variants[variant]} ${className}`} {...rest} />;
}

export function CardTitle({ className = '', ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`mb-2 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-ta-muted ${className}`}
      {...rest}
    />
  );
}
