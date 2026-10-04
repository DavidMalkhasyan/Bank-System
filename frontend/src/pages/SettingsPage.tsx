import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';

import { themeOptions, useTheme } from '../components/Theme';
import { useToast } from '../components/Toast';
import { Alert, Avatar, Badge, Button, Card, CardHeader, Field, Input, PageHeader, Segmented } from '../components/ui';
import { ApiError, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { useChangePassword, useUpdateProfile } from '../lib/queries';
import { useAppSelector } from '../store';
import { passwordStrength } from './RegisterPage';

function ProfileForm() {
  const user = useAppSelector((state) => state.auth.user);
  const toast = useToast();
  const updateProfile = useUpdateProfile();
  const [fullName, setFullName] = useState(user?.fullName ?? '');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await updateProfile.mutateAsync(fullName);
      toast.success('Profile updated');
    } catch {
      // Shown inline.
    }
  };

  return (
    <Card>
      <CardHeader title="Profile" subtitle="How you appear to people you send money to." bordered />
      <form className="card-body stack" onSubmit={submit}>
        <div className="row">
          <Avatar name={user?.fullName} size="lg" />
          <div>
            <div className="strong" style={{ fontSize: 17 }}>{user?.fullName}</div>
            <div className="muted small">{user?.email}</div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <Badge tone={user?.role === 'ADMIN' ? 'primary' : 'neutral'}>{user?.role === 'ADMIN' ? 'Administrator' : 'Customer'}</Badge>
              <span className="tiny faint">Member since {formatDate(user?.createdAt)}</span>
            </div>
          </div>
        </div>
        {updateProfile.isError && <Alert>{errorMessage(updateProfile.error)}</Alert>}
        <Field label="Full name" htmlFor="settings-name">
          <Input id="settings-name" value={fullName} maxLength={80} onChange={(event) => setFullName(event.target.value)} />
        </Field>
        <Field label="Email" htmlFor="settings-email" hint="Email changes aren’t supported in this demo.">
          <Input id="settings-email" value={user?.email ?? ''} disabled />
        </Field>
        <div>
          <Button type="submit" loading={updateProfile.isPending} disabled={fullName.trim().length < 2 || fullName.trim() === user?.fullName}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const toast = useToast();
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = confirm.length > 0 && confirm !== newPassword;
  const fieldErrors = changePassword.error instanceof ApiError ? changePassword.error.fieldErrors : {};

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mismatch) return;
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      toast.success('Password changed', 'Other devices have been signed out.');
    } catch {
      // Shown inline.
    }
  };

  return (
    <Card>
      <CardHeader title="Password" subtitle="Changing it signs you out everywhere else." bordered />
      <form className="card-body stack" onSubmit={submit}>
        {changePassword.isError && <Alert>{errorMessage(changePassword.error)}</Alert>}
        <Field label="Current password" htmlFor="current-password">
          <Input id="current-password" type="password" icon={<Lock />} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </Field>
        <Field label="New password" htmlFor="new-password" error={fieldErrors.newPassword?.[0]} hint="At least 8 characters">
          <Input id="new-password" type="password" icon={<Lock />} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <div className="strength" data-level={passwordStrength(newPassword)} aria-hidden>
            <i /><i /><i /><i />
          </div>
        </Field>
        <Field label="Confirm new password" htmlFor="confirm-password" error={mismatch ? 'Passwords don’t match' : undefined}>
          <Input id="confirm-password" type="password" icon={<Lock />} autoComplete="new-password" value={confirm} invalid={mismatch} onChange={(event) => setConfirm(event.target.value)} />
        </Field>
        <div>
          <Button type="submit" loading={changePassword.isPending} disabled={!currentPassword || newPassword.length < 8 || confirm !== newPassword}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AppearanceCard() {
  const { preference, setPreference } = useTheme();
  return (
    <Card>
      <CardHeader title="Appearance" subtitle="Choose how Ledgerly looks on this device." bordered />
      <div className="card-body">
        <Segmented
          full
          label="Theme"
          value={preference}
          onChange={setPreference}
          options={themeOptions.map(({ value, label, icon: Icon }) => ({ value, label: <><Icon /> {label}</> }))}
        />
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your profile, security and preferences." />
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 20 }}>
          <ProfileForm />
          <AppearanceCard />
        </div>
        <PasswordForm />
      </div>
    </>
  );
}
