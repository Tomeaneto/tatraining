import type { ReactNode } from 'react';
import { TALogo } from './TALogo';

type Props = {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <header className="flex items-center gap-3 pb-4 pt-4">
      <TALogo size={40} />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-3xl leading-none text-ta-text">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-sm text-ta-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
