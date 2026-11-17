import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SubmitButton } from './AuthForm';
import LoginFrame from './LoginFrame';
export default function LoginForm({ type }) {
  const staff = type === 'staff';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [rememberMe, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const forgotLink = <Link className="crm-forgot-link" to={`/forgot-password?type=${type}`}>Forgot Password?</Link>;
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await login(type, { email: email.trim(), password, rememberMe });
      setPassword('');
      navigate(result.twoFactorRequired ? '/verify-2fa' : staff ? '/admin/' : '/portal', { replace: true });
    } catch (err) { setError(err.status === 401 ? 'Invalid email or password' : err.message); }
    finally { setBusy(false); }
  }
  const VisibilityIcon = visible ? EyeOff : Eye;
  return <LoginFrame staff={staff}>
    <form className="crm-login-form" onSubmit={submit} aria-busy={busy}>
      {!staff && <div className="crm-login-field"><label htmlFor="language">Language</label><select id="language" name="language" defaultValue="en"><option value="en">English</option></select></div>}
      <div className="crm-login-field crm-email-field"><label htmlFor="email">Email Address</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></div>
      <div className="crm-login-field"><div className="crm-password-heading"><label htmlFor="password">Password</label>{staff && forgotLink}</div>
        <div className="crm-login-password"><input id="password" name="password" type={visible ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" maxLength={72} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}><VisibilityIcon size={16} aria-hidden="true" /></button></div>
      </div>
      <label className="crm-remember"><input type="checkbox" checked={rememberMe} onChange={e => setRemember(e.target.checked)} />Remember me</label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <SubmitButton busy={busy}>Login</SubmitButton>
      {!staff && <div className="crm-customer-forgot">{forgotLink}</div>}
    </form>
  </LoginFrame>;
}
