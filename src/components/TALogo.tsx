import { useId } from 'react';
import logo from '../brand/logo.json';

type Props = {
  size?: number;
  className?: string;
  title?: string;
};

/** Monograma TA — letras em prata com sublinhado dourado. */
export function TALogo({ size = 40, className, title = 'TA Triathlon' }: Props) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox={logo.viewBox}
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={logo.silverFrom} />
          <stop offset="100%" stopColor={logo.silverTo} />
        </linearGradient>
      </defs>
      <path d={logo.t} fill={`url(#${gradientId})`} />
      <path d={logo.a} fill={`url(#${gradientId})`} fillRule="evenodd" />
      <rect {...logo.underline} fill={logo.gold} />
    </svg>
  );
}
