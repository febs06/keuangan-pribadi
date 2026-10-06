import React, { useState } from 'react';

interface LoginProps {
  onSignIn: (email: string, pass: string) => Promise<unknown>;
  onSignUp: (email: string, pass: string) => Promise<unknown>;
}

export function Login({ onSignIn, onSignUp }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email dan kata sandi wajib diisi');
      return;
    }

    setLoading(true);
    try {
      if (isRegisterMode) {
        await onSignUp(email, password);
      } else {
        await onSignIn(email, password);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk, periksa data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-area" style={{ justifyContent: 'center', minHeight: '80vh' }}>
      <div className="card" style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>
          {isRegisterMode ? 'Buat Akun Pertama' : 'Masuk Akun'}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Pencatatan keuangan pribadi satu pengguna.
        </p>

        {error && (
          <div style={{ color: 'var(--expense)', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nama@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Kata sandi</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-full"
            style={{ marginTop: '8px' }}
          >
            {loading ? 'Memproses...' : (isRegisterMode ? 'Daftar' : 'Masuk')}
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {isRegisterMode ? 'Sudah punya akun? Masuk' : 'Akun baru? Buat akun di sini'}
          </button>
        </div>
      </div>
    </div>
  );
}
