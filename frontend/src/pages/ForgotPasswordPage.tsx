import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { authApi } from '../api/auth.api';

type RecoveryStep = 'email' | 'otp' | 'password' | 'success';

export function ForgotPasswordPage() {
  const [step, setStep] = useState<RecoveryStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function errorMessage(caught: unknown) {
    if (!(caught instanceof ApiError))
      return 'Unable to complete password recovery. Try again.';
    if (caught.status === 429)
      return 'Too many attempts. Wait a little and try again.';
    if (caught.status === 400) return caught.message;
    return 'Unable to complete password recovery. Try again.';
  }

  async function requestCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authApi.requestPasswordReset(email.trim());
      setStep('otp');
      setCooldown(60);
      setNotice(
        'If an account exists for that email, a reset code will be sent.',
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await authApi.verifyResetOtp(email.trim(), otp);
      setResetToken(result.resetToken);
      setOtp('');
      setNotice('');
      setStep('password');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authApi.resetPassword(resetToken, password);
      setPassword('');
      setConfirmation('');
      setResetToken('');
      setStep('success');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page auth-register">
      <div className="auth-visual">
        <div className="auth-brand">
          <div className="brand-mark">
            <GraduationCap size={21} />
          </div>
          <strong>Smart Campus</strong>
        </div>
        <div className="auth-visual-copy">
          <div className="auth-kicker">ACCOUNT SECURITY</div>
          <h1>
            Get back to
            <br />
            learning.
          </h1>
          <p>Recover access to your campus account securely.</p>
        </div>
        <div className="visual-footnote">
          ACADEMIC WORKSPACE <span>·</span> SMART CAMPUS LMS
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <Link className="back-link" to="/login">
            <ArrowLeft size={16} /> Back to sign in
          </Link>
          <div className="auth-welcome">PASSWORD RECOVERY</div>
          {step === 'email' && (
            <>
              <h2>Forgot your password?</h2>
              <p className="auth-subtitle">
                Enter your account email and we’ll send a reset code if it
                matches an account.
              </p>
              {error && (
                <div className="notice notice-error" role="alert">
                  {error}
                </div>
              )}
              <form
                className="form-stack"
                onSubmit={(event) => void requestCode(event)}
              >
                <label className="field-label" htmlFor="reset-email">
                  Email address
                </label>
                <div className="input-with-icon">
                  <Mail size={17} />
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <button
                  className="button button-primary button-full"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? 'Sending…' : 'Send reset code'}
                </button>
              </form>
            </>
          )}
          {step === 'otp' && (
            <>
              <h2>Check your email</h2>
              <p className="auth-subtitle">
                Enter the six-digit code sent to your email. The code expires
                soon.
              </p>
              {notice && (
                <div className="notice notice-info" role="status">
                  {notice}
                </div>
              )}
              {error && (
                <div className="notice notice-error" role="alert">
                  {error}
                </div>
              )}
              <form
                className="form-stack"
                onSubmit={(event) => void verifyCode(event)}
              >
                <label className="field-label" htmlFor="reset-otp">
                  Six-digit code
                </label>
                <input
                  id="reset-otp"
                  className="form-input otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                />
                <button
                  className="button button-primary button-full"
                  disabled={busy || otp.length !== 6}
                  type="submit"
                >
                  {busy ? 'Verifying…' : 'Verify code'}
                </button>
              </form>
              <button
                className="text-link resend-button"
                disabled={busy || cooldown > 0}
                onClick={() => void requestCode()}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
            </>
          )}
          {step === 'password' && (
            <>
              <h2>Choose a new password</h2>
              <p className="auth-subtitle">
                Use at least eight characters for your new password.
              </p>
              {error && (
                <div className="notice notice-error" role="alert">
                  {error}
                </div>
              )}
              <form
                className="form-stack"
                onSubmit={(event) => void updatePassword(event)}
              >
                <label className="field-label" htmlFor="new-password">
                  New password
                </label>
                <div className="password-reset-input">
                  <LockKeyhole size={17} />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <label className="field-label" htmlFor="confirm-password">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
                <button
                  className="button button-primary button-full"
                  disabled={
                    busy || password.length < 8 || password !== confirmation
                  }
                  type="submit"
                >
                  {busy ? 'Updating…' : 'Reset password'}
                </button>
              </form>
            </>
          )}
          {step === 'success' && (
            <>
              <h2>Password updated</h2>
              <p className="auth-subtitle" role="status">
                Your password has been reset. You can now sign in with your new
                password.
              </p>
              <Link className="button button-primary button-full" to="/login">
                Return to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
