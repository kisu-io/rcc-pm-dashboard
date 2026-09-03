'use client';
import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * Shown when a server component fails to load its data.
 *
 * This exists so a failed query stops rendering as a healthy, empty project.
 * Before it, every getter swallowed its error and returned [], so a dropped
 * session or an unreachable database produced 0 active projects, 0 overdue and
 * "Schedule Health 100%" — numbers a PM would have acted on.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page error]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-red-100 p-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <AlertTriangle className="text-red-600" size={24} />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Không tải được dữ liệu</h1>
        <p className="text-sm text-slate-500 mt-2">
          Trang này không hiển thị số liệu vì truy vấn tới cơ sở dữ liệu thất bại.
          Số liệu cũ hoặc rỗng có thể gây hiểu nhầm, nên chúng tôi không hiển thị.
        </p>
        <p className="text-sm text-slate-500 mt-2">
          Thử tải lại. Nếu vẫn lỗi, đăng xuất rồi đăng nhập lại — phiên đăng nhập có thể đã hết hạn.
        </p>
        <button
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <RotateCw size={14} /> Thử lại
        </button>
        {error.digest && (
          <p className="text-[10px] text-slate-400 mt-4 font-mono break-all">Mã lỗi: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
