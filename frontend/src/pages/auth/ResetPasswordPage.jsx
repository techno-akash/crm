import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../services/authApi';
import { useAuth } from '../../context/AuthContext';
import { AuthFrame, PasswordField, SubmitButton, passwordError, passwordHint } from './AuthForm';
export default function ResetPasswordPage() {
  // Capture once in memory, then remove sensitive reset credentials from browser history.
  const [link] = useState(() => Object.fromEntries(new URLSearchParams(window.location.search)));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { clearSession } = useAuth();
  const navigate = useNavigate();
  const valid = ['staff', 'customer'].includes(link.type) && /^[a-f\d]{24}$/i.test(link.userId || '') && /^[a-f\d]{64}$/i.test(link.token || '');
  useEffect(() => { window.history.replaceState(window.history.state, '', window.location.pathname); }, []);
  async function submit(event) {
    event.preventDefault();
    const problem = passwordError(password) || (password !== confirm ? 'Passwords do not match' : '');
    if (problem) { setError(problem); return; }
    setError(''); setBusy(true);
    try {
      await authApi.reset({ type: link.type, userId: link.userId, token: link.token, password });
      clearSession(); navigate(link.type === 'staff' ? '/admin/authentication' : '/authentication/login', { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <AuthFrame title="Reset password" description="Choose a new password for your account.">
    {!valid ? <p role="alert">Invalid reset link. <Link to="/forgot-password">Request a new link</Link>.</p> : <form className="auth-form" onSubmit={submit}>
      <PasswordField value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" hint={passwordHint} />
      <PasswordField label="Confirm password" name="confirm-password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
      {error && <div className="auth-error" role="alert">{error}</div>}<SubmitButton busy={busy}>Reset password</SubmitButton></form>}
  </AuthFrame>;
}
