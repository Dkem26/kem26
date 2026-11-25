import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { api } from '../utils/api.ts';
import type { AuthSession } from '../types.ts';

interface LoginViewProps {
  setupRequired: boolean;
  onAuthenticated: (session: AuthSession) => void;
}

export function LoginView({ setupRequired, onAuthenticated }: LoginViewProps) {
  const [username, setUsername] = useState(setupRequired ? 'admin' : '');
  const [namaLengkap, setNamaLengkap] = useState('Admin Security Al-Muhajirin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }

    if (setupRequired) {
      if (password.length < 6) {
        setError('Password minimal 6 karakter.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Konfirmasi password tidak cocok.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = setupRequired
        ? await api.authSetup({ username: username.trim(), password, namaLengkap: namaLengkap.trim() })
        : await api.authLogin({ username: username.trim(), password });
      onAuthenticated(res.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ocean-canvas min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="glass-panel rounded-2xl p-7 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0B2B52] via-[#0F3D6E] to-[#1565C0] text-white shadow-lg ring-1 ring-white/40">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight text-[#0B2B52] text-balance">
              Absensi Security Al-Muhajirin
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Pondok Pesantren Al-Muhajirin · Portal Administrasi
            </p>
          </div>

          <div className="mt-6 border-t border-slate-200/80 pt-5">
            {setupRequired ? (
              <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/85 px-4 py-3 text-xs sm:text-sm text-[#0B2B52]">
                <p className="font-semibold">Aktivasi Akun Admin Pertama Kali</p>
                <p className="mt-1 text-slate-600">
                  Buat username dan password admin untuk mengamankan database absensi sebelum digunakan.
                </p>
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
                <KeyRound className="h-3.5 w-3.5 text-[#1565C0]" />
                <span>Masuk menggunakan akun admin terdaftar</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-800"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {setupRequired && (
                <div>
                  <label htmlFor="setup-fullname" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Nama Lengkap Admin
                  </label>
                  <input
                    id="setup-fullname"
                    type="text"
                    value={namaLengkap}
                    onChange={(e) => setNamaLengkap(e.target.value)}
                    placeholder="Admin Security Al-Muhajirin"
                    className="w-full min-h-11 rounded-xl border border-slate-300/90 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1565C0] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/20"
                  />
                </div>
              )}

              <div>
                <label htmlFor="login-username" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username admin"
                  required
                  className="w-full min-h-11 rounded-xl border border-slate-300/90 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1565C0] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/20"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={setupRequired ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={setupRequired ? 'Minimal 6 karakter' : 'Masukkan password'}
                    required
                    className="w-full min-h-11 rounded-xl border border-slate-300/90 bg-white/90 pl-3.5 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1565C0] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {setupRequired && (
                <div>
                  <label htmlFor="setup-confirm" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Konfirmasi Password
                  </label>
                  <input
                    id="setup-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password"
                    required
                    className="w-full min-h-11 rounded-xl border border-slate-300/90 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1565C0] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/20"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2B52] via-[#0F3D6E] to-[#1565C0] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:brightness-110 transition-all disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" />
                    <span>{setupRequired ? 'Aktifkan & Masuk' : 'Masuk ke Aplikasi'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-300/80">
          Divisi Keamanan Pondok Pesantren Al-Muhajirin
        </p>
      </div>
    </div>
  );
}
