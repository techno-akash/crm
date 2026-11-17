import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../../services/authApi';
import { AuthFrame, SubmitButton } from './AuthForm';
export default function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const [type, setType] = useState(params.get('type') === 'staff' ? 'staff' : 'customer');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await authApi.forgot({ type, email: email.trim() }); setSent(true); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <AuthFrame title="Forgot password" description="Request a link to reset your password.">
    {sent ? <p role="status">If the email exists, a reset link has been sent</p> : <form className="auth-form" onSubmit={submit}>
      <label htmlFor="type">Account type<select id="type" value={type} onChange={e => setType(e.target.value)}><option value="customer">Customer</option><option value="staff">Staff</option></select></label>
      <label htmlFor="email">Email<input id="email" type="email" required autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}<SubmitButton busy={busy}>Send reset link</SubmitButton></form>}
    <div className="auth-links"><Link to={type === 'staff' ? '/admin/authentication' : '/authentication/login'}>Back to sign in</Link></div>
  </AuthFrame>;
}
