import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, LayoutDashboard, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ProfileMenu from '../../components/ProfileMenu.jsx';
import ToastHost from '../../components/Toast.jsx';
import './account.css';
export default function AccountLayout({ children }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="account-shell">
    <header className="account-header"><button type="button" className="account-menu-toggle" aria-label="Toggle navigation" aria-controls="account-sidebar" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><Menu size={20} /></button><Link to={user.type === 'staff' ? '/admin/' : '/portal'}><img src="/logo.png" alt="Technocrats Horizons" /></Link><div className="account-header-profile"><ProfileMenu compact /></div></header>
    <div className="account-body">
      {mobileOpen && <button type="button" className="account-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside id="account-sidebar" className={`account-sidebar${mobileOpen ? ' account-sidebar--open' : ''}`} aria-label="Account navigation"><ProfileMenu /><nav><Link to={user.type === 'staff' ? '/admin/' : '/portal'} onClick={() => setMobileOpen(false)}><LayoutDashboard size={17} aria-hidden="true" />{user.type === 'staff' ? 'Dashboard' : 'Customer Portal'}</Link>{user.type === 'staff' && <Link to="/admin/licenses"><KeyRound size={17} aria-hidden="true" />Client License</Link>}</nav></aside>
      <main className="account-content">{children}</main>
    </div><ToastHost />
  </div>;
}
