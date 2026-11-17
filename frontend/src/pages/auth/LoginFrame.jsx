import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { UserRound, X } from 'lucide-react';
import ToastHost from '../../components/Toast.jsx';
import './auth.css';
import './login.css';
export default function LoginFrame({ staff, children }) {
  const help = useRef(null);
  const logo = <img src="/logo.png" alt="Technocrats Horizons — Compusoft Pvt. Ltd." />;
  return <div className={`crm-login crm-login--${staff ? 'admin' : 'customer'}`}>
    {!staff && <header className="crm-login-header"><div className="crm-login-header-inner">
      <Link to="/authentication/login" className="crm-login-brand" aria-label="Technocrats Horizons login">{logo}</Link>
      <nav aria-label="Public navigation"><button type="button" className="crm-knowledge-link" onClick={() => help.current.showModal()}>Knowledge Base</button><Link className="crm-header-login" to="/authentication/login"><UserRound size={16} aria-hidden="true" />Login</Link></nav>
    </div></header>}
    <main className="crm-login-main">
      {staff && <div className="crm-admin-brand">{logo}</div>}
      <h1>{staff ? 'Login' : 'Please login'}</h1>
      {staff && <p className="crm-login-welcome">Welcome, please sign in to your dashboard</p>}
      <section className="crm-login-card" aria-label={staff ? 'Admin and staff login' : 'Customer login'}>{children}</section>
    </main>
    {!staff && <dialog ref={help} className="crm-login-help"><button type="button" className="crm-help-close" aria-label="Close knowledge base" onClick={() => help.current.close()}><X size={20} /></button><h2>Login help</h2><p>Use the email address and password provided by your administrator.</p><p>Forgot your password? <Link to="/forgot-password?type=customer" onClick={() => help.current.close()}>Request a reset link</Link>.</p><p>Company employees can use the <Link to="/admin/authentication" onClick={() => help.current.close()}>admin and staff login</Link>.</p></dialog>}
    <ToastHost />
  </div>;
}
