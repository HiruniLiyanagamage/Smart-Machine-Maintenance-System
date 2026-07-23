import { useState } from 'react';
import { setAccessToken, login as apiLogin, signup as apiSignup } from '../../utils/api';
import { User } from '../../types';

const SESSION_KEY = 'smms_session';
const ADMIN_EMAIL = 'admin@biofood.lk';

interface AuthProps {
  onLogin: (user: User) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Technician');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const buildUser = (raw: any): User => {
    const isAdmin = raw.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const role = isAdmin ? 'Admin' : (raw.role || 'Staff');
    return {
      id: raw.id,
      email: raw.email,
      user_metadata: { name: raw.name || raw.email, role },
    };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await apiLogin(email.trim(), password);
      const user = buildUser(result.user);
      const token = `mock_${result.user.id}`;
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user, access_token: token }));
      setAccessToken(token);
      onLogin(user);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (!name.trim()) throw new Error('Name is required.');
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      const result = await apiSignup(email.trim(), password, name.trim(), role);
      const user = buildUser(result.user);
      const token = `mock_${result.user.id}`;
      localStorage.setItem(SESSION_KEY, JSON.stringify({ user, access_token: token }));
      setAccessToken(token);
      onLogin(user);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="logo-circle">🏭</div>
          <h1>Smart Machine Maintenance System</h1>
          <p>Bio Food Pvt Ltd — Machine Maintenance</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>
            Sign In
          </button>
          <button className={`auth-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => { setTab('signup'); setError(''); }}>
            Create Account
          </button>
        </div>

        {/* Error */}
        {error && <div className="alert alert-danger mb-4" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Login form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@biofood.lk" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in…' : '🔐 Sign In'}
            </button>
            <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text-muted)' }}>
              🔑 <strong>Admin Sign In:</strong> Use <code style={{ color: 'var(--accent-light)' }}>admin@biofood.lk</code> / <code style={{ color: 'var(--accent-light)' }}>admin123</code>
            </div>
          </form>
        )}

        {/* Signup form */}
        {tab === 'signup' && (
          <form onSubmit={handleSignup}>
            <div className="alert alert-info mb-3" style={{ fontSize: 12 }}>
              🔒 Standard staff account creation. Administrative access is restricted to authorized personnel.
            </div>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Doe" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@biofood.lk" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password (min 6 chars) *</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a secure password" required />
            </div>
            <div className="form-group">
              <label className="form-label">Staff Role / Specialization *</label>
              <select className="form-select" value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
                <option value="Electrician">⚡ Electrician</option>
                <option value="Mechanic">🔧 Mechanic</option>
                <option value="Technician">⚙️ Technician</option>
                <option value="Plumber">🚰 Plumber</option>
                <option value="HVAC Specialist">❄️ HVAC Specialist</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Creating account…' : '👷 Create Staff Account & Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
