import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthFrame, SubmitButton } from './AuthForm';
export default function Verify2FAPage() {
  const { challenge, verify } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!challenge) return <Navigate to="/admin/authentication" replace />;
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await verify(code); navigate('/admin/', { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <AuthFrame title="Verify your sign in" description="Enter the six-digit code from your email or authenticator. This sign-in challenge lasts five minutes.">
    <form className="auth-form" onSubmit={submit}><label htmlFor="code">Verification code<input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
      {error && <div role="alert" className="auth-error">{error}</div>}<SubmitButton busy={busy}>Verify</SubmitButton></form>
    <div className="auth-links"><Link to="/admin/authentication">Start again</Link></div>
  </AuthFrame>;
}
