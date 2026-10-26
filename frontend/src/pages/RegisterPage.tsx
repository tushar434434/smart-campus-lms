import { useState, type FormEvent } from 'react';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'faculty'>('student');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register({ name, email, password, role });
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page auth-register">
      <div className="auth-visual">
        <div className="auth-brand"><div className="brand-mark"><GraduationCap size={21} /></div><strong>Smart Campus</strong></div>
        <div className="auth-visual-copy">
          <div className="auth-kicker">START HERE</div>
          <h1>Make room for<br />what comes next.</h1>
          <p>Create an account to access the learning tools your campus has enabled.</p>
        </div>
        <div className="visual-footnote">ACADEMIC WORKSPACE <span>·</span> SMART CAMPUS LMS</div>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <Link className="back-link" to="/login"><ArrowLeft size={16} /> Back to sign in</Link>
          <div className="auth-welcome">GET STARTED</div>
          <h2>Create your account</h2>
          <p className="auth-subtitle">Register a student or faculty account.</p>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          <form className="form-stack" onSubmit={submit}>
            <label className="field-label" htmlFor="name">Full name</label>
            <input id="name" className="form-input" autoComplete="name" minLength={3} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
            <label className="field-label" htmlFor="register-email">Email address</label>
            <input id="register-email" className="form-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@university.edu" />
            <label className="field-label" htmlFor="register-password">Password</label>
            <input id="register-password" className="form-input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
            <label className="field-label" htmlFor="role">Account type</label>
            <select id="role" className="form-input" value={role} onChange={(event) => setRole(event.target.value as 'student' | 'faculty')}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
            </select>
            <button className="button button-primary button-full" disabled={busy} type="submit">{busy ? 'Creating account…' : 'Create account'}</button>
          </form>
          <p className="register-note">Registration creates an account only. A faculty member or administrator must create and link your student record before student submission and quiz workflows are available.</p>
        </div>
      </div>
    </div>
  );
}
