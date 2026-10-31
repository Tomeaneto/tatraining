import { NavLink } from 'react-router-dom';
import { Activity, CalendarRange, LayoutDashboard, Link2, PersonStanding, Utensils, type LucideIcon } from 'lucide-react';

type Item = { to: string; label: string; icon: LucideIcon };

const items: Item[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard },
  { to: '/plano', label: 'Plano', icon: CalendarRange },
  { to: '/treinos', label: 'Treinos', icon: Activity },
  { to: '/composicao', label: 'Corpo', icon: PersonStanding },
  { to: '/dieta', label: 'Dieta', icon: Utensils },
  { to: '/conectar', label: 'Conectar', icon: Link2 },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ta-border bg-ta-bg/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-6">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  isActive ? 'text-ta-gold' : 'text-ta-muted hover:text-ta-text'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
