'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { HardHat, Mail, Loader2, LogIn, AlertTriangle, UserPlus, Lock } from 'lucide-react';

export default function LoginGate() {
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
        window.location.reload();
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
      window.location.reload();
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