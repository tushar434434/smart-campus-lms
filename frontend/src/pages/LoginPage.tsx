import { useState, type FormEvent } from 'react';
import { ArrowRight, GraduationCap, LockKeyhole, Mail } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login({ email, password });
      navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to sign in right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-brand"><div className="brand-mark"><GraduationCap size={21} /></div><strong>Smart Campus</strong></div>
        <div className="auth-visual-copy">
          <div className="auth-kicker">YOUR CAMPUS, CONNECTED</div>
          <h1>Learning moves<br />forward together.</h1>
          <p>A clear, connected space for the work that happens across your campus.</p>
        </div>
        <div className="visual-footnote">ACADEMIC WORKSPACE <span>·</span> SMART CAMPUS LMS</div>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-welcome">WELCOME BACK</div>
          <h2>Sign in to your account</h2>
          <p className="auth-subtitle">Enter your campus credentials to continue.</p>
          {location.state?.registered && <div className="notice notice-success" role="status">Account created. Sign in to continue.</div>}
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          <form className="form-stack" onSubmit={submit}>
            <label className="field-label" htmlFor="email">Email address</label>
            <div className="input-with-icon"><Mail size={17} /><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@university.edu" /></div>
            <label className="field-label" htmlFor="password">Password</label>
            <div className="input-with-icon"><LockKeyhole size={17} /><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></div>
            <button className="button button-primary button-full" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} /></button>
          </form>
          <div className="auth-switch">New to Smart Campus? <Link to="/register">Create an account</Link></div>
          <div className="auth-security">Your session token stays in memory and is cleared when you sign out or refresh.</div>
        </div>
      </div>
    </div>
  );
}
