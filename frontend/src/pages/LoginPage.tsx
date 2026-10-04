import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';

import { Logo } from '../components/Logo';
import { Alert, Button, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/api';
import { login } from '../lib/queries';
import { AuthLayout } from './AuthLayout';

export const DEMO_ACCOUNTS = {
  customer: { email: 'alex@example.com', password: 'password123' },
  admin: { email: 'admin@example.com', password: 'password123' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/app';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<'form' | 'customer' | 'admin' | null>(null);

  const signIn = async (credentials: { email: string; password: string }, source: 'form' | 'customer' | 'admin') => {
    setPending(source);
    setError('');
    try {
      await login(credentials.email, credentials.password);
      navigate(source === 'admin' ? '/app/admin' : redirectTo, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setPending(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void signIn({ email, password }, 'form');
  };

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={submit} noValidate>
        <span className="topbar-logo">
          <Logo />
        </span>
        <div>
          <h1>Welcome back</h1>
          <p className="muted" style={{ marginTop: 6 }}>Sign in to manage your accounts.</p>
        </div>

        <div className="stack-sm">
          <span className="field-label">Explore with a demo account</span>
          <div className="demo-buttons">
            <button type="button" className="demo-button" onClick={() => signIn(DEMO_ACCOUNTS.customer, 'customer')} disabled={pending !== null}>
              {pending === 'customer' ? <span className="spinner" /> : <UserRound size={20} />}
              <span>
                <strong>Customer</strong>
                <span>Alex Carter</span>
              </span>
            </button>
            <button type="button" className="demo-button" onClick={() => signIn(DEMO_ACCOUNTS.admin, 'admin')} disabled={pending !== null}>
              {pending === 'admin' ? <span className="spinner" /> : <ShieldCheck size={20} />}
              <span>
                <strong>Admin</strong>
                <span>Back office</span>
              </span>
            </button>
          </div>
        </div>

        <div className="auth-divider">or sign in with email</div>

        {error && <Alert>{error}</Alert>}

        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" icon={<Mail />} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            icon={<Lock />}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
            action={
              <Button variant="ghost" size="sm" icon={showPassword ? <EyeOff /> : <Eye />} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} />
            }
          />
        </Field>
        <Button type="submit" size="lg" block loading={pending === 'form'} disabled={!email || !password || pending !== null}>
          Sign in
        </Button>
        <p className="muted" style={{ textAlign: 'center' }}>
          New to Ledgerly? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
