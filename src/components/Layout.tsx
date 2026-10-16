import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function Layout() {
  return (
    <div className="min-h-dvh pt-safe">
      <main className="pb-nav mx-auto w-full max-w-3xl px-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
