import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../services/api';
import { setCredentials } from '../store/slices/authSlice';
import { useAppDispatch } from '../store/hooks';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = (await api.request<{ user: { id: string; email: string; role: 'CUSTOMER' | 'ADMIN'; }; accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })) as {
        user: { id: string; email: string; role: 'CUSTOMER' | 'ADMIN'; };
        accessToken: string;
        refreshToken: string;
      };

      dispatch(setCredentials({
        token: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      }));

      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <form className="card auth-card" onSubmit={handleSubmit} autoComplete="off">
        <h1>Banking System</h1>
        <h2>Login</h2>
        {error && <div className="error-box">{error}</div>}
        <label>
          Email
          <input name="email" autoComplete="off" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input name="password" autoComplete="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </button>
        <p>
          Need an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
