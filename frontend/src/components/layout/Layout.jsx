import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import ToastHost from '../Toast.jsx';

const CLOSED_KEY = 'th_sidebar_closed';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [closed, setClosed] = useState(() => localStorage.getItem(CLOSED_KEY) === '1');
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open-mobile', mobileOpen);
    return () => document.body.classList.remove('sidebar-open-mobile');
  }, [mobileOpen]);

  const toggleMobile = useCallback(() => setMobileOpen((open) => !open), []);
  const toggleDesktop = useCallback(() => {
    setClosed((prev) => {
      localStorage.setItem(CLOSED_KEY, prev ? '0' : '1');
      return !prev;
    });
  }, []);

  return (
    <div className={`app-shell${closed ? ' sidebar-closed' : ''}`}>
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="icon-btn burger"
            aria-label="Toggle navigation"
            onClick={() => {
              if (window.innerWidth <= 991) toggleMobile();
              else toggleDesktop();
            }}
          >
            <Menu size={20} />
          </button>
          <Link to="/" className="brand">
            <img src="/logo.png" alt="Technocrats Horizons" className="brand-logo" />
          </Link>
        </div>
        <Topbar />
      </header>

      <div className="app-body">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} role="presentation">
          <X size={18} className="backdrop-close" aria-hidden="true" />
        </div>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <ToastHost />
    </div>
  );
}
