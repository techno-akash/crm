import { useState } from 'react';
import ToastHost from '../../components/Toast.jsx';
import './auth.css';
export function AuthFrame({ title, description, children }) {
  return <main className="auth-shell"><section className="auth-card"><h1>{title}</h1>{description && <p>{description}</p>}{children}</section><ToastHost /></main>;
}
export function PasswordField({ label = 'Password', name = 'password', value, onChange, autoComplete = 'current-password', hint }) {
  const [visible, setVisible] = useState(false);
  return <label htmlFor={name}>{label}<span className="auth-password"><input id={name} aria-label={label} name={name} type={visible ? 'text' : 'password'} required value={value} onChange={onChange} autoComplete={autoComplete} maxLength={72} aria-describedby={hint ? `${name}-hint` : undefined} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></span>{hint && <span id={`${name}-hint`} className="auth-hint">{hint}</span>}</label>;
}
export function SubmitButton({ busy, children }) {
  return <button className="auth-submit" disabled={busy} type="submit">{busy && <span className="auth-spinner" aria-hidden="true" />}{busy ? 'Please wait…' : children}</button>;
}
export const passwordHint = 'At least 8 characters, with uppercase, lowercase and a number. Maximum 72 UTF-8 bytes.';
export function passwordError(value) {
  return value.length < 8 || new TextEncoder().encode(value).length > 72 || !/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value) ? passwordHint : '';
}
