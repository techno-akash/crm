import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, UserRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './ProfileMenu.css';
export default function ProfileMenu({ compact = false }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [languageOpen, setLanguageOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const profile = useRef(null);
  const menuId = useId();
  const navigate = useNavigate();
  const name = user?.profile?.name || (user?.email ? user.email.split('@')[0].split(/[._-]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : 'Guest');
  function close(focus = false) {
    setOpen(false); setLanguageOpen(false);
    if (focus) trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    function outside(event) { if (!root.current?.contains(event.target)) close(); }
    function escape(event) { if (event.key === 'Escape') { close(true); } }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => { if (open) menu.current?.querySelector('[role="menuitem"]')?.focus(); }, [open]);
  function navigateMenu(event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...menu.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    const current = items.indexOf(document.activeElement);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    event.preventDefault(); items[index]?.focus();
  }
  async function signOut() {
    setBusy(true); setError('');
    const destination = user?.type === 'staff' ? '/admin/authentication' : '/authentication/login';
    try { await logout(); close(); navigate(destination, { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className={`profile-menu${compact ? ' profile-menu--compact' : ''}`} ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <button ref={trigger} type="button" className={compact ? 'profile-menu-trigger profile-menu-avatar' : 'profile-menu-trigger user-card'} aria-label={compact ? 'Open account menu' : 'Open profile menu'} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => { setOpen(!open); setError(''); }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}>
      {compact ? <UserRound size={19} aria-hidden="true" /> : <><img src="/user-placeholder.jpg" alt="" className="user-avatar" /><span className="user-meta"><span className="user-name">{name}</span><span className="user-email" title={user?.email}>{user?.email || 'Not signed in'}</span></span></>}
    </button>
    {open && <div className="profile-menu-panel">
      <div role="menu" id={menuId} aria-label="Profile" ref={menu} onKeyDown={navigateMenu}>
        {user ? <>
          <button type="button" role="menuitem" onClick={() => { close(); profile.current.showModal(); }}>My Profile</button>
          <button type="button" role="menuitem" aria-expanded={languageOpen} onClick={() => setLanguageOpen(!languageOpen)}>Language<ChevronRight size={13} aria-hidden="true" /></button>
          {languageOpen && <div className="profile-menu-language"><span lang="en">English ✓</span></div>}
          <button type="button" role="menuitem" aria-disabled={busy} onClick={busy ? undefined : signOut}>{busy ? 'Logging out…' : 'Logout'}</button>
        </> : <>
          <Link role="menuitem" to="/admin/authentication" onClick={() => close()}>Admin / Staff Login</Link>
          <Link role="menuitem" to="/authentication/login" onClick={() => close()}>Customer Login</Link>
        </>}
      </div>
      {error && <p role="alert" className="profile-menu-error">{error}</p>}
    </div>}
    {user && <dialog ref={profile} aria-labelledby={`${menuId}-profile-title`} className="profile-menu-dialog" onClose={() => trigger.current?.focus()}>
      <button type="button" className="profile-dialog-close" aria-label="Close profile" onClick={() => profile.current.close()}><X size={20} /></button>
      <h2 id={`${menuId}-profile-title`}>My Profile</h2><dl><dt>Name</dt><dd>{name}</dd><dt>Email</dt><dd>{user.email}</dd><dt>Account</dt><dd>{user.type === 'staff' ? 'Staff' : 'Customer'}</dd>{user.role && <><dt>Role</dt><dd>{user.role}</dd></>}{user.profile?.company && <><dt>Company</dt><dd>{user.profile.company}</dd></>}{user.profile?.phone && <><dt>Phone</dt><dd>{user.profile.phone}</dd></>}</dl>
    </dialog>}
  </div>;
}
