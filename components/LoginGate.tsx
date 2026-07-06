'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { HardHat, Mail, Loader2, LogIn, AlertTriangle } from 'lucide-react';

export default function LoginGate() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Nhập email');
      return;
    }
    setSending(true);
    setError(null);
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setError(null);
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (err) {
      setError(err.message);
      setGoogleLoading(false);
    }
    // If successful, browser redirects to Google → back to /auth/callback
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
          {sent ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="text-green-600" size={28} />
              </div>
              <h2 className="font-semibold text-base mb-1">Check your email</h2>
              <p className="text-xs text-slate-500">
                Magic link đã gửi tới <strong className="text-slate-700">{email}</strong>.
                Bấm link trong email để đăng nhập.
              </p>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-lg font-bold mb-1">Đăng nhập</h1>
                <p className="text-xs text-slate-500">
                  Nhập email — chúng tôi gửi magic link. Không cần mật khẩu.
                </p>
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}

              {/* Google OAuth */}
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={googleLoading}
                className="w-full bg-white border border-slate-300 text-slate-700 text-sm font-medium py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-3 transition"
              >
                {googleLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {googleLoading ? 'Đang chuyển…' : 'Đăng nhập với Google'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] text-slate-400 uppercase font-medium">hoặc</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Magic link */}
              <form onSubmit={sendMagicLink} className="space-y-3">
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
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-[#2563eb] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                  {sending ? 'Sending…' : 'Send magic link'}
                </button>
              </form>

              <p className="text-[10px] text-slate-400 text-center pt-2">
                Lần đầu đăng nhập → tự động tạo account role <strong>viewer</strong>.
                Admin upgrade lên <strong>pm</strong> sau.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}