import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authApi } from '../services/authApi';
const AuthContext = createContext(null);
// Share initialization across StrictMode mounts to avoid rotating one cookie twice.
let bootstrap;
function loadSession() {
  if (!bootstrap) {
    bootstrap = authApi.me().catch(error => {
      if (error.status === 401) return authApi.refresh().catch(refreshError => {
        if (refreshError.status === 401) return { user: null };
        throw refreshError;
      });
      throw error;
    });
  }
  return bootstrap;
}
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [challenge, setChallenge] = useState(null);
  const operation = useRef(0);
  useEffect(() => {
    let active = true;
    const version = operation.current;
    loadSession().then(data => { if (active && version === operation.current) setUser(data.user); })
      .catch(error => { if (active && version === operation.current) setSessionError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function login(type, credentials) {
    operation.current++;
    const result = await authApi.login(type, credentials);
    setSessionError('');
    if (result.twoFactorRequired) setChallenge({ token: result.tempToken, expiresAt: Date.now() + 5 * 60000 });
    else { setUser(result.user); setChallenge(null); bootstrap = Promise.resolve(result); }
    return result;
  }
  async function verify(code) {
    if (!challenge || challenge.expiresAt <= Date.now()) { setChallenge(null); throw new Error('Login challenge expired. Please sign in again.'); }
    const result = await authApi.verify({ tempToken: challenge.token, code });
    operation.current++;
    setUser(result.user); setChallenge(null); bootstrap = Promise.resolve(result);
  }
  async function logout() {
    await authApi.logout();
    operation.current++;
    setUser(null); setChallenge(null); bootstrap = Promise.resolve({ user: null });
  }
  function clearSession() { operation.current++; setUser(null); setChallenge(null); bootstrap = Promise.resolve({ user: null }); }
  return <AuthContext.Provider value={{ user, loading, sessionError, challenge, login, verify, logout, clearSession }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
