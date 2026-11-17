import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/authApi';
import AccountLayout from './AccountLayout';
export default function AccountHomePage({ embedded = false }) {
  const { user, clearSession } = useAuth();
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    authApi.home(user.type).then(() => { if (active) setVerified(true); }).catch(err => {
      if (!active) return;
      if (err.status === 401) clearSession(); else setError(err.message);
    });
    return () => { active = false; };
  }, [user.type]);
  const content = <div className="account-dashboard"><h1>{user.type === 'staff' ? 'Staff dashboard' : 'Customer portal'}</h1><section className="account-summary" aria-label="Account summary">
    <p>{verified ? `Signed in as ${user.email}` : 'Verifying access…'}</p>
    {verified && <p>{user.type === 'staff' ? `Role: ${user.role}` : user.profile?.name || 'Welcome to your portal.'}</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
  </section></div>;
  return embedded ? content : <AccountLayout>{content}</AccountLayout>;
}
