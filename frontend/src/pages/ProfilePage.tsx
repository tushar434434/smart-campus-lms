import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { authApi } from '../api/auth.api';
import { ErrorNotice, Notice } from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';

export function ProfilePage() {
  const { user, token, updateSessionUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!user || !token) return null;
  const accessToken = token;

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const updated = await authApi.updateProfile(accessToken, name.trim());
      updateSessionUser(updated);
      setSuccess('Your display name was updated.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update your profile.');
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = String(new FormData(form).get('currentPassword') ?? '');
    const newPassword = String(new FormData(form).get('newPassword') ?? '');
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await authApi.changePassword(accessToken, currentPassword, newPassword);
      form.reset();
      setSuccess('Your password was changed.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to change your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      {error && <ErrorNotice message={error} />}
      {success && <Notice tone="success">{success}</Notice>}
      <section className="content-card">
        <div className="section-heading">
          <div>
            <div className="section-kicker">ACCOUNT</div>
            <h2>Profile</h2>
            <p>Update the name shown in this workspace. Email stays tied to your login.</p>
          </div>
        </div>
        <form className="form-stack" onSubmit={(event) => void saveName(event)}>
          <label className="field-label" htmlFor="profile-name">Display name</label>
          <input
            className="form-input"
            id="profile-name"
            value={name}
            minLength={3}
            maxLength={100}
            required
            onChange={(event) => setName(event.target.value)}
          />
          <label className="field-label" htmlFor="profile-email">Email</label>
          <input className="form-input" id="profile-email" value={user.email} readOnly />
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save name'}
          </button>
        </form>
      </section>
      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Password</h2>
            <p>Choose a new password of at least eight characters.</p>
          </div>
        </div>
        <form className="form-stack" onSubmit={(event) => void savePassword(event)}>
          <label className="field-label" htmlFor="current-password">Current password</label>
          <input className="form-input" id="current-password" name="currentPassword" type="password" required />
          <label className="field-label" htmlFor="new-password">New password</label>
          <input className="form-input" id="new-password" name="newPassword" type="password" required minLength={8} />
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </section>
    </div>
  );
}
