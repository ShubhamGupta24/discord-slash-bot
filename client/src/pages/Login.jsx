import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await api.login(username, password);
      setToken(token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1><span className="pulse-dot" /> bot console</h1>
        <p className="subtitle">Sign in to view the command log and configure rules.</p>
        {error && <p className="error-msg">⚠ {error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
