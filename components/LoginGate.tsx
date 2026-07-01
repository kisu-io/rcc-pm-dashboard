'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { HardHat, Mail, Loader2, LogIn, AlertTriangle } from 'lucide-react';

export default function LoginGate() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
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
