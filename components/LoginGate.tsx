'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { HardHat, Mail, Loader2, LogIn, AlertTriangle, UserPlus, Lock } from 'lucide-react';

export default function LoginGate() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim()) {
      setError('Nhập email');
      return;
    }

    if (mode === 'reset') {
      if (!password || password.length < 6) {
        setError('Mật khẩu mới tối thiểu 6 ký tự');
        return;
      }
      setLoading(true);
      const { error: err } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      setInfo('Mật khẩu đã cập nhật. Đăng nhập lại.');
      setMode('login');
      return;
    }

    if (!password) {
      setError('Nhập mật khẩu');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setError('Mật khẩu tối thiểu 6 ký tự');
        return;
      }
      if (password !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp');
        return;
      }
      setLoading(true);
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      if (data.user && !data.session) {
        setInfo('Tài khoản đã tạo. Kiểm tra email để xác nhận, rồi đăng nhập.');
        setMode('login');
      } else if (data.session) {
        // Full redirect to ensure middleware refreshes session cookie
        router.replace('/');
        router.refresh();
      }
    } else {
      setLoading(true);
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (err) {
        setError(err.message.includes('Invalid login') ? 'Email hoặc mật khẩu sai' : err.message);
        return;
      }
      // Full redirect to ensure middleware refreshes session cookie
      router.replace('/');
      router.refresh();
    }
  }

  async function sendPasswordReset() {
    if (!email.trim()) {
      setError('Nhập email để gửi link reset mật khẩu');
      return;
    }
    setLoading(true);
    setError(null);
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo('Link reset mật khẩu đã gửi tới email. Bấm link, rồi đặt mật khẩu mới.');
  }

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
    // On success, browser redirects to Google → back to /auth/callback
  }

  return (
    <div className="min-h-screen bg-[#0F1B3D] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-[#0F1B3D] p-6 text-center text-white">
          <div className="flex items-center justify-center gap-2 mb-2">
            <HardHat className="text-[#22c55e]" size={32} />
            <span className="font-bold text-xl">RCC PM</span>
          </div>
          <p className="text-xs text-slate-300">Construction Project Management</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Mode tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setInfo(null); }}
              className={`flex-1 text-xs font-medium py-2 rounded-md transition ${
                mode === 'login' ? 'bg-white text-[#0F1B3D] shadow-sm' : 'text-slate-500'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); setInfo(null); }}
              className={`flex-1 text-xs font-medium py-2 rounded-md transition ${
                mode === 'register' ? 'bg-white text-[#0F1B3D] shadow-sm' : 'text-slate-500'
              }`}
            >
              Đăng ký
            </button>
          </div>

          <div>
            <h1 className="text-lg font-bold mb-1">
              {mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : 'Đặt mật khẩu mới'}
            </h1>
            <p className="text-xs text-slate-500">
              {mode === 'login'
                ? 'Nhập email + mật khẩu để truy cập dashboard.'
                : mode === 'register'
                ? 'Đăng ký với email + mật khẩu. Role mặc định: viewer.'
                : 'Nhập email + mật khẩu mới. Link xác nhận sẽ gửi qua email.'}
            </p>
          </div>

          {/* Google OAuth — only on login/register */}
          {mode !== 'reset' && (
            <>
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={loading}
                className="w-full bg-white border border-slate-300 text-slate-700 text-sm font-medium py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-3 transition"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {loading ? 'Đang chuyển…' : 'Đăng nhập với Google'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] text-slate-400 uppercase font-medium">hoặc</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {info && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
              ✓ {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-medium">Email</label>
              <div className="relative mt-1">
                <Mail size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="phan@rcc.vn"
                  className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-medium">Mật khẩu</label>
              <div className="relative mt-1">
                <Lock size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Tối thiểu 6 ký tự' : '••••••'}
                  className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-medium">Xác nhận mật khẩu</label>
                <div className="relative mt-1">
                  <Lock size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563eb] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === 'login' ? (
                <LogIn size={16} />
              ) : mode === 'register' ? (
                <UserPlus size={16} />
              ) : (
                <Mail size={16} />
              )}
              {loading
                ? 'Đang xử lý…'
                : mode === 'login'
                ? 'Đăng nhập'
                : mode === 'register'
                ? 'Tạo tài khoản'
                : 'Gửi link reset'}
            </button>
          </form>

          {mode === 'login' && (
            <p className="text-[10px] text-slate-400 text-center pt-2">
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); setInfo(null); }}
                className="text-blue-600 hover:underline font-medium"
              >
                Đăng ký
              </button>
              {' · '}
              <button
                type="button"
                onClick={() => { setMode('reset'); setError(null); setInfo(null); }}
                className="text-blue-600 hover:underline font-medium"
              >
                Quên mật khẩu?
              </button>
            </p>
          )}
          {mode === 'register' && (
            <p className="text-[10px] text-slate-400 text-center pt-2">
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setInfo(null); }}
                className="text-blue-600 hover:underline font-medium"
              >
                Đăng nhập
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <p className="text-[10px] text-slate-400 text-center pt-2">
              Đã nhớ mật khẩu?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setInfo(null); }}
                className="text-blue-600 hover:underline font-medium"
              >
                Đăng nhập
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}