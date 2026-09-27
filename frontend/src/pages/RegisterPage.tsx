import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../services/api';
import { setCredentials } from '../store/slices/authSlice';
import { useAppDispatch } from '../store/hooks';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await api.request<{ user: { id: string; email: string; role: 'CUSTOMER' | 'ADMIN'; }; accessToken: string; refreshToken: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

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
        <h2>Register</h2>
        {error && <div className="error-box">{error}</div>}
        <label>
          Email
          <input name="email" autoComplete="off" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input name="password" autoComplete="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
