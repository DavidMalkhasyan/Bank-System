import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gift, Lock, Mail, UserRound } from 'lucide-react';

import { Logo } from '../components/Logo';
import { useToast } from '../components/Toast';
import { Alert, Button, Field, Input } from '../components/ui';
import { ApiError, errorMessage } from '../lib/api';
import { register } from '../lib/queries';
import { AuthLayout } from './AuthLayout';

export function passwordStrength(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.max(1, Math.min(4, score));
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const strength = passwordStrength(password);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    setFieldErrors({});
    try {
      const session = await register({ fullName, email, password });
      toast.success(`Welcome, ${session.user.fullName.split(' ')[0]}!`, 'Your checking account is open with a $1,000 welcome bonus.');
      navigate('/app', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setPending(false);
    }
  };

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={submit} noValidate>
        <span className="topbar-logo">
          <Logo />
        </span>
        <div>
          <h1>Create your account</h1>
          <p className="muted" style={{ marginTop: 6 }}>It takes less than a minute.</p>
        </div>
        <Alert tone="success">
          <span className="row" style={{ gap: 6 }}>
            <Gift size={16} /> New accounts get <strong>$1,000</strong> of demo money to try transfers.
          </span>
        </Alert>
        {error && <Alert>{error}</Alert>}
        <Field label="Full name" htmlFor="fullName" error={fieldErrors.fullName?.[0]}>
          <Input id="fullName" autoComplete="name" icon={<UserRound />} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Jane Doe" required />
        </Field>
        <Field label="Email" htmlFor="email" error={fieldErrors.email?.[0]}>
          <Input id="email" type="email" autoComplete="email" icon={<Mail />} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
        </Field>
        <Field label="Password" htmlFor="password" error={fieldErrors.password?.[0]} hint={password ? `${STRENGTH_LABELS[strength]} password` : 'At least 8 characters'}>
          <Input id="password" type="password" autoComplete="new-password" icon={<Lock />} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required minLength={8} />
          <div className="strength" data-level={strength} aria-hidden>
            <i /><i /><i /><i />
          </div>
        </Field>
        <Button type="submit" size="lg" block loading={pending} disabled={!fullName || !email || password.length < 8}>
          Create account
        </Button>
        <p className="muted" style={{ textAlign: 'center' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
