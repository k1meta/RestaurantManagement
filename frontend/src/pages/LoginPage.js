import React, { useState } from 'react';

const DEMO_CREDENTIALS = [
  { name: 'Owner Ali', email: 'owner@restaurant.com', password: 'password123', role: 'owner' },
  { name: 'Manager Sara', email: 'manager@restaurant.com', password: 'password123', role: 'manager' },
  { name: 'Waiter Tom', email: 'waiter@restaurant.com', password: 'password123', role: 'waiter' },
  { name: 'Chef Marco', email: 'kitchen@restaurant.com', password: 'password123', role: 'kitchen' },
];

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await onLogin(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
    }
  };

  const fillCredentials = (cred) => {
    setEmail(cred.email);
    setPassword(cred.password);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left: Login Form */}
        <div className="space-y-8">
          <div>
            <h1 className="font-headline text-5xl font-black tracking-tighter mb-2 uppercase">
              Restaurant
              <br />
              Management
            </h1>
            <p className="text-on-surface-variant text-sm font-bold uppercase tracking-[0.2em]">
              The Kinetic Editorial
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.2em] mb-2 text-on-surface-variant">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="Enter your email"
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.2em] mb-2 text-on-surface-variant">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="bg-error-container text-on-error-container p-3 text-sm font-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary py-4 font-headline font-black uppercase tracking-[0.1em] hover:bg-on-primary-fixed disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Right: Demo Credentials */}
        <div className="bg-surface-container-low p-8 border border-outline-variant/20">
          <h3 className="font-headline text-2xl font-black mb-2 uppercase">Demo Profiles</h3>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-[0.2em] mb-6">
            Click any to auto-fill credentials
          </p>

          <div className="space-y-3">
            {DEMO_CREDENTIALS.map((cred, idx) => (
              <button
                key={idx}
                onClick={() => fillCredentials(cred)}
                className="w-full text-left p-4 bg-surface-container-lowest border border-outline-variant/20 hover:border-primary hover:bg-surface-container-highest transition-colors group"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-headline font-bold">{cred.name}</h4>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary px-2 py-1 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                    {cred.role}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant font-mono">{cred.email}</p>
                <p className="text-xs text-on-surface-variant mt-1">Pass: {cred.password}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
